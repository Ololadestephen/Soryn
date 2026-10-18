import { PvpError } from "./errors";
import { seatIds, type PvpRoom, type SeatId } from "./types";

/**
 * Ownership-interruption policy for official play, pure room logic.
 *
 * A confirmed ownership change ends an open official series as a no contest:
 * no win is awarded, the interrupted battle is discarded, and completed
 * battles stay in the room history with their original attribution. A room
 * with no open series is closed instead. None of this inspects the chain;
 * callers establish the confirmed change (or the outage) first.
 */

/** A series left unverifiable this long is terminated instead of held open. */
export const OWNERSHIP_STALL_TERMINATE_MS = 3_600_000;

/** Official participation reservations expire this long after creation; play never renews them. */
export const TOKEN_LOCK_TTL_MS = 24 * 3_600_000;

/** A story encounter reservation expires this long after it opens. */
export const STORY_LOCK_TTL_MS = 2 * 3_600_000;
/** New series in the same room must never share a reservation identity. */
export function seriesReservation(room: PvpRoom): string {
  return room.series?.id ?? room.invite;
}

/** Matches the completed-history cap in actions.ts. */
const COMPLETED_KEEP = 40;

export interface OwnershipInterruption {
  kind: "no-contest" | "unavailable" | "expired";
  changedSeat: SeatId | null;
  observedOwner: string | null;
  observedGeneration: string | null;
  explanation: string;
}

/** End an open series as no contest, or close a room with no open series. */
export function endSeriesNoContest(
  room: PvpRoom,
  now: number,
  interruption: OwnershipInterruption,
): void {
  if (interruption.kind === "no-contest") {
    if (!room.series || room.series.phase === "complete")
      return closeRoomForTransfer(room, now, interruption.explanation);
    // A finished battle keeps its record and attribution. Only the
    // unfinished battle is discarded, unawarded.
    if (
      room.match?.phase === "complete" &&
      room.match.result &&
      !room.completed.some((match) => match.id === room.match!.id)
    ) {
      room.completed.push(room.match);
      if (room.completed.length > COMPLETED_KEEP)
        room.completed.splice(0, room.completed.length - COMPLETED_KEEP);
    }
    room.match = null;
    room.series.phase = "complete";
    room.series.deadlineAt = null;
    room.series.outcome = {
      kind: "no-contest",
      winner: null,
      explanation: interruption.explanation,
    };
    room.ownershipStallSince = null;
    room.revision += 1;
    return;
  }
  if (!room.series || room.series.phase === "complete")
    return closeRoomForTransfer(room, now, interruption.explanation);
  room.match = null;
  room.series.phase = "complete";
  room.series.deadlineAt = null;
  room.series.outcome = {
    kind: "abandoned",
    winner: null,
    explanation: interruption.explanation,
  };
  room.revision += 1;
}

/** Close a lobby or legacy room whose official seat can no longer be verified. */
export function closeRoomForTransfer(
  room: PvpRoom,
  now: number,
  explanation: string,
): void {
  if (room.closedAt) return;
  room.closedAt = now;
  room.match = null;
  for (const seat of seatIds) {
    const sitting = room.seats[seat];
    if (sitting && !sitting.notice) sitting.notice = explanation.slice(0, 160);
  }
  room.ownershipStallSince = null;
  room.revision += 1;
}

/** Official seats whose stamped grant can be checked against fresh evidence. */
export function verifiableSeats(room: PvpRoom): SeatId[] {
  return seatIds.filter((seat) => {
    const sitting = room.seats[seat];
    return !!sitting && sitting.mode === "official" && !!sitting.holderGrant;
  });
}

export function hasOfficialSeats(room: PvpRoom): boolean {
  return seatIds.some((seat) => room.seats[seat]?.mode === "official");
}

export function transferExplanation(): string {
  return (
    "The token's ownership or authorized generation changed, " +
    "so the series ends as no contest with no win awarded."
  ).slice(0, 200);
}

export function unavailableExplanation(): string {
  return (
    "Ownership verification is unavailable, so official play pauses here. " +
    "No result was recorded; retry when verification returns."
  ).slice(0, 200);
}

export function stallTerminatedExplanation(): string {
  return (
    "Ownership verification stayed unavailable past its bound, so the series " +
    "ends without a winner rather than staying open forever."
  ).slice(0, 200);
}

export function requireOfficialSeat(room: PvpRoom, actor: string): SeatId {
  const seat =
    room.seats.a?.actor === actor
      ? ("a" as const)
      : room.seats.b?.actor === actor
        ? ("b" as const)
        : null;
  if (!seat || room.seats[seat]?.mode !== "official")
    throw new PvpError(403, "This action needs a verified official seat.");
  return seat;
}
