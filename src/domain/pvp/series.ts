import { createHash } from "node:crypto";
import type { PvpResult, PvpRoom, PvpSeries, SeatId } from "./types";
import { SERIES_POLICY } from "./types";

export const SERIES_TARGET = 2;
export const SERIES_DRAW_LIMIT = 2;
export const QUEUE_ACCEPT_MS = 20_000;
export const QUEUE_WAIT_MS = 180_000;
export const QUEUE_DECLINE_LIMIT = 3;
export const QUEUE_LOCK_MS = 60_000;
export const PUBLIC_SELECT_MS = 90_000;

/** Stable id for a later battle in the same series. A repeat request hits the same row. */
export function derivedId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function freshSeries(id: string): PvpSeries {
  return {
    policy: SERIES_POLICY,
    id,
    battleNumber: 1,
    wins: { a: 0, b: 0 },
    consecutiveDraws: 0,
    phase: "setup",
    currentMatchId: null,
    recorded: [],
    deadlineAt: null,
    outcome: null,
  };
}

export function armBattle(series: PvpSeries, matchId: string) {
  if (series.phase === "complete") return;
  series.phase = "battle";
  series.currentMatchId = matchId;
  series.deadlineAt = null;
}

function endSeries(
  series: PvpSeries,
  outcome: NonNullable<PvpSeries["outcome"]>,
) {
  series.phase = "complete";
  series.deadlineAt = null;
  series.outcome = outcome;
}

/**
 * Record a completed battle once.
 * A draw awards no win. Two consecutive draws end the series.
 * A forfeit or mutual abandonment ends the series immediately.
 */
export function noteSeries(room: PvpRoom, now: number) {
  const series = room.series;
  const match = room.match;
  if (!series || !match?.result || series.phase === "complete") return;
  if (series.phase === "setup") return;
  if (series.recorded.includes(match.id)) return;
  series.recorded.push(match.id);
  const result = match.result;
  if (result.kind === "forfeit" && result.winner) {
    endSeries(series, {
      kind: "forfeit",
      winner: result.winner,
      explanation: "A forfeited battle ended the series.",
    });
    return;
  }
  if (result.kind === "abandoned") {
    endSeries(series, {
      kind: "abandoned",
      winner: null,
      explanation:
        "Both players left the battle, so the series is a no contest.",
    });
    return;
  }
  if (result.winner) {
    series.wins[result.winner] += 1;
    series.consecutiveDraws = 0;
    if (series.wins[result.winner] >= SERIES_TARGET) {
      endSeries(series, {
        kind: "win",
        winner: result.winner,
        explanation: "First to two battle wins.",
      });
      return;
    }
  } else {
    series.consecutiveDraws += 1;
    if (series.consecutiveDraws >= SERIES_DRAW_LIMIT) {
      endSeries(series, {
        kind: "draw",
        winner: null,
        explanation: "Two drawn battles in a row ended the series as a draw.",
      });
      return;
    }
  }
  series.phase = "intermission";
  series.deadlineAt = now + room.timers.intermissionMs;
  for (const seat of ["a", "b"] as const) {
    const sitting = room.seats[seat];
    if (sitting) sitting.ready = false;
  }
}

export function seriesWinner(result: PvpResult | null): SeatId | null {
  return result?.winner ?? null;
}
