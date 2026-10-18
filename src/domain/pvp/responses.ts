import { z } from "zod";
import { characterIdSchema } from "../characters/definitions";
import { arenaChoiceSchema } from "../combat/arenas";
import { battleModeSchema, moveSchema } from "../combat/contracts";
import { battleViewSchema } from "../combat/responses";
import type { PvpView, PvpPreview, PvpHistoryRow } from "./view";
import type { QueueView } from "./queue";
const count = z.number().int().nonnegative();
const headline = z.enum(["Victory", "Defeat", "Draw", "No contest"]);
const outcomeKind = z.enum([
  "win",
  "draw",
  "forfeit",
  "abandoned",
  "no-contest",
]);
export const pvpHistorySchema: z.ZodType<PvpHistoryRow> = z.object({
  matchId: z.uuid(),
  headline,
  explanation: z.string(),
  rounds: count,
  fighter: z.string(),
  opponent: z.string(),
  arena: z.string(),
});
export const pvpViewSchema: z.ZodType<PvpView> = z.object({
  seated: z.literal(true),
  origin: z.enum(["public", "private"]),
  revision: count,
  serverNow: z.number(),
  invite: z.string(),
  phase: z.enum([
    "waiting",
    "joined",
    "ready",
    "loading",
    "choose",
    "present",
    "complete",
    "intermission",
    "expired",
    "closed",
  ]),
  prompt: z.string(),
  detail: z.string().nullable(),
  you: z.object({
    accessKind: z.enum(["token", "nft", "both"]).optional(),
    fighters: z.array(characterIdSchema).optional(),
    cosmetic: z.boolean().optional(),
    mode: battleModeSchema.optional(),
    tokenId: z.string().nullable().optional(),
    name: z.string(),
    characterId: characterIdSchema.nullable(),
    ready: z.boolean(),
    connected: z.boolean(),
    move: moveSchema.nullable(),
  }),
  opponent: z
    .object({
      name: z.string(),
      characterId: characterIdSchema.nullable(),
      ready: z.boolean(),
      connected: z.boolean(),
      locked: z.boolean(),
      joined: z.literal(true),
    })
    .nullable(),
  arenaChoice: arenaChoiceSchema,
  arenaName: z.string().nullable(),
  deadlineAt: z.number().nullable(),
  expiresAt: z.number(),
  battle: battleViewSchema.nullable(),
  result: z
    .object({
      headline,
      explanation: z.string(),
      kind: z.enum(["knockout", "time", "forfeit", "abandoned"]),
    })
    .nullable(),
  rematch: z.object({ you: z.boolean(), opponent: z.boolean() }),
  latestSeq: count,
  notice: z.string().nullable(),
  history: z.array(pvpHistorySchema),
  series: z
    .object({
      battle: count,
      you: count,
      opponent: count,
      phase: z.enum(["setup", "battle", "intermission", "complete"]),
      draws: count,
      deadlineAt: z.number().nullable(),
      outcome: z
        .object({
          kind: outcomeKind,
          winner: z.enum(["you", "opponent"]).nullable(),
          explanation: z.string(),
        })
        .nullable(),
    })
    .nullable(),
  roster: z.enum(["private", "starters", "public-six"]),
});
export const pvpPreviewSchema: z.ZodType<PvpPreview> = z.object({
  seated: z.literal(false),
  origin: z.enum(["public", "private"]),
  status: z.enum(["open", "full", "expired", "closed"]),
  names: z.array(z.string()),
  openSeats: count,
});
export const pvpRoomResponseSchema = z.union([pvpViewSchema, pvpPreviewSchema]);
export const pvpSessionSchema = z.object({
  activeInvite: z.string().nullable(),
  activePhase: z.string().nullable(),
  history: z.array(pvpHistorySchema),
});
export type PvpSession = z.infer<typeof pvpSessionSchema>;
export const pvpActionSchema = z.union([
  pvpRoomResponseSchema,
  pvpSessionSchema,
]);
export const queueViewSchema: z.ZodType<QueueView> = z.object({
  mode: battleModeSchema.optional(),
  tokenId: z.string().nullable().optional(),
  status: z.enum(["idle", "waiting", "offered", "matched", "blocked"]),
  othersWaiting: count,
  accepted: z.boolean(),
  deadlineAt: z.number().nullable(),
  serverNow: z.number(),
  invite: z.string().nullable(),
  lockedUntil: z.number().nullable(),
  message: z.string(),
});
