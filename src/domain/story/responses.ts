import { journeySchema } from "./journey";
import { z } from "zod";
import { characterIdSchema } from "../characters/definitions";
import { arenaSchema } from "../combat/arenas";
import { difficultySchema } from "../combat/contracts";
import { battleViewSchema } from "../combat/responses";
import { STORY_POLICY, type StoryStep, type StoryRoute } from "./sanctuary";
export const storyStepSchema: z.ZodType<StoryStep> = z.enum([
  "meet",
  "scout",
  "route",
  "path",
  "guardian",
  "boss",
  "ending",
]);
export const storyRouteSchema: z.ZodType<StoryRoute> = z.enum([
  "grove",
  "foundry",
]);
export const storyStateSchema = z.object({
  policy: z.literal(STORY_POLICY),
  journey: journeySchema
    .omit({ interaction: true })
    .extend({ interaction: z.object({ expiresAt: z.number() }).nullable() })
    .nullable()
    .optional(),
  rewards: z
    .array(
      z.object({ key: z.string(), title: z.string(), earnedAt: z.number() }),
    )
    .optional(),
  runs: z
    .array(
      z.object({
        runId: z.string(),
        route: z.string().nullable(),
        vow: z.string().nullable(),
        sideComplete: z.boolean(),
        completedAt: z.number(),
      }),
    )
    .optional(),
  step: storyStepSchema,
  fighter: characterIdSchema.nullable(),
  route: storyRouteSchema.nullable(),
  battleId: z.uuid().nullable(),
  completed: z.boolean(),
  completionId: z.uuid().nullable(),
  encounter: z
    .object({
      opponent: characterIdSchema,
      difficulty: difficultySchema,
      arena: arenaSchema,
      objective: z.string(),
    })
    .nullable(),
  lost: z.boolean().optional(),
  authorized: z.boolean().optional(),
  interruption: z.string().nullable().optional(),
  tokenId: z.string().optional(),
  battle: battleViewSchema.nullable().optional(),
});
export type StoryState = z.infer<typeof storyStateSchema>;
