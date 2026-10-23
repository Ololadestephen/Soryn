import {
  StoryLedger,
  freshProgress,
  officialBindingSchema,
  sameBinding,
  type StoryOfficialBinding,
  type StoryProgress,
} from "./ledger";
export type { StoryOfficialBinding } from "./ledger";
import {
  JourneyActionError,
  enterJourney,
  interactJourney,
  bindInteraction,
} from "../../domain/story/journey";
import { grantedFighter, type AccessGrant } from "../../domain/access/policy";
import type { StoryState } from "../../domain/story/responses";
import { randomUUID } from "node:crypto";
import { character } from "../../domain/characters/definitions";
import type { CharacterId } from "../../domain/characters/definitions";
import { tokenKey, tokenStoryActor } from "../../domain/identity";
import type { OfficialAuthority } from "../../domain/identity";
import { tokenActorUuid } from "../tokenActors";
import {
  STORY_POLICY,
  STORY_STARTERS,
  storyEncounter,
  type StoryRoute,
  type StoryStep,
} from "../../domain/story/sanctuary";
import { ServiceError } from "../errors";
import type { Store } from "../persistence";
import { BattleService } from "../combat/service";
import { TokenLocks } from "../pvp/locks";
import { OWNERSHIP_STALL_TERMINATE_MS } from "../../domain/pvp/ownership";
import type { Move } from "../../domain/combat/contracts";
import { TokenRecords } from "../records/tokenRecords";

/** A story encounter reservation lives at most this long. */
const STORY_RESERVATION_TTL_MS = 2 * 3_600_000;

