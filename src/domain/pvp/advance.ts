import type { ArenaId } from "../combat/arenas";
import type { CombatSnapshot, Move, Side } from "../combat/contracts";
import { CombatError, initialCombat, resolveRound } from "../combat/engine";
import { legalMoves } from "../combat/moves";
import { PvpError } from "./errors";
import {
  otherSeat,
  seatIds,
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

function complete(room: PvpRoom, result: PvpResult) {
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

function endWithoutRound(room: PvpRoom, result: PvpResult) {
  complete(room, result);
}

function resolveDeadline(room: PvpRoom) {
  const match = room.match;
  if (!match || !room.seats.a || !room.seats.b) return;
  const due = match.deadlineAt;
  const round = match.state.round;
  const missed = seatIds.filter((seat) => match.locks[seat]?.round !== round);
  const nextMiss = (seat: SeatId) =>
    missed.includes(seat) ? room.seats[seat]!.misses + 1 : 0;
  const forfeits = missed.filter(
    (seat) => nextMiss(seat) >= room.timers.missedTurns,
  );
  if (forfeits.length >= 2) {
    endWithoutRound(room, {
      kind: "abandoned",
      winner: null,
      explanation:
        "Both fighters missed two turns in a row, so the match is a no contest.",
    });
    return;
  }
  if (forfeits.length === 1) {
    endWithoutRound(room, {
      kind: "forfeit",
      winner: otherSeat(forfeits[0]),
      explanation: "Two missed turns in a row forfeited the match.",
    });
    return;
  }
  const blocked = missed.filter((seat) => !guardLegal(match, seat));
  if (blocked.length >= 2) {
    endWithoutRound(room, {
      kind: "abandoned",
      winner: null,
      explanation:
        "Neither fighter had a legal Guard when the turn expired, so the match is a no contest.",
    });
    return;
  }
  if (blocked.length === 1) {
    endWithoutRound(room, {
      kind: "forfeit",
      winner: otherSeat(blocked[0]),
      explanation:
        "A turn expired and Guard was not legal, so that fighter forfeited.",
    });
    return;
  }
  for (const seat of seatIds) {
    const person = room.seats[seat];
    if (!person) continue;
    person.misses = nextMiss(seat);
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

function applyDeadline(room: PvpRoom, now: number) {
  const match = room.match;
  if (!match || match.phase === "complete" || now < match.deadlineAt)
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
    if (!applyDeadline(room, now)) return moved ? room : original;
    moved = true;
  }
  if (
    room.match &&
    room.match.phase !== "complete" &&
    room.match.deadlineAt <= now
  ) {
    endWithoutRound(room, {
      kind: "abandoned",
      winner: null,
      explanation: "The match timed out while catching up.",
    });
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
  };
  for (const seat of seatIds) {
    const sitting = room.seats[seat];
    if (!sitting) continue;
    sitting.assetsReady = false;
    sitting.misses = 0;
    sitting.rematch = false;
  }
  room.revision += 1;
}
