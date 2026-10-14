import {
  other,
  type CombatSnapshot,
  type CombatState,
  type Move,
  type Side,
} from "./contracts";
import { legalMoves } from "./moves";

export function choosePublicMove(
  snapshot: CombatSnapshot,
  state: CombatState,
  side: Side,
): { move: Move; reason: string } {
  const legal = legalMoves(snapshot, state, side);
  if (!legal.length) throw new Error("No move in terminal battle.");
  const self = state[side],
    foe = state[other(side)],
    definition = snapshot[side];
  const can = (move: Move) => legal.includes(move);
  if (self.energy < 2)
    return {
      move: "guard",
      reason: "Low energy: guard to recover before attacking.",
    };
  if (
    (definition.id === "patch" && self.health <= definition.health - 14) ||
    (definition.id === "moss" && self.health <= definition.health - 6)
  ) {
    if (can("special"))
      return {
        move: "special",
        reason: "Public health is below the recovery threshold.",
      };
  }
  const guardRound =
    definition.id === "aegis" ||
    definition.id === "atlas" ||
    definition.id === "moss"
      ? 3
      : 5;
  if (state.round % guardRound === 0 && foe.lastMove !== "guard")
    return {
      move: "guard",
      reason: "Prepare defence after the opponent's completed attack pattern.",
    };
  if (
    can("special") &&
    !(definition.id === "patch" && self.health > definition.health - 14)
  )
    return {
      move: "special",
      reason:
        "Special is legal and energy is sufficient for this fighter's preferred tactic.",
    };
  if (can("basic"))
    return {
      move: "basic",
      reason:
        definition.id === "mneme" && foe.lastMove
          ? "Use the completed move record; the current player choice is unknown."
          : "Basic is legal while the special rests.",
    };
  return { move: "guard", reason: "Defend and recover energy." };
}
