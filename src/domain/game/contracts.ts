import { z } from "zod";
import {
  loadoutSchema,
  type CharacterId,
  loadoutFor,
} from "../characters/definitions";
import type { TacticalState } from "./tactical/contracts";

export const RULES_VERSION = "sandwich-rules/1";
export const CONTENT_VERSION = "sandwich-rooms/1";
export { basicActionSchema, actionSchema } from "./actions";
export type { BasicAction, Action } from "./actions";
import type { Action } from "./actions";
export const legacyScenarioSchema = z.strictObject({
  seed: z.number().int().min(0).max(4294967295),
  rules: z.literal(RULES_VERSION),
  content: z.literal(CONTENT_VERSION),
  generator: z.literal("seed-parity/1"),
});
export const tacticalScenarioSchema = z.strictObject({
  seed: z.number().int().min(0).max(4294967295),
  rules: z.literal("sandwich-rules/2"),
  content: z.literal("sandwich-rooms/2"),
  generator: z.literal("seed-parity/1"),
  loadout: loadoutSchema,
});
export const scenarioSchema = z.union([
  legacyScenarioSchema,
  tacticalScenarioSchema,
]);
export type LegacyScenario = z.infer<typeof legacyScenarioSchema>;
export type TacticalScenario = z.infer<typeof tacticalScenarioSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Outcome = "escaped" | "empty-handed" | "trapped";
export interface GameState {
  room: 0 | 1 | 2;
  turns: number;
  alarm: number;
  gadgets: number;
  inspected: boolean;
  patrol: "reading" | "watching";
  distracted: boolean;
  sandwich: boolean;
  outcome: Outcome | null;
  message: string;
  tactics?: TacticalState;
}
export interface Choice {
  action: Action;
  label: string;
  hint: string;
}
export interface Observation extends Omit<GameState, "patrol"> {
  patrol: "reading" | "watching" | null;
  roomTitle: string;
  description: string;
  clue: string;
  choices: Choice[];
}
export const scenarioFor = (seed: number): LegacyScenario =>
  legacyScenarioSchema.parse({
    seed,
    rules: RULES_VERSION,
    content: CONTENT_VERSION,
    generator: "seed-parity/1",
  });

export function tacticalScenarioFor(
  seed: number,
  id: CharacterId,
): TacticalScenario {
  return tacticalScenarioSchema.parse({
    seed,
    rules: "sandwich-rules/2",
    content: "sandwich-rooms/2",
    generator: "seed-parity/1",
    loadout: loadoutFor(id),
  });
}
