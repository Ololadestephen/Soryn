import type { Move, CombatSnapshot, CombatState } from "../contracts";
import { legalMoves } from "../moves";
import type { CompletedChoices } from "./contracts";
export function playerDistribution(
  snapshot: CombatSnapshot,
  state: CombatState,
  completed: readonly CompletedChoices[],
) {
  const legal = legalMoves(snapshot, state, "player"),
    prior: Record<Move, number> = { basic: 0.5, special: 0.3, guard: 0.2 };
  const observed = completed.slice(-6),
    counts: Record<Move, number> = { basic: 1, special: 1, guard: 1 };
  for (const round of observed) counts[round.player]++;
  const weights = legal.map((move) => ({
    move,
    weight:
      observed.length >= 3
        ? 0.5 * prior[move] + (0.5 * counts[move]) / (observed.length + 3)
        : prior[move],
  }));
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  return weights.map((entry) => ({ ...entry, weight: entry.weight / total }));
}
