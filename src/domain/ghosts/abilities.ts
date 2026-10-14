import { visitTraining } from "./training";
import { recordSupport } from "./abilitySupport";
import {
  preparationPreferences,
  routePreferences,
  movementPreferences,
} from "./abilityPreferences";
import type { Action, Observation } from "../game/contracts";
import { loadoutKey } from "../characters/definitions";
import type { AbilityProfile } from "./contracts";
import type { TrainingRun, GhostDecision } from "./contracts";

export function deriveAbilities(runs: readonly TrainingRun[]): AbilityProfile {
  const first = runs[0]?.scenario;
  if (!first || first.rules !== "sandwich-rules/2")
    throw new Error("Ability profile requires a frozen loadout.");
  const profile: AbilityProfile = {
    policy: "habit-abilities/2",
    runs: runs.length,
    loadout: structuredClone(first.loadout),
    rooms: [
      { entries: 0, inspections: 0, gadgets: 0, door: 0 },
      { entries: 0, inspections: 0, gadgets: 0, door: 0 },
      { entries: 0, inspections: 0, gadgets: 0, door: 0 },
    ],
    abilityUses: [0, 0, 0],
    mechanismInspections: [0, 0, 0],
    moves: [
      { patrol: 0, grab: 0, vent: 0 },
      { patrol: 0, grab: 0, vent: 0 },
      { patrol: 0, grab: 0, vent: 0 },
    ],
    commitments: [
      { door: 0, sneak: 0, take: 0 },
      { door: 0, sneak: 0, take: 0 },
      { door: 0, sneak: 0, take: 0 },
    ],
  };
  for (const run of runs) {
    if (
      run.scenario.rules !== "sandwich-rules/2" ||
      loadoutKey(run.scenario.loadout) !== loadoutKey(first.loadout)
    )
      throw new Error("Cannot train across different loadout budgets.");
    visitTraining(run, (state, action, firstEntry) => {
      profile.rooms[state.room].entries += Number(firstEntry);
      recordSupport(profile, state.room, action);
    });
  }
  return profile;
}
function baseline(observation: Observation): Action {
  if (observation.tactics?.pending) return "resolve-choice";
  if (observation.room === 0) return "arch";
  if (observation.room === 1)
    return observation.distracted ||
      observation.patrol === "reading" ||
      observation.tactics?.effects.reroute
      ? "sneak"
      : "wait";
  if (observation.sandwich) return "exit";
  if (
    observation.tactics?.effects.steady ||
    observation.tactics?.effects.reroute
  )
    return "take";
  return observation.inspected ? "swap" : "inspect";
}
export function decideAbilities(
  profile: AbilityProfile,
  observation: Observation,
): GhostDecision {
  const t = observation.tactics;
  if (!t || loadoutKey(t.loadout) !== loadoutKey(profile.loadout))
    throw new Error("Ghost loadout mismatch.");
  if (!observation.choices.length)
    throw new Error("No decision after terminal state.");
  const ranked: GhostDecision[] = [
    ...preparationPreferences(profile, observation),
    ...routePreferences(profile, observation),
    ...movementPreferences(profile, observation),
    {
      action: baseline(observation),
      reason:
        "Use the visible-clue baseline for this loadout; player and ghost resources are independent.",
    },
  ];
  for (const item of ranked) {
    const legal = observation.choices.find(
      (choice) =>
        choice.action === item.action ||
        choice.action === `commit-${item.action}`,
    );
    if (legal) return { ...item, action: legal.action };
  }
  return {
    action: observation.choices[0].action,
    reason:
      "Preferred action unavailable. Choose the first legal authored action.",
  };
}
