import type { ArenaId } from "../combat/arenas";
import type { CombatSnapshot, Move, Side } from "../combat/contracts";
import { pvpSnapshot } from "../combat/definitions";
import { CombatError, initialCombat, resolveRound } from "../combat/engine";
import { legalMoves } from "../combat/moves";
import { character } from "../characters/definitions";
import { PvpError } from "./errors";
import { isLate, timeoutResult } from "./deadline";
import { armBattle, derivedId, noteSeries } from "./series";
import {
  seatIds,
  SERIES_MAX_BATTLES,
  type PvpMatch,
  type PvpResult,
  type PvpRoom,
  type SeatId,
} from "./types";

function sideOf(seat: SeatId): Side {
  return seat === "a" ? "player" : "opponent";
}

function finishEngine(match: PvpMatch) {
  const state = match.state;
  const knocked = !state.player.health || !state.opponent.health;
  const both = !state.player.health && !state.opponent.health;
  match.phase = "complete";
  match.locks = { a: null, b: null };
  match.result = {
    kind: knocked ? "knockout" : "time",
    winner: both
      ? null
      : state.outcome === "victory"
        ? "a"
        : state.outcome === "defeat"
          ? "b"
          : null,
    explanation: both
      ? "Both fighters were knocked out."
      : knocked
        ? "A fighter was knocked out."
        : "The round limit ended in a draw.",
  };
}

function complete(room: PvpRoom, result: PvpResult, now: number) {
  const match = room.match;
  if (!match) return;
  match.phase = "complete";
  match.result = result;
  match.locks = { a: null, b: null };
  if (result.kind === "forfeit" && result.winner)
    match.state = {
      ...match.state,
      outcome: result.winner === "a" ? "victory" : "defeat",
    };
  room.revision += 1;
  noteSeries(room, now);
}

export function commitRound(
  room: PvpRoom,
  player: Move,
  opponent: Move,
  reason: string,
  presentFrom: number,
) {
  const match = room.match;
  if (!match) return;
  try {
    const resolved = resolveRound(
      match.snapshot,
      match.state,
      player,
      opponent,
      reason,
    );
    match.rounds.push(resolved.round);
    match.state = resolved.state;
    match.eventSeq += resolved.round.events.length;
    match.locks = { a: null, b: null };
    if (resolved.state.outcome) finishEngine(match);
    else {
      match.phase = "present";
      match.deadlineAt = presentFrom + room.timers.presentMs;
    }
    room.revision += 1;
    noteSeries(room, presentFrom);
  } catch (error) {
    if (error instanceof CombatError) throw new PvpError(422, error.message);
    throw error;
  }
}

function guardLegal(match: PvpMatch, seat: SeatId) {
  return legalMoves(match.snapshot, match.state, sideOf(seat)).includes(
    "guard",
  );
}

function resolveDeadline(room: PvpRoom) {
  const match = room.match;
  if (!match || !room.seats.a || !room.seats.b) return;
  const due = match.deadlineAt;
  const round = match.state.round;
  const missed = seatIds.filter((seat) => match.locks[seat]?.round !== round);
  const nextMisses = {
    a: missed.includes("a") ? room.seats.a.misses + 1 : 0,
    b: missed.includes("b") ? room.seats.b.misses + 1 : 0,
  };
  const terminal = timeoutResult({
    missed,
    nextMisses,
    guardAllowed: { a: guardLegal(match, "a"), b: guardLegal(match, "b") },
    missedTurnLimit: room.timers.missedTurns,
  });
  if (terminal) {
    complete(room, terminal, due);
    return;
  }
  for (const seat of seatIds) {
    const person = room.seats[seat];
    if (!person) continue;
    person.misses = nextMisses[seat];
    if (missed.includes(seat)) match.locks[seat] = { round, move: "guard" };
  }
  const player = match.locks.a;
  const opponent = match.locks.b;
  if (!player || !opponent) return;
  const reason =
    missed.length >= 2
      ? "Both missed turns used Guard."
      : missed.length === 1
        ? "A missed turn used Guard."
        : "Both moves were locked.";
  commitRound(room, player.move, opponent.move, reason, due);
}

function startChoose(room: PvpRoom) {
  const match = room.match;
  if (!match) return;
  const from = match.deadlineAt;
  match.phase = "choose";
  match.deadlineAt = from + room.timers.moveMs;
  match.locks = { a: null, b: null };
  room.revision += 1;
}

