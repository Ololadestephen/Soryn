import { z } from "zod";
import {
  actionSchema,
  scenarioSchema,
  type GameState,
  type Observation,
} from "../game/contracts";
import { tacticsSchema } from "../game/tactical/contracts";
import { profileSchema } from "../ghosts/contracts";
import { loadoutSchema } from "../characters/definitions";
import { identitySchema } from "../identity";
import type { RunView, ExhibitSummary, PublicReplayView } from "../views";
import type {
  GuestJournalView,
  GuestSessionView,
  JournalChapter,
} from "../journal";
import type { PublicChapter, OfficialSessionView } from "../officialViews";
const text = z.string();
const number = z.number().int();
const comparison = z.enum(["better", "tied", "behind"]);
const cohort = z.enum(["first-recorded", "informed-retry"]);
const outcome = z.enum(["escaped", "empty-handed", "trapped"]);
const stateFields = {
  room: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  turns: number,
  alarm: number,
  gadgets: number,
  inspected: z.boolean(),
  patrol: z.enum(["reading", "watching"]),
  distracted: z.boolean(),
  sandwich: z.boolean(),
  outcome: outcome.nullable(),
  message: text,
  tactics: tacticsSchema.optional(),
};
const gameStateSchema: z.ZodType<GameState> = z.object(stateFields);
const observationSchema: z.ZodType<Observation> = z.object({
  ...stateFields,
  patrol: stateFields.patrol.nullable(),
  roomTitle: text,
  description: text,
  clue: text,
  choices: z.array(z.object({ action: actionSchema, label: text, hint: text })),
});
const raceSchema = z.object({
  actions: z.array(actionSchema),
  reasons: z.array(text),
  result: gameStateSchema,
});
const comparisonSchema = z
  .object({ original: comparison, ghost: comparison })
  .nullable();
export const exhibitSummarySchema: z.ZodType<ExhibitSummary> = z.object({
  id: z.uuid(),
  title: text,
  alias: text,
  outcome: text,
  turnsUsed: number,
  identity: identitySchema.nullable().optional(),
  loadout: loadoutSchema.optional(),
});
export const runViewSchema: z.ZodType<RunView> = z.object({
  id: z.uuid(),
  mode: z.enum(["guest", "official"]),
  borrowed: z.boolean().optional(),
  identity: identitySchema.nullable().optional(),
  exhibitId: z.uuid().nullable(),
  step: number,
  observation: observationSchema,
  cohort,
  replay: z
    .object({
      scenario: scenarioSchema,
      actions: z.array(actionSchema),
      frames: z.array(observationSchema),
    })
    .nullable(),
  ghost: z
    .object({ version: text, profile: profileSchema, race: raceSchema })
    .nullable(),
  rival: z
    .object({
      source: z.enum(["previous-run", "museum"]),
      label: text,
      version: text,
      replay: z
        .object({
          frames: z.array(observationSchema),
          actions: z.array(actionSchema),
          reasons: z.array(text),
          comparison,
        })
        .nullable(),
    })
    .nullable(),
  comparison: comparisonSchema,
  publication: exhibitSummarySchema.nullable(),
});
const challengeSchema = z.object({
  id: z.uuid(),
  title: text,
  available: z.boolean(),
});
const journalChapterSchema: z.ZodType<JournalChapter> = z.object({
  id: z.uuid(),
  outcome,
  turnsUsed: number,
  alarm: number,
  cohort,
  ghostVersion: text.nullable(),
  loadout: loadoutSchema.optional(),
  trainingRuns: number,
  challenge: challengeSchema.nullable(),
  comparison: comparisonSchema,
});
export const journalSchema: z.ZodType<GuestJournalView> = z.object({
  chapters: z.array(journalChapterSchema),
  challenges: z.array(
    z.object({
      challenge: challengeSchema,
      cohorts: z.array(
        z.object({
          cohort,
          attempts: number,
          first: journalChapterSchema,
          best: journalChapterSchema,
          improvement: comparison,
        }),
      ),
    }),
  ),
});
export const guestSessionSchema: z.ZodType<GuestSessionView> = z.object({
  run: runViewSchema.nullable(),
  museum: z.array(exhibitSummarySchema),
  journal: journalSchema,
});
export const guestMutationSchema = z.object({
  run: runViewSchema.optional(),
  journal: journalSchema,
});
export const journalReplySchema = z.object({ chapter: runViewSchema });
export const publicReplaySchema: z.ZodType<PublicReplayView> = z.object({
  exhibit: exhibitSummarySchema,
  frames: z.array(observationSchema),
  ghost: raceSchema.extend({ frames: z.array(observationSchema) }),
});
const chapterSchema: z.ZodType<PublicChapter> = z.object({
  id: z.uuid(),
  identity: identitySchema,
  title: text,
  alias: text,
  scenario: scenarioSchema,
  actions: z.array(actionSchema),
  ghost: z.object({ version: text, profile: profileSchema }),
  publishedAt: number,
  status: z.enum(["published", "withdrawn"]),
});
export const officialSessionSchema: z.ZodType<OfficialSessionView> = z.object({
  account: z
    .object({
      wallet: text,
      identity: identitySchema,
      expires: number,
      grant: z.boolean(),
    })
    .nullable(),
  run: runViewSchema.nullable(),
  chapters: z.array(chapterSchema),
  publication: chapterSchema.nullable(),
  withdrawals: z.array(
    z.object({ runId: z.uuid(), title: text, identity: identitySchema }),
  ),
});
export const signInChallengeSchema = z.object({
  nonce: text,
  message: text,
  owner: z.boolean(),
});

export const publicChaptersSchema = z.object({
  identity: identitySchema,
  chapters: z.array(chapterSchema),
});
