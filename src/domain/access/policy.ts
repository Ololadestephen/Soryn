import { z } from "zod";
import { characterIdSchema, type CharacterId } from "../characters/definitions";

export const ACCESS_POLICY = "soryn-access/1" as const;
export const TOKEN_UNLOCKS = ["aegis", "nyx"] as const;
export const STARTERS = ["pip", "bolt", "patch", "moss"] as const;
export const PUBLIC_FIGHTERS = [...STARTERS, ...TOKEN_UNLOCKS] as const;
export const CHOG_MINIMUM = 50n * 10n ** 18n;
export const ACCESS_FRESH_MS = 30_000;
export const accessKindSchema = z.enum(["token", "nft", "both"]);
/** A server-issued, encounter-local projection. Wallets and balances stay private. */
export const accessGrantSchema = z.strictObject({
  policy: z.literal(ACCESS_POLICY),
  id: z.uuid(),
  actor: z.uuid(),
  kind: accessKindSchema,
  checkedAt: z.number().int(),
  admissionUntil: z.number().int(),
  fighters: z.array(characterIdSchema).min(4).max(12),
  provenance: z
    .array(
      z.strictObject({
        kind: z.enum(["token", "nft"]),
        chainId: z.literal(143),
        contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        block: z.string().regex(/^0x[0-9a-f]+$/),
        checkedAt: z.number().int(),
      }),
    )
    .max(2)
    .optional(),
});
export type AccessGrant = z.infer<typeof accessGrantSchema>;
export type AccessKind = z.infer<typeof accessKindSchema>;
export function publicFighter(id: CharacterId) {
  return (PUBLIC_FIGHTERS as readonly CharacterId[]).includes(id);
}
export function grantedFighter(id: CharacterId, grant?: AccessGrant | null) {
  return !!grant?.fighters.includes(id);
}
export const accessViewSchema = z.object({
  status: z.enum([
    "practice-only",
    "token",
    "nft",
    "both",
    "unavailable",
    "paused",
    "signed-out",
  ]),
  message: z.string(),
  fighters: z.array(characterIdSchema),
  checkedAt: z.number().nullable(),
  equipped: z.boolean().optional(),
  authenticated: z.boolean().optional(),
});
export type AccessView = z.infer<typeof accessViewSchema>;