export class StoryService {
  constructor(
    private readonly store: Store,
    private readonly battles: BattleService,
    readonly locks: TokenLocks = new TokenLocks(store),
  ) {
    this.tokenRecords = new TokenRecords(store);
    this.ledger = new StoryLedger(store);
  }
  private readonly tokenRecords: TokenRecords;
  private readonly ledger: StoryLedger;
  /** Keep unfinished progress private to its keeper; only published accomplishments succeed. */
  reconcileOfficialProgressAndGetActor(
    authority: OfficialAuthority,
    now: number,
  ): string {
    const actor = tokenStoryActor(
      authority.identity,
      authority.ownership.owner,
    );
    this.store.transaction(() => {
      if (!this.ledger.hasProgress(actor)) {
        const legacy = this.ledger.loadProgress(
          tokenStoryActor(authority.identity),
        );
        if (legacy.official?.owner === authority.ownership.owner) {
          // Preserve saved steps; do not silently revive a legacy in-flight encounter.
          if (legacy.battleId)
            this.locks.release(tokenKey(authority.identity), legacy.battleId);
          legacy.battleId = null;
          legacy.interruption = "legacy-encounter";
          this.ledger.saveProgress(actor, legacy);
        }
      }
      const binding = {
        identity: authority.identity,
        owner: authority.ownership.owner,
        generation: authority.generation,
      };
      const checked = this.bindOrCheckOfficialOwnership(actor, binding);
      if (checked.status === "changed")
        this.interrupt(
          actor,
          this.ledger.loadProgress(actor).official?.owner === binding.owner
            ? "generation-invalidated"
            : "ownership-changed",
          now,
          binding,
        );
      const progress = this.ledger.loadProgress(actor);
      if (progress.battleId) {
        const held = this.locks.get(tokenKey(authority.identity), now);
        if (
          !held ||
          held.encounter !== progress.battleId ||
          held.owner !== binding.owner ||
          held.generation !== binding.generation
        )
          this.interrupt(actor, "reservation-expired", now);
        else if (
          progress.unavailableSince !== null &&
          now >= progress.unavailableSince + OWNERSHIP_STALL_TERMINATE_MS
        )
          this.interrupt(actor, "verification-unavailable", now);
        else if (progress.unavailableSince !== null) {
          progress.unavailableSince = null;
          this.ledger.saveProgress(actor, progress);
        }
      }
    });
    return actor;
  }
  interruptReservation(
    encounter: string,
    generation: string,
    reason: "generation-invalidated" | "ownership-changed",
    now: number,
  ): void {
    for (const actor of this.ledger.actorsForReservation(encounter, generation))
      this.interrupt(actor, reason, now);
  }
  interrupt(
    actor: string,
    reason: NonNullable<StoryProgress["interruption"]>,
    now: number,
    binding?: StoryOfficialBinding,
  ) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (progress.battleId && progress.official) {
        const token = tokenKey(progress.official.identity);
        const battleActor = tokenActorUuid(
          progress.official.identity,
          progress.official.owner,
        );
        const battle = this.battles.interrupt(
          progress.battleId,
          battleActor,
          reason,
        );
        if (battle)
          this.tokenRecords.write({
            token,
            kind: "no-contest",
            source: battle.id,
            headline: "No contest",
            explanation: `Story encounter interrupted: ${reason}.`,
            fighter: character(battle.snapshot.player.id).name,
            opponent: null,
            opponentFighter: character(battle.snapshot.opponent.id).name,
            arena: battle.arena ?? null,
            rounds: null,
            score: null,
            route: progress.route,
            owner: progress.official.owner,
            generation: progress.official.generation,
            recordedAt: now,
            rules: `${STORY_POLICY}+${battle.snapshot.policy}`,
            eligibleForPublication: true,
            reason,
          });
        this.locks.release(token, progress.battleId);
      }
      progress.battleId = null;
      progress.retry = false;
      progress.unavailableSince = null;
      progress.interruption = reason;
      if (binding) progress.official = binding;
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  unavailable(actor: string, now: number) {
    const terminated = this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (!progress.battleId) return null;
      if (
        progress.unavailableSince !== null &&
        now >= progress.unavailableSince + OWNERSHIP_STALL_TERMINATE_MS
      )
        return this.interrupt(actor, "verification-unavailable", now);
      progress.unavailableSince ??= now;
      this.ledger.saveProgress(actor, progress);
      return null;
    });
    if (terminated) return terminated;
    throw new ServiceError(
      503,
      "Ownership verification is unavailable. Official Story is paused; no completion was awarded. Retry when verification returns.",
    );
  }
  officialBattle(
    actor: string,
    authority: OfficialAuthority,
    now: number,
    id?: string,
  ) {
    const progress = this.ledger.loadProgress(actor);
    if (!progress.battleId) return null;
    if (id && id !== progress.battleId)
      throw new ServiceError(404, "This is not your current Story encounter.");
    if (
      !progress.official ||
      !sameBinding(progress.official, {
        identity: authority.identity,
        owner: authority.ownership.owner,
        generation: authority.generation,
      })
    )
      throw new ServiceError(
        403,
        "This Story belongs to another ownership generation.",
      );
    const held = this.locks.get(tokenKey(authority.identity), now);
    if (
      !held ||
      held.encounter !== progress.battleId ||
      held.owner !== authority.ownership.owner ||
      held.generation !== authority.generation
    )
      throw new ServiceError(
        409,
        "This Story reservation expired. Refresh before beginning another encounter.",
      );
    const record = this.battles.records.get(
      progress.battleId,
      tokenActorUuid(authority.identity, authority.ownership.owner),
    );
    return this.battles.view(record);
  }
  move(
    actor: string,
    authority: OfficialAuthority,
    id: string,
    round: number,
    move: Move,
    now: number,
  ) {
    return this.store.transaction(() => {
      const battle = this.officialBattle(actor, authority, now, id);
      if (!battle)
        throw new ServiceError(409, "Begin your Story encounter first.");
      return this.battles.step(
        tokenActorUuid(authority.identity, authority.ownership.owner),
        id,
        round,
        move,
        authority,
      );
    });
  }
  /**
   * Compare a presented fresh binding against the row's stamped binding.
   * Adopts (stamps) on first official contact; legacy guest rows bind their
   * owner then. Returns the stamped binding when it disagrees so the caller
   * can interrupt the encounter instead of proceeding.
   */
  bindOrCheckOfficialOwnership(
    actor: string,
    presented: StoryOfficialBinding,
  ): { status: "ok" } | { status: "changed"; bound: StoryOfficialBinding } {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (!progress.official) {
        progress.official = officialBindingSchema.parse(presented);
        this.ledger.saveProgress(actor, progress);
        return { status: "ok" };
      }
      if (sameBinding(progress.official, presented)) return { status: "ok" };
      return { status: "changed", bound: progress.official };
    });
  }
  /**
   * Discard the open encounter without completion or reward. Completed
   * encounters and saved progress stay exactly where they are. Adopts the
   * fresh binding when provided so the new owner resumes from the last saved
   * step instead of sticking on the previous generation.
   */
  discardEncounter(actor: string, binding: StoryOfficialBinding | null = null) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      progress.battleId = null;
      progress.retry = false;
      if (binding) progress.official = officialBindingSchema.parse(binding);
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  state(actor: string) {
    return this.store.transaction(() =>
      this.present(this.ledger.loadProgress(actor)),
    );
  }
  choose(
    actor: string,
    fighter: CharacterId,
    access?: AccessGrant,
    nft = false,
  ) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (progress.step !== "meet")
        throw new ServiceError(409, "This chapter already has a fighter.");
      if (
        !nft &&
        !grantedFighter(fighter, access) &&
        !STORY_STARTERS.includes(fighter as (typeof STORY_STARTERS)[number])
      )
        throw new ServiceError(
          403,
          "The guest chapter uses the four starters.",
        );
      progress.fighter = fighter;
      progress.step = "scout";
      if (progress.journey) enterJourney(progress.journey, "shrine", "intro");
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  route(actor: string, route: StoryRoute, access?: AccessGrant) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (progress.step !== "route")
        throw new ServiceError(409, "The route choice is not open.");
      progress.route = route;
      progress.step = "path";
      if (progress.journey)
        enterJourney(
          progress.journey,
          route === "grove" ? "tracks" : "bridge",
          "crossroads",
        );
      if (progress.journey && access)
        bindInteraction(progress.journey, access, Date.now(), randomUUID());
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  begin(
    actor: string,
    now: number,
    official: {
      token: string;
      binding: StoryOfficialBinding;
      authority: OfficialAuthority | null;
    } | null = null,
    access?: AccessGrant,
    cosmetic = false,
  ) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (progress.journey && progress.journey.stage !== "battle")
        throw new ServiceError(
          409,
          "Finish the current interaction before entering combat.",
        );
      if (!progress.fighter)
        throw new ServiceError(409, "Choose a starter first.");
      if (official) {
        if (
          progress.official &&
          !sameBinding(progress.official, official.binding)
        )
          throw new ServiceError(
            409,
            "This chapter is bound to another ownership generation. Verify first.",
          );
        progress.official = officialBindingSchema.parse(official.binding);
      }
      const encounter = storyEncounter(
        progress.fighter,
        progress.step,
        progress.route,
      );
      if (!encounter)
        throw new ServiceError(
          409,
          "This part of the chapter is not a battle.",
        );
      const battleActor = official
        ? tokenActorUuid(official.binding.identity, official.binding.owner)
        : actor;
      if (progress.battleId) {
        const existing = this.battles.records.get(
          progress.battleId,
          battleActor,
        );
        if (!existing.state.outcome) {
          // An unfinished battle from a previous ownership generation is
          // never resumed: its lock is released, it stays orphaned, and a
          // fresh encounter opens below.
          const stale =
            official &&
            (!existing.authority ||
              existing.authority.generation !== official.binding.generation ||
              existing.authority.ownership.owner !== official.binding.owner);
          if (stale && official)
            this.locks.release(official.token, progress.battleId);
          if (!stale) {
            if (official) {
              const held = this.locks.get(official.token, now);
              if (
                !held ||
                held.encounter !== progress.battleId ||
                held.generation !== official.binding.generation
              )
                throw new ServiceError(
                  409,
                  "This Story reservation expired. Refresh to start another encounter.",
                );
              /* The opening expiry is absolute; refresh never extends it. */
            }
            return {
              ...this.present(progress),
              battleId: existing.id,
              battle: this.battles.view(existing),
            };
          }
        }
      }
      const id = randomUUID();
      if (official)
        this.locks.ensure({
          token: official.token,
          encounter: id,
          kind: "story",
          owner: official.binding.owner,
          generation: official.binding.generation,
          openedAt: now,
          expiresAt: now + STORY_RESERVATION_TTL_MS,
        });
      const battle = this.battles.start({
        actor: battleActor,
        id: id,
        player: progress.fighter,
        opponent: encounter.opponent,
        authority: official?.authority ?? null,
        difficulty: encounter.difficulty,
        arenaChoice: encounter.arena,
        origin: "story",
        access,
        cosmetic,
      });
      progress.battleId = id;
      progress.retry = false;
      progress.interruption = null;
      progress.unavailableSince = null;
      this.ledger.saveProgress(actor, progress);
      return {
        ...this.present(progress),
        battleId: id,
        battle,
        startedAt: now,
      };
    });
  }
  /**
   * Advance only from the stored battle.
   * The same winning battle cannot move the chapter twice.
   */
  resolve(
    actor: string,
    battleId: string,
    token: string | null = null,
    now: number = Date.now(),
  ) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (progress.battleId !== battleId) return this.present(progress);
      const battleActor = progress.official
        ? tokenActorUuid(progress.official.identity, progress.official.owner)
        : actor;
      const battle = this.battles.records.get(battleId, battleActor);
      if (!battle.state.outcome) return this.present(progress);
      if (battle.state.outcome !== "victory") {
        progress.battleId = null;
        progress.retry = true;
        this.ledger.saveProgress(actor, progress);
        if (token) this.locks.release(token, battleId);
        return { ...this.present(progress), lost: true };
      }
      const encounter = storyEncounter(
        progress.fighter ?? battle.snapshot.player.id,
        progress.step,
        progress.route,
      );
      if (
        !encounter ||
        battle.snapshot.player.id !== progress.fighter ||
        battle.snapshot.opponent.id !== encounter.opponent ||
        battle.arena !== encounter.arena ||
        (battle.snapshot.policy === "combat-opponent/2" &&
          battle.snapshot.difficulty !== encounter.difficulty)
      )
        throw new ServiceError(409, "That battle is not this encounter.");
      progress.battleId = null;
      const finishedStep = progress.step;
      progress.step = nextStep(progress.step);
      if (progress.journey) {
        const stage =
          progress.step === "route"
            ? "crossroads"
            : progress.step === "guardian"
              ? "vow"
              : progress.step === "ending"
                ? "ending"
                : "battle";
        enterJourney(progress.journey, stage, finishedStep);
      }
      if (progress.official)
        this.tokenRecords.write({
          token: tokenKey(progress.official.identity),
          kind: "story-encounter",
          source: battle.id,
          headline: "Encounter complete",
          explanation: encounter.objective,
          fighter: character(battle.snapshot.player.id).name,
          opponent: null,
          opponentFighter: character(battle.snapshot.opponent.id).name,
          arena: battle.arena ?? null,
          rounds: battle.rounds.length,
          score: null,
          route: progress.route,
          owner: progress.official.owner,
          generation: progress.official.generation,
          recordedAt: now,
          rules: `${STORY_POLICY}+${battle.snapshot.policy}`,
          eligibleForPublication: true,
        });
      let completedNow = false;
      if (progress.step === "ending" && !progress.completionId) {
        progress.completed = true;
        progress.completionId = randomUUID();
        completedNow = true;
      }
      if (progress.step === "ending") this.archiveRun(actor, progress, now);
      this.ledger.saveProgress(actor, progress);
      // A completed official chapter lands in the token's public record once.
      // Guest rows and replays (same completion id) never write here.
      if (completedNow && progress.official && progress.completionId) {
        this.tokenRecords.write({
          token: tokenKey(progress.official.identity),
          kind: "story",
          rules: STORY_POLICY,
          eligibleForPublication: true,
          source: progress.completionId,
          headline: "Chapter complete",
          explanation: "Completed The Fractured Sanctuary.",
          fighter: progress.fighter ? character(progress.fighter).name : null,
          opponent: null,
          opponentFighter: null,
          arena: null,
          rounds: null,
          score: null,
          route: progress.route,
          owner: progress.official.owner,
          generation: progress.official.generation,
          recordedAt: now,
        });
      }
      if (token) this.locks.release(token, battleId);
      return this.present(progress);
    });
  }
  replay(actor: string, token: string | null = null) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (!progress.completed)
        throw new ServiceError(409, "Finish the chapter before replaying it.");
      if (progress.battleId) {
        const battleActor = progress.official
          ? tokenActorUuid(progress.official.identity, progress.official.owner)
          : actor;
        this.battles.interrupt(progress.battleId, battleActor, "cancelled");
        if (token) this.locks.release(token, progress.battleId);
      }
      const kept = progress.completionId;
      const next = freshProgress();
      next.completed = true;
      next.completionId = kept;
      this.ledger.saveProgress(actor, next);
      return this.present(next);
    });
  }
  private present(progress: StoryProgress): StoryState {
    const encounter =
      progress.fighter &&
      (!progress.journey || progress.journey.stage === "battle")
        ? storyEncounter(progress.fighter, progress.step, progress.route)
        : null;
    return {
      policy: progress.policy,
      journey: progress.journey
        ? {
            ...progress.journey,
            interaction: progress.journey.interaction
              ? { expiresAt: progress.journey.interaction.expiresAt }
              : null,
          }
        : null,
      step: progress.step,
      fighter: progress.fighter,
      route: progress.route,
      battleId: progress.battleId,
      completed: progress.completed,
      lost: progress.retry,
      interruption: progress.interruption,
      completionId: progress.completionId,
      encounter: encounter
        ? {
            opponent: encounter.opponent,
            difficulty: encounter.difficulty,
            arena: encounter.arena,
            objective: encounter.objective,
          }
        : null,
    };
  }
  interactionAccess(actor: string, now: number): AccessGrant | null {
    const active = this.ledger.loadProgress(actor).journey?.interaction;
    return active && active.expiresAt > now ? active.access : null;
  }
  interactionOpen(actor: string, now: number) {
    const active = this.ledger.loadProgress(actor).journey?.interaction;
    return !!active && active.expiresAt > now;
  }
  dialogue(actor: string) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor),
        journey = progress.journey;
      if (journey) {
        const key = `${journey.stage}:${progress.step}`;
        if (!journey.viewed.includes(key)) journey.viewed.push(key);
        this.ledger.saveProgress(actor, progress);
      }
      return this.present(progress);
    });
  }
  vow(actor: string, choice: "restore" | "preserve", access?: AccessGrant) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor),
        journey = progress.journey;
      if (!journey || journey.stage !== "vow")
        throw new ServiceError(409, "This decision is not available here.");
      journey.vow = choice;
      enterJourney(journey, "seal", "vow");
      if (access) bindInteraction(journey, access, Date.now(), randomUUID());
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  side(actor: string, access?: AccessGrant) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor),
        journey = progress.journey;
      if (
        !journey ||
        progress.step !== "ending" ||
        journey.stage !== "ending" ||
        journey.sideComplete
      )
        throw new ServiceError(
          409,
          "The optional encounter is not available here.",
        );
      enterJourney(journey, "side");
      if (access) bindInteraction(journey, access, Date.now(), randomUUID());
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  leaveSide(actor: string) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor);
      if (!progress.journey || progress.journey.stage !== "side")
        throw new ServiceError(409, "No optional encounter is active.");
      enterJourney(progress.journey, "ending");
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  interact(
    actor: string,
    action: string,
    now: number,
    admission: AccessGrant | null = null,
  ) {
    return this.store.transaction(() => {
      const progress = this.ledger.loadProgress(actor),
        journey = progress.journey;
      if (!journey || !progress.fighter)
        throw new ServiceError(409, "Choose your fighter first.");
      if (!journey.interaction || journey.interaction.expiresAt <= now)
        bindInteraction(journey, admission, now, randomUUID());
      let solved = false;
      try {
        solved = interactJourney(journey, progress.fighter, action);
      } catch (error) {
        if (error instanceof JourneyActionError)
          throw new ServiceError(409, error.message, undefined, {
            cause: error,
          });
        throw error;
      }
      if (solved) {
        const location = journey.stage;
        if (location === "side") {
          journey.sideComplete = true;
          enterJourney(journey, "ending", "side");
          this.reward(
            actor,
            progress,
            "echo-keeper",
            "Keeper of the Echo",
            now,
          );
          this.archiveRun(actor, progress, now);
        } else enterJourney(journey, "battle", location);
      }
      this.ledger.saveProgress(actor, progress);
      return this.present(progress);
    });
  }
  rewards(actor: string) {
    return this.ledger.rewards(
      actor,
      this.ledger.loadProgress(actor).official?.owner,
    );
  }
  runs(actor: string) {
    return this.ledger.runs(actor);
  }
  private reward(
    actor: string,
    progress: StoryProgress,
    key: string,
    title: string,
    now: number,
  ) {
    this.ledger.award(actor, progress.official?.owner, key, title, now);
  }
  private archiveRun(actor: string, progress: StoryProgress, now: number) {
    if (progress.journey)
      this.ledger.archive(
        actor,
        progress.journey,
        progress.route,
        progress.official?.owner,
        now,
      );
  }
}

function nextStep(step: StoryStep): StoryStep {
  if (step === "scout") return "route";
  if (step === "path") return "guardian";
  if (step === "guardian") return "boss";
  if (step === "boss") return "ending";
  return step;
}
