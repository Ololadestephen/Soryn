import { z } from "zod";
import { arenaSchema } from "./arenas";
import {
  battleModeSchema,
  difficultySchema,
  moveSchema,
  roundSchema,
  snapshotSchema,
  stateSchema,
  type BattleView,
  type BattleSession,
} from "./contracts";
export const battleViewSchema: z.ZodType<BattleView> = z.object({
  arena: arenaSchema.optional(),
  id: z.uuid(),
  mode: battleModeSchema,
  accessKind: z.enum(["token", "nft", "both"]).optional(),
  cosmetic: z.boolean().optional(),
  tokenId: z.string().nullable(),
  snapshot: snapshotSchema,
  state: stateSchema,
  rounds: z.array(roundSchema).max(20),
  legal: z.array(moveSchema).max(3),
});
export const battleSessionSchema: z.ZodType<
  BattleSession & { authorized?: boolean; interruption?: string | null }
> = z.object({
  battle: battleViewSchema.nullable(),
  history: z.array(
    z.object({
      id: z.uuid(),
      fighter: z.string(),
      outcome: z.string(),
      rounds: z.number().int(),
      difficulty: z.union([difficultySchema, z.literal("legacy")]).optional(),
      arena: arenaSchema.optional(),
    }),
  ),
  authorized: z.boolean().optional(),
  interruption: z.string().nullable().optional(),
});
