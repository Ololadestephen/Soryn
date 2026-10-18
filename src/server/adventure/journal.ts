import { AdventureStore } from "./persistence";
import { holderLoadout } from "./characterAccess";
import { replay } from "../../domain/game/engine";
import { raceGhost } from "../../domain/ghosts/policy";
import { compareResults } from "../../domain/exhibits/comparison";
import {
  challengeProgress,
  type JournalChapter,
  type GuestJournalView,
} from "../../domain/journal";
import { Store } from "../persistence";
import { type RunRecord } from "./persistence";
import { RunService } from "./runs";
import { ServiceError } from "../errors";

function finalState(run: Pick<RunRecord, "scenario" | "actions">) {
  const frames = replay(run.scenario, run.actions);
  return frames[frames.length - 1];
}

export class GuestJournal {
  private readonly adventure: AdventureStore;
  constructor(
    private store: Store,
    private runs: RunService,
  ) {
    this.adventure = new AdventureStore(store);
  }

  read(actor: string): GuestJournalView {
    const chapters: JournalChapter[] = [];
    for (const run of this.adventure.history(actor)) {
      if (run.mode !== "guest") continue;
      const state = finalState(run);
      if (!state.outcome) continue;
      const exhibit = run.exhibitId
        ? this.adventure.exhibit(run.exhibitId)
        : null;
      const available = exhibit?.status === "published";
      chapters.push({
        id: run.id,
        ...(run.scenario.rules === "sandwich-rules/2"
          ? { loadout: run.scenario.loadout }
          : {}),
        outcome: state.outcome,
        turnsUsed: 10 - state.turns,
        alarm: state.alarm,
        cohort: run.cohort,
        ghostVersion: run.ghost?.version ?? null,
        trainingRuns: run.ghost?.profile.runs ?? 0,
        challenge: exhibit
          ? {
              id: exhibit.id,
              title: available ? exhibit.title : "Withdrawn exhibit",
              available,
            }
          : null,
        comparison:
          available && exhibit
            ? {
                original: compareResults(
                  state,
                  finalState({
                    scenario: exhibit.scenario,
                    actions: exhibit.actions,
                  }),
                ),
                ghost: compareResults(
                  state,
                  raceGhost(exhibit.ghost, exhibit.scenario).result,
                ),
              }
            : null,
      });
    }
    return { chapters, challenges: challengeProgress(chapters) };
  }

  chapter(actor: string, id: string) {
    const chapter = this.completedChapter(actor, id);
    this.adventure.expose(actor, chapter.scenario);
    return this.runs.view(chapter);
  }

  race(actor: string, id: string, chapterId: string) {
    return this.store.transaction(() => {
      let existing: RunRecord | null = null;
      try {
        existing = this.adventure.getRun(id, actor);
      } catch (error) {
        if (!(error instanceof ServiceError) || error.status !== 404)
          throw error;
      }
      if (existing) {
        if (existing.mode !== "guest" || existing.ghostOf !== chapterId)
          throw new ServiceError(
            409,
            "Race ID already used for another chapter.",
          );
        return this.runs.view(existing);
      }
      const source = this.completedChapter(actor, chapterId);
      if (!source.ghost)
        throw new ServiceError(
          409,
          "This chapter has no frozen ghost to race.",
        );
      if (holderLoadout(source.scenario)) {
        if (
          !source.exhibitId ||
          this.adventure.exhibit(source.exhibitId).status !== "published"
        )
          throw new ServiceError(
            403,
            "Borrowed holder characters can race only inside their active published challenge.",
          );
      }
      this.adventure.expose(actor, source.scenario);
      const current = this.adventure
        .history(actor)
        .find((record) => record.mode === "guest");
      if (current && !finalState(current).outcome)
        throw new ServiceError(
          409,
          "Finish your current guest chapter before starting a ghost race.",
        );
      const run: RunRecord = {
        id,
        actor,
        scenario: source.scenario,
        tactics: replay(source.scenario, []).at(0)?.tactics ?? null,
        actions: [],
        mode: "guest",
        authority: null,
        exhibitId: holderLoadout(source.scenario) ? source.exhibitId : null,
        retryOf: null,
        ghostOf: chapterId,
        ghost: null,
        cohort: "informed-retry",
        rival: {
          source: "previous-run",
          label: "Your selected past ghost",
          version: source.ghost.version,
          profile: source.ghost.profile,
        },
      };
      this.adventure.saveRun(run);
      return this.runs.view(run);
    });
  }

  private completedChapter(actor: string, id: string): RunRecord {
    const run = this.adventure.getRun(id, actor);
    if (run.mode !== "guest" || !finalState(run).outcome)
      throw new ServiceError(
        404,
        "Completed guest chapter unavailable for this session.",
      );
    return run;
  }
}
