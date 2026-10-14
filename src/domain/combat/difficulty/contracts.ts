import type { Move } from "../contracts";
export interface CompletedChoices {
  player: Move;
  opponent: Move;
}
export interface OpponentChoice {
  move: Move;
  reason: string;
}

export function difficultyLabel(
  snapshot: import("../contracts").CombatSnapshot,
) {
  if (snapshot.policy === "combat-opponent/1") return "Legacy policy";
  if (snapshot.policy === "combat-pvp/1") return "Friend battle";
  return snapshot.difficulty[0].toUpperCase() + snapshot.difficulty.slice(1);
}
