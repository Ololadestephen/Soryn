import { z } from "zod";
import { actionSchema } from "./game/contracts";

export const stepRequestSchema = z.strictObject({
  operation: z.literal("step"),
  id: z.uuid(),
  step: z.number().int().min(0).max(32),
  action: actionSchema,
});
export const publicationRequestSchema = z.strictObject({
  operation: z.literal("publish"),
  id: z.uuid(),
  title: z.string().trim().min(1).max(72),
  alias: z.string().trim().min(1).max(32),
  consent: z.literal(true),
});
export const withdrawalRequestSchema = z.strictObject({
  operation: z.literal("withdraw"),
  id: z.uuid(),
});
