import { z } from "zod";

export const CHARACTER_VERSION = "character-definitions/1";
export const ABILITY_VERSION = "ability-rules/1";
export const characterIdSchema = z.enum([
  "pip",
  "bolt",
  "patch",
  "moss",
  "aegis",
  "nyx",
  "echo",
  "prism",
  "atlas",
  "flux",
  "ember",
  "mneme",
]);
export type CharacterId = z.infer<typeof characterIdSchema>;
export const skillActions = [
  "skill-peek",
  "skill-shortcut",
  "skill-spare",
  "skill-calm",
  "skill-bubble",
  "skill-shadow",
  "skill-trail",
  "skill-lens",
  "skill-steady",
  "skill-reroute",
  "skill-breakthrough",
  "skill-second-thought",
] as const;
export type SkillAction = (typeof skillActions)[number];
export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  role: string;
  personality: string;
  access: "starter" | "holder";
  skill: SkillAction;
  ability: string;
  rule: string;
}
export const characters: readonly CharacterDefinition[] = [
  {
    id: "pip",
    name: "Pip",
    role: "Scout",
    personality: "Checks the sign. Then checks the sign's references.",
    access: "starter",
    skill: "skill-peek",
    ability: "Peek",
    rule: "0 turns. Reveal one nearby route clue in your current room.",
  },
  {
    id: "bolt",
    name: "Bolt",
    role: "Courier",
    personality: "Already halfway there. Occasionally somewhere else.",
    access: "starter",
    skill: "skill-shortcut",
    ability: "Shortcut",
    rule: "1 turn. Cross the guard's discovered service vent in one turn instead of two.",
  },
  {
    id: "patch",
    name: "Patch",
    role: "Tinkerer",
    personality: "Keeps the spare parts. Especially the suspicious ones.",
    access: "starter",
    skill: "skill-spare",
    ability: "Spare Parts",
    rule: "0 turns. Restore one consumed basic decoy. Inventory cap: one.",
  },
  {
    id: "moss",
    name: "Moss",
    role: "Caretaker",
    personality: "An excellent listener. Even alarms feel heard.",
    access: "starter",
    skill: "skill-calm",
    ability: "Calm Down",
    rule: "0 turns. Reduce existing alarm by one. Cannot rescue a captured run.",
  },
  {
    id: "aegis",
    name: "Aegis",
    role: "Guardian",
    personality: "Prepared for impact. Less prepared for the paperwork.",
    access: "holder",
    skill: "skill-bubble",
    ability: "Safety Bubble",
    rule: "0 turns. Absorb one painted-door impact or caught patrol. Stay in the room; the action still spends its turn. Expires on use or leaving.",
  },
  {
    id: "nyx",
    name: "Nyx",
    role: "Infiltrator",
    personality: "Arrives quietly. Leaves with somebody else's lunch.",
    access: "holder",
    skill: "skill-shadow",
    ability: "Shadow Step",
    rule: "1 turn. Pass the current guard patrol without alarm. Guard room only.",
  },
  {
    id: "echo",
    name: "Echo",
    role: "Trickster",
    personality: "The guard is following someone. Hopefully someone else.",
    access: "holder",
    skill: "skill-trail",
    ability: "False Trail",
    rule: "0 turns. Distract the guard for two spent guard turns or until passage. Uses no decoy.",
  },
  {
    id: "prism",
    name: "Prism",
    role: "Investigator",
    personality: "Sees right through the museum. Still reads the labels.",
    access: "holder",
    skill: "skill-lens",
    ability: "Truth Lens",
    rule: "0 turns. Reveal every eligible route and mechanism clue in this room. Never future rooms.",
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Carrier",
    personality: "Heavy lifting. Delicate sandwich handling.",
    access: "holder",
    skill: "skill-steady",
    ability: "Steady Hands",
    rule: "0 turns. Prepare one safe Grab in extraction. Grab still costs one turn and must happen separately.",
  },
  {
    id: "flux",
    name: "Flux",
    role: "Engineer",
    personality: "Everything is a machine if you bring the right wrench.",
    access: "holder",
    skill: "skill-reroute",
    ability: "Reroute",
    rule: "0 turns. After inspecting a mechanism, disable its patrol gate or plate for the next ordinary action.",
  },
  {
    id: "ember",
    name: "Ember",
    role: "Daredevil",
    personality: "Has a plan. It is mostly a running start.",
    access: "holder",
    skill: "skill-breakthrough",
    ability: "Breakthrough",
    rule: "1 turn, +1 alarm. Force the discovered delivery hatch in the guard room. Other routes cannot be forced.",
  },
  {
    id: "mneme",
    name: "Mneme",
    role: "Memory Keeper",
    personality: "Thinks twice. Remembers the first thought, unfortunately.",
    access: "holder",
    skill: "skill-second-thought",
    ability: "Second Thought",
    rule: "0 turns. Cancel a committed door, sneak or grab before confirming it. Spends a charge; never undoes resolved history.",
  },
];
export function character(id: CharacterId) {
  const found = characters.find((entry) => entry.id === id);
  if (!found) throw new Error("Unsupported character.");
  return found;
}
export const loadoutSchema = z
  .strictObject({
    characterId: characterIdSchema,
    definitions: z.literal(CHARACTER_VERSION),
    abilities: z.literal(ABILITY_VERSION),
    charges: z.union([z.literal(1), z.literal(2)]),
    gadgetCap: z.literal(1),
  })
  .refine(
    (value) =>
      value.charges ===
      (character(value.characterId).access === "starter" ? 1 : 2),
    "Character charge budget mismatch.",
  );
export type Loadout = z.infer<typeof loadoutSchema>;
export function loadoutFor(id: CharacterId): Loadout {
  return loadoutSchema.parse({
    characterId: id,
    definitions: CHARACTER_VERSION,
    abilities: ABILITY_VERSION,
    charges: character(id).access === "starter" ? 1 : 2,
    gadgetCap: 1,
  });
}
export function loadoutKey(loadout: Loadout | undefined) {
  return loadout ? JSON.stringify(loadout) : "legacy/no-loadout";
}
