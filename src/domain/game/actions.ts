import { z } from "zod";
import { skillActions } from "../characters/definitions";

export const basicActionSchema = z.enum([
  "inspect",
  "door",
  "arch",
  "gadget",
  "wait",
  "sneak",
  "vent",
  "take",
  "swap",
  "exit",
  "leave",
]);
export type BasicAction = z.infer<typeof basicActionSchema>;
export const actionSchema = z.enum([
  ...basicActionSchema.options,
  "inspect-mechanism",
  ...skillActions,
  "commit-door",
  "commit-sneak",
  "commit-take",
  "resolve-choice",
]);
export type Action = z.infer<typeof actionSchema>;
