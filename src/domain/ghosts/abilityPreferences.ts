import { character } from "../characters/definitions";
import type { Action, Observation } from "../game/contracts";
import { tacticsFor } from "../game/tactical/contracts";
import type { AbilityProfile } from "./contracts";
import type { GhostDecision } from "./contracts";
export function preparationPreferences(
  profile: AbilityProfile,
  view: Observation,
): GhostDecision[] {
  const t = tacticsFor(view),
    room = view.room,
    support = profile.rooms[room],
    ranked: GhostDecision[] = [];
  const entry = character(t.loadout.characterId);
  if (
    profile.abilityUses[room] > 0 ||
    (!profile.abilityUses.some((uses) => uses > 0) &&
      entry.skill !== "skill-second-thought")
  )
    ranked.push({
      action: entry.skill,
      reason:
        profile.abilityUses[room] > 0
          ? `${profile.abilityUses[room]} recorded ability uses in this room. Use ${entry.ability} only while legal, with ${t.charges} charge(s) left.`
          : "No supported ability timing here: use the legal current-room ability baseline. No future state is consulted.",
    });
  if (t.pending)
    ranked.push({
      action: "resolve-choice",
      reason:
        "Confirm the committed choice. Its outcome has not been inspected.",
    });
  if (profile.mechanismInspections[room] > 0)
    ranked.push({
      action: "inspect-mechanism",
      reason: `${profile.mechanismInspections[room]} recorded mechanism inspections in this room.`,
    });
  if (support.inspections > 0 && support.inspections * 2 >= support.entries)
    ranked.push({
      action: "inspect",
      reason: `${support.inspections} of ${support.entries} entries included inspection.`,
    });
  return ranked;
}
export function routePreferences(
  profile: AbilityProfile,
  view: Observation,
): GhostDecision[] {
  const t = tacticsFor(view),
    room = view.room,
    support = profile.rooms[room],
    ranked: GhostDecision[] = [];
  if (room === 0 && support.door > 0 && support.door * 2 >= support.entries)
    ranked.push({
      action: "door",
      reason: `${support.door} of ${support.entries} hall entries favored the painted door. A ghost can retain bad habits.`,
    });
  if (support.gadgets > 0 && support.gadgets * 2 >= support.entries)
    ranked.push({
      action: "gadget",
      reason: `${support.gadgets} of ${support.entries} entries used a basic decoy.`,
    });
  if (t.loadout.characterId === "mneme" && !t.pending) {
    const plans = profile.commitments[room];
    for (const planned of ["door", "sneak", "take"] as const)
      if (plans[planned] > 0)
        ranked.push({
          action: `commit-${planned}` as Action,
          reason: `${plans[planned]} recorded commitments to ${planned} in this room; commit without revealing an outcome.`,
        });
  }
  return ranked;
}
export function movementPreferences(
  profile: AbilityProfile,
  view: Observation,
): GhostDecision[] {
  const moves = profile.moves[view.room],
    ranked: GhostDecision[] = [];
  if (moves.patrol > 0)
    ranked.push({
      action: "sneak",
      reason: `${moves.patrol} recorded patrol attempts. Use only the currently legal choice; bad timing can be repeated.`,
    });
  if (moves.vent > 0)
    ranked.push({
      action: "vent",
      reason: `${moves.vent} recorded vent passages, available only after discovery.`,
    });
  if (moves.grab > 0)
    ranked.push({
      action: "take",
      reason: `${moves.grab} recorded direct grabs; handling effects apply only if already active.`,
    });
  return ranked;
}
