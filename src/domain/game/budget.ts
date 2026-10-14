import type { GameState } from "./contracts";

export function enforceBudget(state: GameState): void {
  if (state.alarm >= 3) {
    state.outcome = "trapped";
    state.message =
      "Three alarms. The museum promotes you to permanent exhibit.";
  } else if (state.turns <= 0 && !state.outcome) {
    state.outcome = "trapped";
    state.message =
      "Closing time. Your sandwich heist is now an overnight residency.";
  }
}
