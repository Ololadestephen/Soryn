import {
  character,
  type CharacterId,
} from "../../domain/characters/definitions";
import {
  combatSnapshot,
  difficultySnapshot,
  fighter,
} from "../../domain/combat/definitions";
import {
  type BattleSession,
  type BattleView,
  type Move,
  type Difficulty,
} from "../../domain/combat/contracts";
import {
  initialCombat,
  resolveRound,
  CombatError,
} from "../../domain/combat/engine";
import { legalMoves } from "../../domain/combat/moves";
import { chooseOpponent } from "../../domain/combat/policy";
import {
  tokenKey,
  type TokenIdentity,
  type OfficialAuthority,
} from "../../domain/identity";
import { BattleStore, type BattleRecord } from "./persistence";
import { ServiceError } from "../errors";
import { randomInt } from "node:crypto";
import { arenaIds, type ArenaChoice } from "../../domain/combat/arenas";

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function verifyBattle(record: BattleRecord) {
  if (
    !same(record.snapshot.player, fighter(record.snapshot.player.id)) ||
    !same(record.snapshot.opponent, fighter(record.snapshot.opponent.id))
  )
    throw new ServiceError(503, "Frozen fighter definition mismatch.");
  let state = initialCombat(record.snapshot);
  for (const [index, round] of record.rounds.entries()) {
    const pending = chooseOpponent(
      record.snapshot,
      state,
      record.rounds.slice(0, index),
    );
    const replay = resolveRound(
      record.snapshot,
      state,
      round.player,
      pending.move,
      pending.reason,
    );
    if (!same(round, replay.round))
      throw new ServiceError(503, "Battle replay mismatch.");
    state = replay.state;
  }
  if (
    !same(state, record.state) ||
    !same(
      record.pending,
      state.outcome
        ? null
        : chooseOpponent(record.snapshot, state, record.rounds),
    )
  )
    throw new ServiceError(503, "Battle state or pending policy mismatch.");
}
export class BattleService {
  constructor(readonly records: BattleStore) {}
  view(record: BattleRecord): BattleView {
    verifyBattle(record);
    return {
      id: record.id,
      arena: record.arena ?? "sanctuary",
      mode: record.mode,
      tokenId: record.authority?.identity.tokenId ?? null,
      snapshot: record.snapshot,
      state: record.state,
      rounds: record.rounds,
      legal: legalMoves(record.snapshot, record.state, "player"),
    };
  }
  session(
    actor: string,
    mode: BattleRecord["mode"],
    scope?: { identity: TokenIdentity; generation: string | null },
  ): BattleSession {
    const history = this.records.history(actor, mode);
    const latest = history.find(
      (record) =>
        !scope ||
        (record.authority?.generation === scope.generation &&
          record.authority &&
          tokenKey(record.authority.identity) === tokenKey(scope.identity)),
    );
    return {
      battle: latest ? this.view(latest) : null,
      history: history
        .filter((record) => record.state.outcome)
        .map((record) => ({
          id: record.id,
          arena: record.arena ?? "sanctuary",
          fighter: character(record.snapshot.player.id).name,
          outcome: record.state.outcome!,
          rounds: record.rounds.length,
          difficulty:
            record.snapshot.policy === "combat-opponent/2"
              ? record.snapshot.difficulty
              : "legacy",
        })),
    };
  }
  private authorize(record: BattleRecord, authority: OfficialAuthority | null) {
    if (record.mode === "guest") {
      if (authority)
        throw new ServiceError(403, "Guest and official battles are separate.");
    } else if (
      !authority ||
      !record.authority ||
      record.authority.generation !== authority.generation ||
      tokenKey(record.authority.identity) !== tokenKey(authority.identity)
    )
      throw new ServiceError(
        403,
        "Battle needs its current ownership-generation grant.",
      );
  }
  start(
    actor: string,
    id: string,
    player: CharacterId,
    opponent: CharacterId,
    authority: OfficialAuthority | null = null,
    difficulty?: Difficulty,
    arenaChoice: ArenaChoice = "sanctuary",
  ) {
    return this.records.store.transaction(() => {
      if (!authority && character(player).access === "holder")
        throw new ServiceError(
          403,
          "Choose a starter for guest practice; holder fighters require verified ownership.",
        );
      const mode = authority ? "official" : "guest";
      if (this.records.find(id)) {
        const record = this.records.get(id, actor);
        this.authorize(record, authority);
        if (
          (record.arenaChoice ?? record.arena ?? "sanctuary") !== arenaChoice ||
          record.snapshot.player.id !== player ||
          record.snapshot.opponent.id !== opponent ||
          record.mode !== mode ||
          (record.snapshot.policy === "combat-opponent/2"
            ? record.snapshot.difficulty
            : undefined) !== difficulty
        )
          throw new ServiceError(
            409,
            "Battle ID already uses another loadout.",
          );
        return this.view(record);
      }
      const active = this.records
        .history(actor, mode)
        .find(
          (record) =>
            !record.state.outcome &&
            (mode === "guest" ||
              (record.authority?.generation === authority?.generation &&
                record.authority &&
                authority &&
                tokenKey(record.authority.identity) ===
                  tokenKey(authority.identity))),
        );
      if (active)
        throw new ServiceError(409, "Finish your active battle first.");
      const snapshot = difficulty
          ? difficultySnapshot(player, opponent, difficulty, 0)
          : combatSnapshot(player, opponent, 0),
        state = initialCombat(snapshot);
      const record: BattleRecord = {
        id,
        actor,
        mode,
        authority,
        snapshot,
        arenaChoice,
        arena:
          arenaChoice === "random"
            ? arenaIds[randomInt(arenaIds.length)]
            : arenaChoice,
        state,
        rounds: [],
        pending: chooseOpponent(snapshot, state),
      };
      this.records.save(record);
      return this.view(record);
    });
  }
  step(
    actor: string,
    id: string,
    round: number,
    move: Move,
    authority: OfficialAuthority | null = null,
  ) {
    return this.records.store.transaction(() => {
      const record = this.records.get(id, actor);
      this.authorize(record, authority);
      verifyBattle(record);
      const prior = record.rounds.find((entry) => entry.round === round);
      if (prior) {
        if (prior.player !== move)
          throw new ServiceError(
            409,
            "Round already resolved with another move.",
          );
        return this.view(record);
      }
      if (record.state.outcome || !record.pending)
        throw new ServiceError(422, "Battle is finished.");
      if (round !== record.state.round)
        throw new ServiceError(
          409,
          "Stale or future round; reload the battle.",
        );
      try {
        const result = resolveRound(
          record.snapshot,
          record.state,
          move,
          record.pending.move,
          record.pending.reason,
        );
        record.rounds.push(result.round);
        record.state = result.state;
        record.pending = result.state.outcome
          ? null
          : chooseOpponent(record.snapshot, result.state, record.rounds);
        this.records.save(record);
        return this.view(record);
      } catch (error) {
        if (error instanceof CombatError)
          throw new ServiceError(422, error.message);
        throw error;
      }
    });
  }
}
