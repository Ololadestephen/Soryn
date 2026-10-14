import type { CombatSnapshot, CombatState, Move } from "../contracts";
import { resolveRound } from "../engine";
import { legalMoves } from "../moves";
import { playerDistribution } from "./distribution";
import type { CompletedChoices, OpponentChoice } from "./contracts";

export function tacticalValue(before: CombatState, after: CombatState) {
  const self = after.opponent,
    foe = after.player,
    prior = before.opponent;
  let value =
    (self.health - prior.health) * 1.4 + (before.player.health - foe.health);
  if (after.outcome === "defeat") value += 140;
  if (after.outcome === "victory") value -= 180;
  if (after.outcome === "draw") value -= 8;
  value += (self.energy - prior.energy) * 1.5 - self.cooldown * 0.8;
  value +=
    foe.effects.exposed * 3.5 + foe.effects.disrupt * 4 + foe.effects.burn * 3;
  value -=
    self.effects.exposed * 3.5 +
    self.effects.disrupt * 4 +
    self.effects.burn * 3;
  value +=
    (self.effects.focus - prior.effects.focus) * 0.6 +
    (self.effects.decoy - prior.effects.decoy) * 0.8;
  return value;
}
export function evaluateHard(
  snapshot: CombatSnapshot,
  state: CombatState,
  completed: readonly CompletedChoices[] = [],
) {
  const distribution = playerDistribution(snapshot, state, completed);
  return legalMoves(snapshot, state, "opponent").map((move) => ({
    move,
    score: distribution.reduce(
      (score, reply) =>
        score +
        reply.weight *
          tacticalValue(
            state,
            resolveRound(snapshot, state, reply.move, move).state,
          ),
      0,
    ),
  }));
}
export function hardChoice(
  snapshot: CombatSnapshot,
  state: CombatState,
  completed: readonly CompletedChoices[],
): OpponentChoice {
  const order: Move[] = ["basic", "special", "guard"];
  const candidates = evaluateHard(snapshot, state, completed).sort(
    (a, b) =>
      b.score - a.score || order.indexOf(a.move) - order.indexOf(b.move),
  );
  const chosen = candidates[0];
  if (!chosen) throw new Error("No hard move in terminal battle.");
  return {
    move: chosen.move,
    reason: `Hard: ${chosen.move} has highest public-state expected value (${chosen.score.toFixed(1)}). Tests ${legalMoves(snapshot, state, "player").length} legal possible replies; ${Math.min(6, completed.length)} completed observations, never the current choice.`,
  };
}
