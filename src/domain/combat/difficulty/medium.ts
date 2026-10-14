import { choosePublicMove } from "../legacyPolicy";
import type { CombatSnapshot, CombatState } from "../contracts";
import { legalMoves } from "../moves";
import { usefulRecovery } from "./easy";
import type { OpponentChoice } from "./contracts";
export function mediumChoice(
  snapshot: CombatSnapshot,
  state: CombatState,
): OpponentChoice {
  const legal = legalMoves(snapshot, state, "opponent"),
    self = state.opponent;
  if (
    legal.includes("special") &&
    snapshot.opponent.id === "moss" &&
    self.effects.burn > 0
  )
    return {
      move: "special",
      reason: "Medium: cleanse the public burn while recovering health.",
    };
  const baseline = choosePublicMove(snapshot, state, "opponent");
  if (baseline.move === "special" && !usefulRecovery(snapshot, state))
    return {
      move: legal.includes("basic") ? "basic" : "guard",
      reason: "Medium: conserve special energy while recovery is unnecessary.",
    };
  return { ...baseline, reason: `Medium: ${baseline.reason}` };
}
