import type { CharacterId } from "../characters/definitions";
import { character } from "../characters/definitions";
import type { ArenaChoice, ArenaId } from "../combat/arenas";
import { arenaIds } from "../combat/arenas";
import type { Move } from "../combat/contracts";
import { pvpSnapshot } from "../combat/definitions";
import { legalMoves } from "../combat/moves";
import { commitRound, openMatch } from "./advance";
import { PvpError } from "./errors";
import {
  invitationExpired,
  otherSeat,
  seatIds,
  seatOf,
  type PvpRoom,
  type PvpSeat,
  type SeatId,
} from "./types";

export interface SeatActor {
  actor: string;
  mode: "guest" | "official";
}

export function fighterAllowed(id: CharacterId, mode: SeatActor["mode"]) {
  return mode === "official" || character(id).access === "starter";
}

function mustSeat(room: PvpRoom, actor: string): SeatId {
  const seat = seatOf(room, actor);
  if (!seat) throw new PvpError(403, "You are not seated in this battle.");
  return seat;
}

function clearReady(room: PvpRoom) {
  for (const seat of seatIds) {
    const sitting = room.seats[seat];
    if (sitting) sitting.ready = false;
  }
}

export function joinRoom(
  room: PvpRoom,
  actor: SeatActor,
  now: number,
  name: string,
) {
  if (room.closedAt) throw new PvpError(409, "This room is closed.");
  if (invitationExpired(room, now))
    throw new PvpError(410, "This invitation has expired.");
  if (room.match) throw new PvpError(409, "This battle has already started.");
  if (seatOf(room, actor.actor)) return;
  if (room.seats.a && room.seats.b)
    throw new PvpError(409, "This room is full.");
  const seat: SeatId = room.seats.a ? "b" : "a";
  const sitting: PvpSeat = {
    actor: actor.actor,
    mode: actor.mode,
    name,
    joinedAt: now,
    lastSeenAt: now,
    characterId: null,
    ready: false,
    assetsReady: false,
    rematch: false,
    misses: 0,
    notice: null,
    holderGrant: null,
  };
  room.seats[seat] = sitting;
  room.revision += 1;
}

export function leaveSeat(room: PvpRoom, actor: string) {
  const seat = mustSeat(room, actor);
  if (room.match)
    throw new PvpError(
      409,
      "Leave is only available before the battle starts.",
    );
  room.seats[seat] = null;
  const remaining = room.seats[otherSeat(seat)];
  if (remaining) remaining.ready = false;
  room.revision += 1;
}

export function closeRoom(room: PvpRoom, actor: string, now: number) {
  mustSeat(room, actor);
  if (room.match) throw new PvpError(409, "The match has started.");
  if (room.closedAt) return;
  room.closedAt = now;
  room.revision += 1;
}

export function selectFighter(room: PvpRoom, actor: string, id: CharacterId) {
  const seat = mustSeat(room, actor);
  if (room.closedAt) throw new PvpError(409, "This room is closed.");
  if (room.match?.phase === "complete")
    throw new PvpError(409, "Return to setup before changing fighters.");
  if (room.match) throw new PvpError(409, "The match has started.");
  const sitting = room.seats[seat]!;
  if (!fighterAllowed(id, sitting.mode))
    throw new PvpError(
      403,
      "Holder fighters stay locked until ownership is verified.",
    );
  if (sitting.characterId === id) return;
  sitting.characterId = id;
  sitting.notice = null;
  clearReady(room);
  room.revision += 1;
}

export function chooseArena(room: PvpRoom, actor: string, choice: ArenaChoice) {
  mustSeat(room, actor);
  if (room.closedAt) throw new PvpError(409, "This room is closed.");
  if (room.match) throw new PvpError(409, "The match has started.");
  if (room.arenaChoice === choice) return;
  room.arenaChoice = choice;
  clearReady(room);
  room.revision += 1;
}

export function resolvedArena(
  choice: ArenaChoice,
  roll: () => ArenaId,
): ArenaId {
  return choice === "random" ? roll() : choice;
}

