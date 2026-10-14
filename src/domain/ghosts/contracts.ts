import type { Action, Scenario } from "../game/contracts";
import { z } from "zod";
import { loadoutSchema } from "../characters/definitions";
const supportSchema = z.strictObject({
  entries: z.number().int().nonnegative(),
  inspections: z.number().int().nonnegative(),
  gadgets: z.number().int().nonnegative(),
  door: z.number().int().nonnegative(),
});
const rooms = z.tuple([supportSchema, supportSchema, supportSchema]);
const counts = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
export const legacyProfileSchema = z.strictObject({
  policy: z.literal("habit-ranking/1"),
  runs: z.number().int().nonnegative(),
  rooms,
});
const moves = z.tuple([
  z.strictObject({
    patrol: z.number().int().nonnegative(),
    grab: z.number().int().nonnegative(),
    vent: z.number().int().nonnegative(),
  }),
  z.strictObject({
    patrol: z.number().int().nonnegative(),
    grab: z.number().int().nonnegative(),
    vent: z.number().int().nonnegative(),
  }),
  z.strictObject({
    patrol: z.number().int().nonnegative(),
    grab: z.number().int().nonnegative(),
    vent: z.number().int().nonnegative(),
  }),
]);
const commitments = z.tuple([
  z.strictObject({
    door: z.number().int().nonnegative(),
    sneak: z.number().int().nonnegative(),
    take: z.number().int().nonnegative(),
  }),
  z.strictObject({
    door: z.number().int().nonnegative(),
    sneak: z.number().int().nonnegative(),
    take: z.number().int().nonnegative(),
  }),
  z.strictObject({
    door: z.number().int().nonnegative(),
    sneak: z.number().int().nonnegative(),
    take: z.number().int().nonnegative(),
  }),
]);
export const abilityProfileSchema = z.strictObject({
  policy: z.literal("habit-abilities/2"),
  runs: z.number().int().nonnegative(),
  rooms,
  loadout: loadoutSchema,
  abilityUses: counts,
  mechanismInspections: counts,
  moves,
  commitments,
});
export const profileSchema = z.union([
  legacyProfileSchema,
  abilityProfileSchema,
]);
export type AbilityProfile = z.infer<typeof abilityProfileSchema>;
export type GhostProfile = z.infer<typeof profileSchema>;

export interface TrainingRun {
  scenario: Scenario;
  actions: readonly Action[];
}
export interface GhostDecision {
  action: Action;
  reason: string;
}
