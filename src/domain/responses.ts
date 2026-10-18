import { z } from "zod";
import { identitySchema } from "./identity";
import type { CompetitorView } from "./competitor";
import type { PlayMenuState } from "./navigation";
export const competitorViewSchema: z.ZodType<CompetitorView> = z.object({
  identity: identitySchema,
  verifiedAt: z.number().nullable(),
  active: z
    .object({ kind: z.enum(["series", "queue", "story"]), href: z.string() })
    .nullable(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      headline: z.string(),
      kind: z.string(),
      fighter: z.string().nullable(),
      recordedAt: z.number(),
      canPublish: z.boolean(),
      publication: z.enum(["private", "published", "withdrawn"]),
    }),
  ),
});
export const playMenuSchema: z.ZodType<PlayMenuState> = z.object({
  story: z.enum(["begin", "continue", "ending"]),
  matchInvite: z.string().nullable(),
  practice: z.boolean(),
});
