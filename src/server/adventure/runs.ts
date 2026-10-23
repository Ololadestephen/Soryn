import { AdventureStore } from "./persistence";
import { frozenRival } from "./rivals";
import type { CharacterId } from "../../domain/characters/definitions";
import { selectScenario, sameLoadout, holderLoadout } from "./characterAccess";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  GameActionError,
  initialState,
  observe,
  replay,
  transition,
} from "../../domain/game/engine";
import { scenarioFor, type Action } from "../../domain/game/contracts";
import { deriveProfile, raceGhost } from "../../domain/ghosts/policy";
import { compareResults } from "../../domain/exhibits/comparison";
import {
  type ExhibitSummary,
  type RunView,
  type SessionView,
} from "../../domain/views";
import { Store } from "../persistence";
import { type ExhibitRecord, type RunRecord } from "./persistence";
import { ServiceError } from "../errors";
import { tokenKey, type OfficialAuthority } from "../../domain/identity";

function result(run: Pick<RunRecord, "scenario" | "actions">) {
  return replay(run.scenario, run.actions).at(-1) ?? initialState(run.scenario);
}
function summary(exhibit: ExhibitRecord): ExhibitSummary {
  const state = result(exhibit);
  return {
    id: exhibit.id,
    title: exhibit.title,
    alias: exhibit.alias,
    outcome: state.outcome ?? "unavailable",
    turnsUsed: 10 - state.turns,
    identity: exhibit.identity,
    ...(exhibit.scenario.rules === "sandwich-rules/2"
      ? { loadout: exhibit.scenario.loadout }
      : {}),
  };
}

