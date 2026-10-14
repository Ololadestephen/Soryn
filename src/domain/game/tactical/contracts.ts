import { z } from "zod";
import { loadoutSchema } from "../../characters/definitions";
import { actionSchema, type BasicAction } from "../actions";
export const eventSchema = z.strictObject({
  action: actionSchema,
  kind: z.enum(["move", "skill", "interact", "commit", "cancel"]),
  from: z.number().int().min(0).max(2),
  to: z.number().int().min(0).max(2),
  cost: z.number().int().min(0).max(2),
  alarmDelta: z.number().int().min(-2).max(2),
  gadgetDelta: z.number().int().min(-1).max(1),
  message: z.string().max(600),
});
export const tacticsSchema = z
  .strictObject({
    loadout: loadoutSchema,
    charges: z.number().int().min(0).max(2),
    consumed: z.number().int().min(0).max(10),
    mechanismKnown: z.boolean(),
    effects: z.strictObject({
      bubble: z.boolean(),
      trail: z.number().int().min(0).max(2),
      steady: z.boolean(),
      reroute: z.boolean(),
    }),
    pending: z.enum(["door", "sneak", "take"]).nullable(),
    events: z.array(eventSchema).max(32),
  })
  .refine(
    (value) => value.charges <= value.loadout.charges,
    "Remaining charge budget exceeds initial budget.",
  );
export type TacticalState = z.infer<typeof tacticsSchema>;
export type CommittedAction = Extract<BasicAction, "door" | "sneak" | "take">;

export function tacticsFor(state: { tactics?: TacticalState }): TacticalState {
  if (!state.tactics)
    throw new Error("Tactical rules require a frozen character state.");
  return state.tactics;
}
