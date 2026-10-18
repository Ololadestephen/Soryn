import {
  type CombatEvent,
  type CombatSnapshot,
  type CombatState,
  type Move,
  type Side,
} from "./contracts";

export interface RoundContext {
  snapshot: CombatSnapshot;
  state: CombatState;
  moves: Record<Side, Move>;
  events: CombatEvent[];
  eventFormat: 1 | 2;
  shield: Record<Side, number>;
  dodge: Record<Side, boolean>;
  counter: Record<Side, boolean>;
  applied: Set<string>;
}
export function emit(
  context: RoundContext,
  kind: CombatEvent["kind"],
  side: Side | null,
  message: string,
  move: Move | null = side ? context.moves[side] : null,
  detail?: CombatEvent["detail"],
) {
  context.events.push({
    kind,
    side,
    move,
    message,
    state: structuredClone(context.state),
    ...(context.eventFormat === 2 && detail ? { detail } : {}),
  });
}
export function heal(context: RoundContext, side: Side, amount: number) {
  const self = context.state[side];
  if (!self.health) return;
  const gain = Math.min(amount, context.snapshot[side].health - self.health);
  self.health += gain;
  emit(
    context,
    "heal",
    side,
    `${context.snapshot[side].id} recovers ${gain} health.`,
  );
}
export function outcome(state: CombatState): CombatState["outcome"] {
  if (!state.player.health && !state.opponent.health) return "draw";
  if (!state.player.health) return "defeat";
  if (!state.opponent.health) return "victory";
  return null;
}
