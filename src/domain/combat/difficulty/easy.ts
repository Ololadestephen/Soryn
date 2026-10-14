import { legalMoves } from "../moves";
import type { CombatSnapshot, CombatState } from "../contracts";
import type { OpponentChoice } from "./contracts";
export function usefulRecovery(snapshot: CombatSnapshot, state: CombatState) {
  const self = state.opponent,
    id = snapshot.opponent.id;
  if (id === "patch") return self.health < snapshot.opponent.health;
  if (id === "moss")
    return (
      self.health < snapshot.opponent.health ||
      self.effects.burn > 0 ||
      self.effects.exposed > 0 ||
      self.effects.disrupt > 0
    );
  return true;
}
export function easyChoice(
  snapshot: CombatSnapshot,
  state: CombatState,
): OpponentChoice {
  const legal = legalMoves(snapshot, state, "opponent");
  if (!legal.includes("basic"))
    return {
      move: "guard",
      reason: "Easy: recover energy when a basic attack is unaffordable.",
    };
  if (state.round % 4 === 0)
    return {
      move: "guard",
      reason: "Easy: predictable defensive preparation every fourth round.",
    };
  if (
    state.round % 5 === 0 &&
    legal.includes("special") &&
    usefulRecovery(snapshot, state)
  )
    return {
      move: "special",
      reason: "Easy: use an affordable useful special every fifth round.",
    };
  return {
    move: "basic",
    reason:
      "Easy: a straightforward basic attack; current player choice is unknown.",
  };
}