export function setReady(
  room: PvpRoom,
  actor: string,
  ready: boolean,
  now: number,
  next: { id: string; tie: 0 | 1; arenaRoll: () => ArenaId },
) {
  const seat = mustSeat(room, actor);
  if (room.closedAt) throw new PvpError(409, "This room is closed.");
  if (room.match) throw new PvpError(409, "The match has started.");
  const sitting = room.seats[seat]!;
  if (ready && !sitting.characterId)
    throw new PvpError(409, "Choose your fighter first.");
  if (sitting.ready === ready) return;
  sitting.ready = ready;
  room.revision += 1;
  const left = room.seats.a;
  const right = room.seats.b;
  if (
    !ready ||
    !left?.ready ||
    !right?.ready ||
    !left.characterId ||
    !right.characterId
  )
    return;
  if (
    !fighterAllowed(left.characterId, left.mode) ||
    !fighterAllowed(right.characterId, right.mode)
  )
    throw new PvpError(
      403,
      "Holder fighters stay locked until ownership is verified.",
    );
  openMatch(room, now, {
    id: next.id,
    rematchOf: room.rematchOf,
    arena: resolvedArena(room.arenaChoice, next.arenaRoll),
    snapshot: pvpSnapshot(left.characterId, right.characterId, next.tie),
  });
  room.rematchOf = null;
}

export function markAssets(room: PvpRoom, actor: string, now: number) {
  const seat = mustSeat(room, actor);
  const match = room.match;
  if (!match || match.phase !== "loading") return;
  const sitting = room.seats[seat]!;
  if (sitting.assetsReady) return;
  sitting.assetsReady = true;
  room.revision += 1;
  if (!room.seats.a?.assetsReady || !room.seats.b?.assetsReady) return;
  match.phase = "choose";
  match.deadlineAt = now + room.timers.moveMs;
  match.locks = { a: null, b: null };
  room.revision += 1;
}

export function submitMove(
  room: PvpRoom,
  actor: string,
  round: number,
  move: Move,
  now: number,
) {
  const seat = mustSeat(room, actor);
  const match = room.match;
  if (!match) throw new PvpError(409, "The battle has not started.");
  if (match.phase === "complete") throw new PvpError(409, "The match is over.");
  const prior = match.rounds.find((entry) => entry.round === round);
  if (prior) {
    const used = seat === "a" ? prior.player : prior.opponent;
    if (used !== move)
      throw new PvpError(409, "That round already used another move.");
    return;
  }
  if (match.phase !== "choose")
    throw new PvpError(409, "Wait for the next turn.");
  if (round !== match.state.round)
    throw new PvpError(409, "The round has already moved on.");
  const side = seat === "a" ? "player" : "opponent";
  if (!legalMoves(match.snapshot, match.state, side).includes(move))
    throw new PvpError(422, "That move isn't available.");
  const existing = match.locks[seat];
  if (existing?.round === round) {
    if (existing.move !== move) throw new PvpError(409, "Move already locked.");
    return;
  }
  match.locks[seat] = { round, move };
  room.seats[seat]!.misses = 0;
  room.revision += 1;
  if (match.locks.a?.round === round && match.locks.b?.round === round)
    commitRound(
      room,
      match.locks.a.move,
      match.locks.b.move,
      "Both moves were locked.",
      now,
    );
}

const COMPLETED_KEEP = 40;

function archiveMatch(room: PvpRoom) {
  const match = room.match;
  if (!match) return null;
  if (match.phase !== "complete")
    throw new PvpError(409, "The match has started.");
  room.completed.push(match);
  if (room.completed.length > COMPLETED_KEEP)
    room.completed.splice(0, room.completed.length - COMPLETED_KEEP);
  room.match = null;
  return match.id;
}

function clearForSetup(room: PvpRoom) {
  for (const seat of seatIds) {
    const sitting = room.seats[seat];
    if (!sitting) continue;
    sitting.ready = false;
    sitting.rematch = false;
    sitting.assetsReady = false;
    sitting.misses = 0;
    if (
      sitting.characterId &&
      !fighterAllowed(sitting.characterId, sitting.mode)
    ) {
      sitting.characterId = null;
      sitting.notice =
        "That fighter needs verified ownership, so the choice was cleared.";
    }
  }
}

export function returnToSetup(room: PvpRoom, actor: string) {
  mustSeat(room, actor);
  archiveMatch(room);
  clearForSetup(room);
  room.rematchOf = null;
  room.revision += 1;
}

export function requestRematch(room: PvpRoom, actor: string) {
  const seat = mustSeat(room, actor);
  const match = room.match;
  if (!match || match.phase !== "complete")
    throw new PvpError(409, "Finish the battle before a rematch.");
  const sitting = room.seats[seat]!;
  if (!sitting.rematch) {
    sitting.rematch = true;
    room.revision += 1;
  }
  if (!room.seats.a?.rematch || !room.seats.b?.rematch) return;
  const previous = archiveMatch(room);
  clearForSetup(room);
  room.rematchOf = previous;
  room.revision += 1;
}

export function arenaRoll(random: () => number): ArenaId {
  const index = Math.min(
    arenaIds.length - 1,
    Math.floor(random() * arenaIds.length),
  );
  return arenaIds[index] ?? "sanctuary";
}
