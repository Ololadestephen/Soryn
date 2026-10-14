import { visitTraining } from "./training";
import {
  basicActionSchema,
  type BasicAction as Action,
  type Observation,
  type LegacyScenario as Scenario,
} from "../game/contracts";

export const POLICY_VERSION = "habit-ranking/1";
interface Support {
  entries: number;
  inspections: number;
  gadgets: number;
  door: number;
}
export interface GhostProfile {
  policy: typeof POLICY_VERSION;
  runs: number;
  rooms: [Support, Support, Support];
}
export interface TrainingRun {
  scenario: Scenario;
  actions: readonly Action[];
}
export interface GhostDecision {
  action: Action;
  reason: string;
}
const emptySupport = (): Support => ({
  entries: 0,
  inspections: 0,
  gadgets: 0,
  door: 0,
});

export function deriveProfile(runs: readonly TrainingRun[]): GhostProfile {
  const profile: GhostProfile = {
    policy: POLICY_VERSION,
    runs: runs.length,
    rooms: [emptySupport(), emptySupport(), emptySupport()],
  };
  for (const run of runs) {
    visitTraining(run, (state, action, firstEntry) => {
      const support = profile.rooms[state.room];
      support.entries += Number(firstEntry);
      if (action === "inspect") support.inspections++;
      if (action === "gadget") support.gadgets++;
      if (action === "door") support.door++;
    });
  }
  return profile;
}

function baseline(observation: Observation): Action {
  if (observation.room === 0) return "arch";
  if (observation.room === 1)
    return observation.distracted || observation.patrol === "reading"
      ? "sneak"
      : "wait";
  if (observation.sandwich) return "exit";
  return observation.inspected ? "swap" : "inspect";
}

export function decide(
  profile: GhostProfile,
  observation: Observation,
): GhostDecision {
  if (profile.policy !== POLICY_VERSION)
    throw new Error("Unsupported ghost policy.");
  if (!observation.choices.length)
    throw new Error("No decision after terminal state.");
  const support = profile.rooms[observation.room];
  const favored = (count: number) => count > 0 && count * 2 >= support.entries;
  const ranked: GhostDecision[] = [];
  if (!observation.inspected && favored(support.inspections))
    ranked.push({
      action: "inspect",
      reason: `${support.inspections} of ${support.entries} observed room entries included inspection.`,
    });
  if (observation.room === 0 && favored(support.door))
    ranked.push({
      action: "door",
      reason: `${support.door} of ${support.entries} observed hall entries favored the heroic door. Habits can preserve bad decisions.`,
    });
  if (!observation.sandwich && favored(support.gadgets))
    ranked.push({
      action: "gadget",
      reason: `${support.gadgets} of ${support.entries} observed room entries used a decoy.`,
    });
  ranked.push({
    action: baseline(observation),
    reason: support.entries
      ? "No supported preference applies. Using the visible-clue baseline."
      : "Unseen room: use the visible-clue baseline; no learned preference.",
  });
  // Fixed ordering above is the policy's tie-breaker. Never select an illegal action.
  return (
    ranked.find((entry) =>
      observation.choices.some((choice) => choice.action === entry.action),
    ) ?? {
      action: basicActionSchema.parse(observation.choices[0].action),
      reason:
        "Preferred action unavailable; first legal action in the authored order.",
    }
  );
}
