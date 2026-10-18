import { otherSeat, type PvpResult, type SeatId } from "./types";

interface DeadlineEvidence {
  missed: readonly SeatId[];
  nextMisses: Readonly<Record<SeatId, number>>;
  guardAllowed: Readonly<Record<SeatId, boolean>>;
  missedTurnLimit: number;
}

/** A deadline is late at the exact timestamp; one millisecond earlier is not. */
export function isLate(now: number, deadlineAt: number): boolean {
  return now >= deadlineAt;
}

/** Decide terminal timeouts before substituting Guard; this never mutates a room. */
export function timeoutResult(evidence: DeadlineEvidence): PvpResult | null {
  const forfeits = evidence.missed.filter(
    (seat) => evidence.nextMisses[seat] >= evidence.missedTurnLimit,
  );
  if (forfeits.length === 2)
    return {
      kind: "abandoned",
      winner: null,
      explanation:
        "Both fighters missed two turns in a row, so the match is a no contest.",
    };
  if (forfeits.length === 1)
    return {
      kind: "forfeit",
      winner: otherSeat(forfeits[0]),
      explanation: "Two missed turns in a row forfeited the match.",
    };
  const blocked = evidence.missed.filter(
    (seat) => !evidence.guardAllowed[seat],
  );
  if (blocked.length === 2)
    return {
      kind: "abandoned",
      winner: null,
      explanation:
        "Neither fighter had a legal Guard when the turn expired, so the match is a no contest.",
    };
  if (blocked.length === 1)
    return {
      kind: "forfeit",
      winner: otherSeat(blocked[0]),
      explanation:
        "A turn expired and Guard was not legal, so that fighter forfeited.",
    };
  return null;
}
