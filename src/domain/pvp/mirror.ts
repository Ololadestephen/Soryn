import type {
  BattleView,
  CombatEvent,
  CombatSnapshot,
  CombatState,
  ResolvedRound,
  Side,
} from "../combat/contracts";
import { legalMoves } from "../combat/moves";

function swapSide(side: Side | null): Side | null {
  if (side === "player") return "opponent";
  if (side === "opponent") return "player";
  return null;
}

export function mirrorMessage(message: string) {
  return message
    .replaceAll("Your fighter acting", "\u0000you")
    .replaceAll("Opponent acting", "\u0000foe")
    .replaceAll("Battle victory.", "\u0000win")
    .replaceAll("Battle defeat.", "\u0000loss")
    .replaceAll(/\bplayer\b/g, "\u0000side")
    .replaceAll(/\bopponent\b/g, "player")
    .replaceAll("\u0000side", "opponent")
    .replaceAll("\u0000you", "Opponent acting")
    .replaceAll("\u0000foe", "Your fighter acting")
    .replaceAll("\u0000win", "Battle defeat.")
    .replaceAll("\u0000loss", "Battle victory.");
}

function swapOutcome(outcome: CombatState["outcome"]): CombatState["outcome"] {
  if (outcome === "victory") return "defeat";
  if (outcome === "defeat") return "victory";
  return outcome;
}

export function swapState(state: CombatState): CombatState {
  return {
    round: state.round,
    player: state.opponent,
    opponent: state.player,
    outcome: swapOutcome(state.outcome),
  };
}

function swapSnapshot(snapshot: CombatSnapshot): CombatSnapshot {
  return { ...snapshot, player: snapshot.opponent, opponent: snapshot.player };
}

function swapEvent(event: CombatEvent): CombatEvent {
  return {
    ...event,
    side: swapSide(event.side),
    message: mirrorMessage(event.message),
    state: swapState(event.state),
  };
}

function swapRound(round: ResolvedRound): ResolvedRound {
  return {
    ...round,
    player: round.opponent,
    opponent: round.player,
    events: round.events.map(swapEvent),
  };
}

/** Seat B watches the same canonical round with local player/opponent labels. */
export function mirrorBattle(battle: BattleView): BattleView {
  const snapshot = swapSnapshot(battle.snapshot);
  const state = swapState(battle.state);
  return {
    ...battle,
    tokenId: null,
    snapshot,
    state,
    rounds: battle.rounds.map(swapRound),
    legal: legalMoves(snapshot, state, "player"),
  };
}
