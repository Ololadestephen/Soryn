import {
  other,
  type CombatSnapshot,
  type CombatState,
  type Side,
  type Move,
} from "./contracts";
export function combatBonuses(
  snapshot: CombatSnapshot,
  state: CombatState,
  side: Side,
  move: Move,
  foeMove: Move,
) {
  const id = snapshot[side].id,
    self = state[side],
    foe = state[other(side)],
    bonuses: { label: string; power: number }[] = [];
  if (id === "ember" && self.health <= snapshot[side].health / 2)
    bonuses.push({ label: "Low-health burst", power: 3 });
  if (id === "mneme" && foe.lastMove && foe.lastMove === foeMove)
    bonuses.push({
      label: "Observed repeat",
      power: move === "special" ? 6 : 3,
    });
  if (move === "basic") {
    if (self.effects.focus)
      bonuses.push({ label: "Prepared equipment", power: self.effects.focus });
    if (id === "pip" && foe.energy <= 2)
      bonuses.push({ label: "Low-energy opening", power: 2 });
    if (id === "prism" && foe.effects.exposed)
      bonuses.push({ label: "Exposed weakness", power: 3 });
    if (id === "flux" && foe.effects.disrupt)
      bonuses.push({ label: "Disruption opening", power: 3 });
  }
  return bonuses;
}
