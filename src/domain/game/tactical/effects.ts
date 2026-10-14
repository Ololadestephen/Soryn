import type { Action, BasicAction, GameState } from "../contracts";
import { tacticsFor } from "./contracts";
function shieldable(state: GameState, action: BasicAction): boolean {
  const t = tacticsFor(state);
  return (
    action === "door" ||
    (state.room === 1 &&
      action === "sneak" &&
      state.patrol === "watching" &&
      !state.distracted &&
      !t.effects.trail)
  );
}
export function protections(
  previous: GameState,
  next: GameState,
  action: BasicAction,
): void {
  const t = tacticsFor(previous);
  if (t.effects.bubble && shieldable(previous, action)) {
    next.outcome = null;
    next.alarm = previous.alarm;
    t.effects.bubble = false;
    next.message =
      "Safety Bubble absorbed the impact. You stay in this room, one turn wiser. The bubble is gone.";
  }
  if (action === "take" && (t.effects.steady || t.effects.reroute)) {
    next.alarm = previous.alarm;
    next.outcome = null;
    next.message = t.effects.steady
      ? "Steady Hands: sandwich acquired without waking the pressure plate. Now find the exit."
      : "Reroute: sandwich acquired while the pressure plate is disabled. Escape still requires the exit.";
  }
  if (next.sandwich && !previous.sandwich) t.effects.steady = false;
}
export function advanceEffects(
  previous: GameState,
  state: GameState,
  action: Action,
  cost: number,
): void {
  const before = tacticsFor(previous),
    t = tacticsFor(state);
  if (previous.room === 1 && cost > 0 && action.startsWith("skill-"))
    state.patrol = previous.patrol === "watching" ? "reading" : "watching";
  if (cost > 0 && before.effects.reroute) t.effects.reroute = false;
  if (state.room !== previous.room) {
    t.mechanismKnown = false;
    t.effects = { bubble: false, trail: 0, steady: false, reroute: false };
  } else if (previous.room === 1 && cost > 0)
    t.effects.trail = Math.max(0, t.effects.trail - cost);
}
export function eventKind(
  previous: GameState,
  state: GameState,
  action: Action,
) {
  if (action.startsWith("commit-")) return "commit" as const;
  if (action === "skill-second-thought") return "cancel" as const;
  if (action.startsWith("skill-")) return "skill" as const;
  return state.room !== previous.room
    ? ("move" as const)
    : ("interact" as const);
}
