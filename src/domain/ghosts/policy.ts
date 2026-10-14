import { basicActionSchema, legacyScenarioSchema } from "../game/contracts";
import type {
  Action,
  GameState,
  Observation,
  Scenario,
} from "../game/contracts";
import { initialState, observe, transition } from "../game/engine";
import * as legacy from "./legacy";
import { deriveAbilities, decideAbilities } from "./abilities";
import type { GhostProfile } from "./contracts";
export type { GhostProfile } from "./contracts";
export const POLICY_VERSION = "habit-ranking/1";
export type { TrainingRun, GhostDecision } from "./contracts";
import type { TrainingRun, GhostDecision } from "./contracts";
export function deriveProfile(runs: readonly TrainingRun[]): GhostProfile {
  if (runs.some((run) => run.scenario.rules === "sandwich-rules/2"))
    return deriveAbilities(runs);
  return legacy.deriveProfile(
    runs.map((run) => ({
      scenario: legacyScenarioSchema.parse(run.scenario),
      actions: run.actions.map((action) => basicActionSchema.parse(action)),
    })),
  );
}
export function decide(
  profile: GhostProfile,
  observation: Observation,
): GhostDecision {
  if (profile.policy === "habit-abilities/2")
    return decideAbilities(profile, observation);
  if (observation.tactics)
    throw new Error("Legacy ghost cannot race an ability loadout.");
  return legacy.decide(profile, observation);
}
export function raceGhost(
  profile: GhostProfile,
  scenario: Scenario,
): { actions: Action[]; reasons: string[]; result: GameState } {
  let state = initialState(scenario);
  const actions: Action[] = [];
  const reasons: string[] = [];
  while (!state.outcome) {
    if (actions.length >= 32)
      throw new Error("Ghost exceeded frozen event budget.");
    const decision = decide(profile, observe(state));
    actions.push(decision.action);
    reasons.push(decision.reason);
    state = transition(state, decision.action);
  }
  return { actions, reasons, result: state };
}