export class RunService {
  private readonly adventure: AdventureStore;
  constructor(private store: Store) {
    this.adventure = new AdventureStore(store);
  }
  session(actor: string): SessionView {
    const latest = this.adventure
      .history(actor)
      .find((run) => run.mode === "guest");
    return {
      run: latest ? this.view(latest) : null,
      museum: this.adventure.museum().map(summary),
    };
  }
  view(run: RunRecord): RunView {
    const frames = replay(run.scenario, run.actions);
    if (
      JSON.stringify(run.tactics ?? null) !==
      JSON.stringify(frames.at(-1)?.tactics ?? null)
    )
      throw new ServiceError(
        503,
        "Saved ability state failed replay validation.",
      );
    const state = frames[frames.length - 1];
    const completed = !!state.outcome;
    const ghost = run.ghost;
    const exhibit = run.exhibitId
      ? this.adventure.exhibit(run.exhibitId)
      : null;
    const published = this.adventure.publication(run.id);
    // Withdrawal removes the exhibit opponent even from already-started runs.
    const rival =
      run.rival?.source === "museum" && exhibit?.status !== "published"
        ? null
        : run.rival;
    const rivalRace =
      completed && rival ? raceGhost(rival.profile, run.scenario) : null;
    return {
      id: run.id,
      mode: run.mode,
      ...(holderLoadout(run.scenario) && run.mode === "guest"
        ? { borrowed: true }
        : {}),
      identity: run.authority?.identity ?? null,
      exhibitId: run.exhibitId,
      step: run.actions.length,
      cohort: run.cohort,
      observation: observe(state),
      replay: completed
        ? {
            scenario: run.scenario,
            actions: run.actions,
            frames: frames.map(observe),
          }
        : null,
      ghost: ghost
        ? {
            version: ghost.version,
            profile: ghost.profile,
            race: raceGhost(ghost.profile, run.scenario),
          }
        : null,
      rival: rival
        ? {
            source: rival.source,
            label: rival.label,
            version: rival.version,
            replay: rivalRace
              ? {
                  frames: replay(run.scenario, rivalRace.actions).map(observe),
                  actions: rivalRace.actions,
                  reasons: rivalRace.reasons,
                  comparison: compareResults(state, rivalRace.result),
                }
              : null,
          }
        : null,
      comparison:
        completed && exhibit?.status === "published"
          ? {
              original: compareResults(state, result(exhibit)),
              ghost: compareResults(
                state,
                raceGhost(exhibit.ghost, exhibit.scenario).result,
              ),
            }
          : null,
      publication:
        published?.status === "published" ? summary(published) : null,
    };
  }
  start(
    actor: string,
    id: string,
    exhibitId: string | null,
    retryOf: string | null = null,
    authority: OfficialAuthority | null = null,
    characterId?: CharacterId,
  ): RunView {
    return this.store.transaction(() => {
      try {
        const existing = this.adventure.getRun(id, actor);
        this.assertAuthority(existing, authority);
        selectScenario(0, characterId, authority, existing.scenario);
        if (
          existing.exhibitId !== exhibitId ||
          existing.retryOf !== retryOf ||
          existing.ghostOf !== null
        )
          throw new ServiceError(
            409,
            "Start ID already used for another challenge.",
          );
        return this.view(existing);
      } catch (error) {
        if (!(error instanceof ServiceError) || error.status !== 404)
          throw error;
      }
      const prior = retryOf ? this.adventure.getRun(retryOf, actor) : null;
      if (prior) this.assertAuthority(prior, authority);
      if (prior && !result(prior).outcome)
        throw new ServiceError(409, "Finish the current run before retrying.");
      if (prior && prior.exhibitId !== exhibitId)
        throw new ServiceError(
          409,
          "Retry must retain the original challenge.",
        );
      const exhibit = exhibitId ? this.availableExhibit(exhibitId) : null;
      const seed = authority
        ? createHash("sha256")
            .update(tokenKey(authority.identity))
            .digest()
            .readUInt32BE()
        : randomBytes(4).readUInt32BE();
      const scenario =
        selectScenario(
          seed,
          characterId,
          authority,
          prior?.scenario ?? exhibit?.scenario ?? null,
        ) ?? scenarioFor(seed);
      const exposed = this.adventure.expose(actor, scenario);
      const rival = frozenRival(
        this.store,
        actor,
        scenario,
        authority,
        prior,
        exhibit,
      );
      const run: RunRecord = {
        id,
        actor,
        scenario,
        tactics: initialState(scenario).tactics ?? null,
        actions: [],
        mode: authority ? "official" : "guest",
        authority,
        exhibitId,
        retryOf,
        ghostOf: null,
        ghost: null,
        rival,
        cohort: exposed ? "informed-retry" : "first-recorded",
      };
      this.adventure.saveRun(run);
      return this.view(run);
    });
  }
  step(
    actor: string,
    id: string,
    expectedStep: number,
    action: Action,
    authority: OfficialAuthority | null = null,
  ): RunView {
    return this.store.transaction(() => {
      const run = this.adventure.getRun(id, actor);
      this.assertAuthority(run, authority);
      if (authority) run.authority = authority;
      if (
        expectedStep < run.actions.length &&
        run.actions[expectedStep] === action
      )
        return this.view(run);
      if (expectedStep !== run.actions.length)
        throw new ServiceError(
          409,
          "Stale turn. Reload to recover the saved run.",
        );
      try {
        transition(result(run), action);
      } catch (error) {
        if (error instanceof GameActionError)
          throw new ServiceError(
            422,
            "That action is unavailable. Reload the current room.",
            undefined,
            { cause: error },
          );
        throw error;
      }
      if (run.actions.length >= 32)
        throw new ServiceError(422, "Frozen event budget exhausted.");
      run.actions.push(action);
      run.tactics = result(run).tactics ?? null;
      if (result(run).outcome) {
        const training = [
          run,
          ...this.adventure
            .history(actor)
            .filter(
              (record) =>
                record.id !== run.id &&
                sameLoadout(record.scenario, run.scenario) &&
                !!result(record).outcome &&
                record.mode === run.mode &&
                (!authority ||
                  (record.authority?.generation === authority.generation &&
                    tokenKey(record.authority.identity) ===
                      tokenKey(authority.identity))),
            ),
        ].slice(0, 100);
        const snapshot = {
          trainingIds: training.map((record) => record.id),
          profile: deriveProfile(training),
        };
        run.ghost = {
          ...snapshot,
          version: createHash("sha256")
            .update(JSON.stringify(snapshot))
            .digest("hex"),
        };
      }
      this.adventure.saveRun(run);
      return this.view(run);
    });
  }
  publish(
    actor: string,
    id: string,
    title: string,
    alias: string,
    consent: boolean,
    authority: OfficialAuthority | null = null,
  ): ExhibitSummary {
    if (!consent)
      throw new ServiceError(422, "Explicit publication consent is required.");
    return this.store.transaction(() => {
      const run = this.adventure.getRun(id, actor);
      this.assertAuthority(run, authority);
      const state = result(run);
      if (run.mode === "guest" && holderLoadout(run.scenario))
        throw new ServiceError(
          403,
          "Borrowed holder chapters stay private and bound to their original challenge. Only a verified keeper can publish a holder-class exhibit.",
        );
      if (!state.outcome || state.outcome === "escaped")
        throw new ServiceError(
          422,
          "Only completed failures belong in this museum.",
        );
      const previous = this.adventure.publication(run.id);
      if (previous) {
        if (previous.status === "withdrawn")
          throw new ServiceError(
            410,
            "This publication was withdrawn. Create a new run to publish again.",
          );
        return summary(previous);
      }
      const exhibit: ExhibitRecord = {
        id: randomUUID(),
        runId: run.id,
        title,
        alias,
        scenario: run.scenario,
        actions: [...run.actions],
        ghost: deriveProfile([run]),
        status: "published",
        identity: authority?.identity ?? null,
      };
      this.adventure.saveExhibit(exhibit, actor);
      return summary(exhibit);
    });
  }
  withdraw(actor: string, runId: string, official = false): void {
    this.store.transaction(() => {
      const run = this.adventure.getRun(runId, actor);
      if ((run.mode === "official") !== official)
        throw new ServiceError(
          403,
          "Use the matching guest or wallet session.",
        );
      const exhibit = this.adventure.publication(runId);
      if (!exhibit) throw new ServiceError(404, "No publication for this run.");
      this.adventure.saveExhibit({ ...exhibit, status: "withdrawn" }, actor);
    });
  }
  publicReplay(actor: string, id: string) {
    const exhibit = this.availableExhibit(id);
    this.adventure.expose(actor, exhibit.scenario);
    const ghost = raceGhost(exhibit.ghost, exhibit.scenario);
    return {
      exhibit: summary(exhibit),
      frames: replay(exhibit.scenario, exhibit.actions).map(observe),
      ghost: {
        ...ghost,
        frames: replay(exhibit.scenario, ghost.actions).map(observe),
      },
    };
  }
  private availableExhibit(id: string): ExhibitRecord {
    const exhibit = this.adventure.exhibit(id);
    if (exhibit.status !== "published")
      throw new ServiceError(410, "This exhibit has been withdrawn.");
    return exhibit;
  }
  private assertAuthority(
    run: RunRecord,
    authority: OfficialAuthority | null,
  ): void {
    if (run.mode === "guest" && !authority) return;
    if (
      run.mode !== "official" ||
      !authority ||
      run.authority?.generation !== authority.generation ||
      tokenKey(run.authority.identity) !== tokenKey(authority.identity)
    )
      throw new ServiceError(
        403,
        "Run belongs to another mode, token or ownership generation.",
      );
  }
}
