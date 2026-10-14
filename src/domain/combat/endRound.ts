import { sides, type Side } from "./contracts";
import { emit, heal, outcome, type RoundContext } from "./round";

function tickBurn(context: RoundContext) {
  const burn = sides.map((side) =>
    context.state[side].health && context.state[side].effects.burn
      ? Math.min(3, context.state[side].health)
      : 0,
  );
  sides.forEach((side, index) => {
    if (!burn[index]) return;
    context.state[side].health -= burn[index];
    emit(
      context,
      "impact",
      side,
      `${side} takes ${burn[index]} end-of-round burn damage.`,
    );
  });
}
function recoverResources(context: RoundContext, side: Side) {
  const self = context.state[side],
    id = context.snapshot[side].id,
    guarding = context.moves[side] === "guard";
  if (id === "moss" && guarding) heal(context, side, 2);
  self.energy = Math.min(
    6,
    self.energy + 2 + (id === "bolt" && guarding ? 1 : 0),
  );
  if (context.moves[side] !== "special")
    self.cooldown = Math.max(0, self.cooldown - 1);
  for (const status of ["exposed", "disrupt", "burn"] as const)
    if (!context.applied.has(`${side}:${status}`))
      self.effects[status] = Math.max(0, self.effects[status] - 1);
}
export function completeCombatRound(context: RoundContext) {
  tickBurn(context);
  context.state.outcome = outcome(context.state);
  for (const side of sides) {
    const self = context.state[side];
    if (!self.health) {
      emit(context, "knockout", side, `${side} knocked out.`);
      continue;
    }
    if (!context.state.outcome) recoverResources(context, side);
    if (context.snapshot[side].id === "echo" && context.moves[side] === "guard")
      self.effects.decoy = 0;
    self.lastMove = context.moves[side];
  }
  if (!context.state.outcome && context.state.round === 20)
    context.state.outcome = "draw";
  context.state.round++;
  emit(
    context,
    context.state.outcome ? "result" : "recovery",
    null,
    context.state.outcome
      ? `Battle ${context.state.outcome}.`
      : "Round complete. Recover energy; cooldowns and old effects progress.",
  );
}
