import { character, type SkillAction } from "../characters/definitions";
import type { GameState } from "../game/contracts";
import type { TacticalState } from "../game/tactical/contracts";
type Predicate = (state: GameState, tactics: TacticalState) => boolean;
const targets: Record<SkillAction, Predicate> = {
  "skill-peek": (state) => !state.inspected,
  "skill-spare": (state, t) =>
    t.consumed > 0 && state.gadgets < t.loadout.gadgetCap,
  "skill-bubble": (state, t) => state.room < 2 && !t.effects.bubble,
  "skill-trail": (state, t) =>
    state.room === 1 && !state.distracted && t.effects.trail === 0,
  "skill-shortcut": (state) =>
    state.room === 1 && state.inspected && state.turns >= 1,
  "skill-calm": (state) => state.alarm > 0,
  "skill-shadow": (state) => state.room === 1 && state.turns >= 1,
  "skill-lens": (state, t) => !state.inspected || !t.mechanismKnown,
  "skill-steady": (state, t) =>
    state.room === 2 && !state.sandwich && !t.effects.steady,
  "skill-reroute": (state, t) =>
    state.room > 0 &&
    t.mechanismKnown &&
    !t.effects.reroute &&
    (state.room === 1 || !state.sandwich),
  "skill-breakthrough": (state, t) =>
    state.room === 1 && t.mechanismKnown && state.turns >= 1,
  "skill-second-thought": (_state, t) => t.pending !== null,
};
export function skillEligible(state: GameState, action: SkillAction): boolean {
  const t = state.tactics;
  if (
    !t ||
    state.outcome ||
    t.charges <= 0 ||
    character(t.loadout.characterId).skill !== action
  )
    return false;
  if (t.pending && action !== "skill-second-thought") return false;
  return targets[action](state, t);
}
