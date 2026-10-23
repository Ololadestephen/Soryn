import { z } from "zod";
import { characterIdSchema } from "./characters/definitions";
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
export const guestStartRequestSchema = z.strictObject({
  operation: z.literal("start"),
  id: z.uuid(),
  mode: z.literal("guest"),
  characterId: characterIdSchema.optional(),
  exhibitId: z.uuid().nullable(),
  retryOf: z.uuid().nullable(),
});
export const guestRaceRequestSchema = z.strictObject({
  operation: z.literal("race"),
  id: z.uuid(),
  chapterId: z.uuid(),
});
export const officialStartRequestSchema = z.strictObject({
  operation: z.literal("start"),
  id: z.uuid(),
  retryOf: z.uuid().nullable(),
  characterId: characterIdSchema.optional(),
});
export const officialPublicationRequestSchema = publicationRequestSchema.extend(
  {
    museum: z.boolean().optional(),
  },
);

export type StepRequest = z.infer<typeof stepRequestSchema>;
export type PublicationRequest = z.infer<typeof publicationRequestSchema>;
export type WithdrawalRequest = z.infer<typeof withdrawalRequestSchema>;
export type GuestStartRequest = z.infer<typeof guestStartRequestSchema>;
export type GuestRaceRequest = z.infer<typeof guestRaceRequestSchema>;
export type OfficialStartRequest = z.infer<typeof officialStartRequestSchema>;
export type OfficialPublicationRequest = z.infer<
  typeof officialPublicationRequestSchema
>;
export type SharedAdventureMutationRequest =
  StepRequest | PublicationRequest | WithdrawalRequest;
export type GuestMutationRequest =
  GuestStartRequest | GuestRaceRequest | SharedAdventureMutationRequest;
export type OfficialMutationRequest =
  | OfficialStartRequest
  | OfficialPublicationRequest
  | SharedAdventureMutationRequest;
export type AdventureMutationRequest =
  GuestMutationRequest | OfficialMutationRequest;
