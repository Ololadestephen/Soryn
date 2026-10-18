import {
  sides,
  type CombatSnapshot,
  type CombatState,
  type FighterState,
  type Move,
  type ResolvedRound,
  type Side,
} from "./contracts";
import { initiativeOrder, legalMoves } from "./moves";
import { emit, type RoundContext } from "./round";
import { attackPower, hit } from "./damage";
import { beforeAttack, afterAttack } from "./specials";
import { completeCombatRound } from "./endRound";

export class CombatError extends Error {}
export function initialCombat(snapshot: CombatSnapshot): CombatState {
  const initialize = (side: Side): FighterState => ({
    health: snapshot[side].health,
    energy: 4,
    cooldown: 0,
    effects: {
      exposed: 0,
      disrupt: 0,
      burn: 0,
      decoy: snapshot[side].id === "echo" ? 6 : 0,
      focus: 0,
    },
    lastMove: null,
  });
  return {
    round: 1,
    player: initialize("player"),
    opponent: initialize("opponent"),
    outcome: null,
  };
}
function prepare(context: RoundContext) {
  for (const side of sides) {
    const definition = context.snapshot[side],
      self = context.state[side],
      move = context.moves[side];
    self.energy -= definition.moves[move].cost;
    if (move === "special") self.cooldown = definition.moves.special.cooldown;
    let shield =
      move === "guard"
        ? definition.shield
        : move === "special" && definition.id === "aegis"
          ? 10
          : move === "special" && definition.id === "patch"
            ? 4
            : 0;
    if (self.effects.exposed) shield = Math.max(0, shield - 4);
    context.shield[side] = shield;
    context.dodge[side] = move === "guard" && definition.id === "nyx";
    context.counter[side] = move === "guard" && definition.id === "aegis";
    if (move === "guard") {
      if (definition.id === "echo") self.effects.decoy = 6;
      if (definition.id === "patch") self.effects.focus = 3;
      if (definition.id === "atlas") self.effects.focus = 4;
    }
    emit(
      context,
      "prepare",
      side,
      `${definition.moves[move].name} locked. ${shield} shield prepared; ${definition.moves[move].cost} energy spent.`,
      undefined,
      { type: "prepare", shield },
    );
  }
}
function execute(context: RoundContext, side: Side) {
  const move = context.moves[side],
    definition = context.snapshot[side].moves[move];
  if (move === "guard") return;
  if (
    !context.state[side].health ||
    !context.state[side === "player" ? "opponent" : "player"].health
  ) {
    emit(
      context,
      "cancel",
      side,
      `${definition.name} cancelled after knockout. No attack occurred.`,
    );
    return;
  }
  beforeAttack(context, side);
  if (definition.treatment === "heal" || definition.treatment === "guard")
    return;
  emit(
    context,
    definition.treatment,
    side,
    `${definition.name}: ${side === "opponent" ? "Opponent acting" : "Your fighter acting"}.`,
  );
  const power = attackPower(context, side);
  let damage = 0;
  for (let n = 0; n < definition.hits; n++) {
    if (
      !context.state[side].health ||
      !context.state[side === "player" ? "opponent" : "player"].health
    )
      break;
    damage += hit(context, side, power);
  }
  afterAttack(context, side, damage);
  emit(
    context,
    "return",
    side,
    `${definition.name} finished; return to stance.`,
  );
}
export function resolveRound(
  snapshot: CombatSnapshot,
  input: CombatState,
  player: Move,
  opponent: Move,
  reason = "Direct deterministic resolver",
  eventFormat: 1 | 2 = 2,
): { state: CombatState; round: ResolvedRound } {
  const moves = { player, opponent };
  for (const side of sides)
    if (!legalMoves(snapshot, input, side).includes(moves[side]))
      throw new CombatError(`Illegal ${side} move or terminal battle.`);
  const context: RoundContext = {
    snapshot,
    state: structuredClone(input),
    moves,
    events: [],
    eventFormat,
    shield: { player: 0, opponent: 0 },
    dodge: { player: false, opponent: false },
    counter: { player: false, opponent: false },
    applied: new Set(),
  };
  prepare(context);
  for (const side of initiativeOrder(snapshot, input, moves))
    execute(context, side);
  completeCombatRound(context);
  return {
    state: context.state,
    round: {
      ...(eventFormat === 2 ? { eventFormat: 2 as const } : {}),
      round: input.round,
      player,
      opponent,
      reason,
      events: context.events,
    },
  };
}
