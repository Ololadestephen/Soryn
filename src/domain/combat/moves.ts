import {
  type CombatSnapshot,
  type CombatState,
  type Move,
  type Side,
} from "./contracts";

export function legalMoves(
  snapshot: CombatSnapshot,
  state: CombatState,
  side: Side,
): Move[] {
  if (state.outcome || state[side].health === 0) return [];
  return (["basic", "special", "guard"] as const).filter(
    (move) =>
      snapshot[side].moves[move].cost <= state[side].energy &&
      (move !== "special" ||
        (state[side].cooldown === 0 && state[side].effects.disrupt === 0)),
  );
}
export function initiative(
  snapshot: CombatSnapshot,
  state: CombatState,
  side: Side,
  move: Move,
) {
  return (
    snapshot[side].speed +
    snapshot[side].moves[move].initiative +
    (snapshot[side].id === "nyx" && state.round === 1 ? 2 : 0)
  );
}
export function initiativeOrder(
  snapshot: CombatSnapshot,
  state: CombatState,
  moves: Record<Side, Move>,
): Side[] {
  const a = initiative(snapshot, state, "player", moves.player);
  const b = initiative(snapshot, state, "opponent", moves.opponent);
  const first: Side =
    a === b
      ? (state.round + snapshot.tie) % 2 === 0
        ? "player"
        : "opponent"
      : a > b
        ? "player"
        : "opponent";
  return [first, first === "player" ? "opponent" : "player"];
}
