import { other, type Side } from "./contracts";
import { emit, heal, type RoundContext } from "./round";

export function beforeAttack(context: RoundContext, side: Side) {
  if (context.moves[side] !== "special") return;
  const id = context.snapshot[side].id;
  if (id === "patch") heal(context, side, 14);
  if (id === "moss") {
    for (const status of ["burn", "disrupt", "exposed"] as const)
      context.state[side].effects[status] = 0;
    heal(context, side, 6);
    emit(
      context,
      "status",
      side,
      "Spring Clean removes old burn, disruption and exposure.",
    );
  }
}
export function afterAttack(context: RoundContext, side: Side, damage: number) {
  if (context.moves[side] !== "special") return;
  const id = context.snapshot[side].id,
    target = other(side),
    foe = context.state[target];
  const status =
    id === "pip" || id === "prism"
      ? "exposed"
      : id === "flux"
        ? "disrupt"
        : id === "ember"
          ? "burn"
          : null;
  if (status && damage && foe.health) {
    const duration = status === "disrupt" ? 1 : 2;
    foe.effects[status] = Math.max(foe.effects[status], duration);
    context.applied.add(`${target}:${status}`);
    emit(
      context,
      "status",
      side,
      `${target}: ${status} for ${duration} future round${duration > 1 ? "s" : ""}.`,
    );
  }
  if (id === "pip")
    emit(
      context,
      "status",
      side,
      `Recon: opponent armour ${context.snapshot[target].armour}, special cooldown ${foe.cooldown}. Public information only.`,
    );
  if (id === "ember") {
    context.state[side].health = Math.max(0, context.state[side].health - 7);
    emit(
      context,
      "impact",
      side,
      "Flash Burn recoil: lose 7 health.",
      undefined,
      { type: "recoil" },
    );
  }
}
