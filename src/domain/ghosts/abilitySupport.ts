import type { Action } from "../game/contracts";
import type { AbilityProfile } from "./contracts";
type Count = (profile: AbilityProfile, room: 0 | 1 | 2) => void;
const observations: Partial<Record<Action, Count>> = {
  inspect: (p, r) => {
    p.rooms[r].inspections++;
  },
  gadget: (p, r) => {
    p.rooms[r].gadgets++;
  },
  door: (p, r) => {
    p.rooms[r].door++;
  },
  sneak: (p, r) => {
    p.moves[r].patrol++;
  },
  take: (p, r) => {
    p.moves[r].grab++;
  },
  vent: (p, r) => {
    p.moves[r].vent++;
  },
  "commit-door": (p, r) => {
    p.rooms[r].door++;
    p.commitments[r].door++;
  },
  "commit-sneak": (p, r) => {
    p.commitments[r].sneak++;
  },
  "commit-take": (p, r) => {
    p.commitments[r].take++;
  },
  "inspect-mechanism": (p, r) => {
    p.mechanismInspections[r]++;
  },
};
export function recordSupport(
  profile: AbilityProfile,
  room: 0 | 1 | 2,
  action: Action,
) {
  observations[action]?.(profile, room);
  if (action.startsWith("skill-")) profile.abilityUses[room]++;
}