function applySeriesClock(room: PvpRoom, now: number) {
  const series = room.series;
  if (!series || series.phase !== "intermission" || series.deadlineAt === null)
    return false;
  if (!isLate(now, series.deadlineAt)) return false;
  return openNextBattle(room, series.deadlineAt);
}

function applyDeadline(room: PvpRoom, now: number) {
  const match = room.match;
  if (!match || match.phase === "complete" || !isLate(now, match.deadlineAt))
    return false;
  if (match.phase === "choose") resolveDeadline(room);
  else startChoose(room);
  return true;
}

/** Apply every deadline that has already passed. No in-memory timer is required. */
export function advanceRoom(original: PvpRoom, now: number): PvpRoom {
  const room = structuredClone(original);
  let moved = false;
  for (let step = 0; step < 48; step += 1) {
    const deadlineMoved = applyDeadline(room, now);
    const seriesMoved = applySeriesClock(room, now);
    if (!deadlineMoved && !seriesMoved) return moved ? room : original;
    moved = true;
  }
  if (
    room.match &&
    room.match.phase !== "complete" &&
    isLate(now, room.match.deadlineAt)
  ) {
    complete(
      room,
      {
        kind: "abandoned",
        winner: null,
        explanation: "The match timed out while catching up.",
      },
      now,
    );
  }
  return room;
}

export function openMatch(
  room: PvpRoom,
  now: number,
  input: {
    id: string;
    rematchOf: string | null;
    arena: ArenaId;
    snapshot: CombatSnapshot;
  },
) {
  room.match = {
    id: input.id,
    rematchOf: input.rematchOf,
    createdAt: now,
    arena: input.arena,
    snapshot: input.snapshot,
    state: initialCombat(input.snapshot),
    rounds: [],
    eventSeq: 0,
    locks: { a: null, b: null },
    phase: "loading",
    deadlineAt: now + room.timers.loadingMs,
    result: null,
    participants: {
      a:
        room.seats.a?.mode === "official"
          ? structuredClone(room.seats.a.holderGrant)
          : null,
      b:
        room.seats.b?.mode === "official"
          ? structuredClone(room.seats.b.holderGrant)
          : null,
    },
  };
  for (const seat of seatIds) {
    const sitting = room.seats[seat];
    if (!sitting) continue;
    sitting.assetsReady = false;
    sitting.misses = 0;
    sitting.rematch = false;
    sitting.notice = null;
  }
  room.revision += 1;
  if (room.series && room.match) {
    room.series.participants ??= structuredClone(room.match.participants);
    armBattle(room.series, room.match.id);
  }
}

export function holderIntermission(room: PvpRoom): boolean {
  return (
    room.series?.phase === "intermission" &&
    !!room.match &&
    [room.match.snapshot.player.id, room.match.snapshot.opponent.id].some(
      (id) => character(id).access === "holder",
    )
  );
}

export function openNextBattle(
  room: PvpRoom,
  now: number,
  holdersCleared = false,
): boolean {
  const series = room.series;
  const previous = room.match;
  if (!series || series.phase !== "intermission" || !previous) return false;
  if (holderIntermission(room) && !holdersCleared) return false;
  const battleNumber = series.battleNumber + 1;
  if (battleNumber > SERIES_MAX_BATTLES) return false;
  const nextId = derivedId(`${series.id}:${battleNumber}`);
  openMatch(room, now, {
    id: nextId,
    rematchOf: previous.id,
    arena: previous.arena,
    snapshot: pvpSnapshot(
      previous.snapshot.player.id,
      previous.snapshot.opponent.id,
      previous.snapshot.tie,
    ),
  });
  series.battleNumber = battleNumber;
  return true;
}

export function forfeitSeries(room: PvpRoom, winner: SeatId, now: number) {
  const series = room.series;
  if (!series || series.phase === "setup" || series.phase === "complete")
    throw new PvpError(409, "There is no series to surrender.");
  if (series.phase === "intermission") {
    series.phase = "complete";
    series.deadlineAt = null;
    series.outcome = {
      kind: "forfeit",
      winner,
      explanation: "A player surrendered the series.",
    };
    room.revision += 1;
    return;
  }
  if (room.match && room.match.phase !== "complete")
    complete(
      room,
      {
        kind: "forfeit",
        winner,
        explanation: "A player surrendered the series.",
      },
      now,
    );
}
