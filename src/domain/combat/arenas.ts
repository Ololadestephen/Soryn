import { z } from "zod";

export const arenaIds = ["sanctuary", "grove", "foundry", "sky"] as const;
export const arenaSchema = z.enum(arenaIds);
export const arenaChoiceSchema = z.enum([...arenaIds, "random"]);
export type ArenaId = z.infer<typeof arenaSchema>;
export type ArenaChoice = z.infer<typeof arenaChoiceSchema>;
/** A URL suggestion selects setup; it never authorizes a match or a write. */
export function arenaSuggestion(value: unknown): ArenaId | undefined {
  const parsed = arenaSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export const arenas: Record<ArenaId, { name: string; description: string }> = {
  sanctuary: {
    name: "Ruined Sanctuary",
    description: "Lavender stone and old gold.",
  },
  grove: {
    name: "Moonlit Grove",
    description: "A clearing beneath luminous trees.",
  },
  foundry: {
    name: "Ember Foundry",
    description: "Solid basalt above distant forge fire.",
  },
  sky: {
    name: "Sky Temple",
    description: "A quiet courtyard above the clouds.",
  },
};
