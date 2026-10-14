import { other, type Side } from "./contracts";
import { emit, type RoundContext } from "./round";
import { combatBonuses } from "./bonuses";

export function armour(context: RoundContext, side: Side, pierce = 0) {
  const definition = context.snapshot[side],
    self = context.state[side];
  return Math.max(
    0,
    definition.armour +
      (definition.id === "patch" && self.energy >= 4 ? 2 : 0) -
      (self.effects.exposed ? 3 : 0) -
      pierce,
  );
}
export function attackPower(context: RoundContext, side: Side) {
  const move = context.moves[side];
  const power =
    context.snapshot[side].moves[move].damage +
    combatBonuses(
      context.snapshot,
      context.state,
      side,
      move,
      context.moves[other(side)],
    ).reduce((sum, bonus) => sum + bonus.power, 0);
  if (move === "basic") context.state[side].effects.focus = 0;
  return power;
}
export function hit(context: RoundContext, side: Side, raw: number): number {
  const target = other(side),
    foe = context.state[target];
  let power = raw;
  if (context.dodge[target] && context.moves[side] === "basic") {
    context.dodge[target] = false;
    emit(context, "impact", side, `${target} dodges the basic hit; 0 damage.`);
    return 0;
  }
  const decoy = Math.min(power, foe.effects.decoy);
  power -= decoy;
  foe.effects.decoy -= decoy;
  const pierce =
    context.snapshot[side].id === "nyx" && context.moves[side] === "special"
      ? 2
      : 0;
  power = Math.max(0, power - armour(context, target, pierce));
  const blocked = Math.min(power, context.shield[target]);
  context.shield[target] -= blocked;
  const damage = Math.min(foe.health, power - blocked);
  foe.health -= damage;
  emit(
    context,
    "impact",
    side,
    `${context.snapshot[side].moves[context.moves[side]].name}: ${damage} damage; shield ${blocked}, decoy ${decoy}.`,
  );
  if (damage && foe.health && context.counter[target]) {
    context.counter[target] = false;
    const retaliation = Math.min(
      context.state[side].health,
      Math.max(0, 4 - armour(context, side)),
    );
    context.state[side].health -= retaliation;
    emit(
      context,
      "counter",
      target,
      `Bounded counter: ${retaliation} damage. No counter chain.`,
    );
  }
  return damage;
}
