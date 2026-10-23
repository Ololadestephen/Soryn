import { randomUUID } from "node:crypto";
import { z } from "zod";
import { characterIdSchema } from "../../domain/characters/definitions";
import { addressSchema, identitySchema } from "../../domain/identity";
import {
  freshJourney,
  journeySchema,
  type Journey,
} from "../../domain/story/journey";
import { STORY_POLICY, type StoryRoute } from "../../domain/story/sanctuary";
import type { Store } from "../persistence";
import { readStored } from "../storedRecord";

export const officialBindingSchema = z.strictObject({
  identity: identitySchema,
  owner: addressSchema,
  generation: z.uuid(),
});
export type StoryOfficialBinding = z.infer<typeof officialBindingSchema>;

export function sameBinding(
  left: StoryOfficialBinding,
  right: StoryOfficialBinding,
): boolean {
  return (
    left.owner === right.owner &&
    left.generation === right.generation &&
    left.identity.chainId === right.identity.chainId &&
    left.identity.collection === right.identity.collection &&
    left.identity.tokenId === right.identity.tokenId
  );
}

export const progressSchema = z.strictObject({
  policy: z.literal(STORY_POLICY),
  journey: journeySchema.nullable().optional(),
  fighter: characterIdSchema.nullable(),
  step: z.enum([
    "meet",
    "scout",
    "route",
    "path",
    "guardian",
    "boss",
    "ending",
  ]),
  route: z.enum(["grove", "foundry"]).nullable(),
  battleId: z.uuid().nullable(),
  completed: z.boolean(),
  completionId: z.uuid().nullable(),
  retry: z.boolean().default(false),
  interruption: z
    .enum([
      "ownership-changed",
      "generation-invalidated",
      "verification-unavailable",
      "reservation-expired",
      "legacy-encounter",
      "cancelled",
    ])
    .nullable()
    .default(null),
  unavailableSince: z.number().int().nullable().default(null),
  /**
   * Official participation binding. Absent on guest rows and on rows from
   * before official story existed; those rows keep working as guest rows.
   */
  official: officialBindingSchema.nullable().default(null),
});
export type StoryProgress = z.infer<typeof progressSchema>;

export function freshProgress(): StoryProgress {
  return {
    policy: STORY_POLICY,
    journey: freshJourney(randomUUID()),
    fighter: null,
    step: "meet",
    route: null,
    battleId: null,
    completed: false,
    completionId: null,
    retry: false,
    interruption: null,
    unavailableSince: null,
    official: null,
  };
}

const rewardSchema = z.strictObject({
  key: z.string(),
  title: z.string(),
  earnedAt: z.number(),
});
const runSchema = z.strictObject({
  runId: z.uuid(),
  policy: z.literal("sanctuary-journey/2"),
  route: z.enum(["grove", "foundry"]).nullable(),
  vow: z.enum(["restore", "preserve"]).nullable(),
  sideComplete: z.boolean(),
  completedAt: z.number(),
});
/** Keeper-private run archive and account-owned earned titles; never a publication API. */
export class StoryLedger {
  constructor(private readonly store: Store) {}
  private owner(actor: string, wallet?: string) {
    if (!wallet) return actor;
    return String(
      this.store.db
        .prepare("SELECT actor FROM wallet_accounts WHERE wallet=?")
        .get(wallet)?.actor ?? actor,
    );
  }
  rewards(actor: string, wallet?: string) {
    return this.store.db
      .prepare("SELECT record FROM story_rewards WHERE actor=? ORDER BY rowid")
      .all(this.owner(actor, wallet))
      .map((row) => readStored(rewardSchema, row.record));
  }
  runs(actor: string) {
    return this.store.db
      .prepare(
        "SELECT record FROM story_runs WHERE actor=? ORDER BY rowid DESC LIMIT 30",
      )
      .all(actor)
      .map((row) => readStored(runSchema, row.record));
  }
  award(
    actor: string,
    wallet: string | undefined,
    key: string,
    title: string,
    now: number,
  ) {
    this.store.db
      .prepare("INSERT OR IGNORE INTO story_rewards VALUES (?,?,?)")
      .run(
        this.owner(actor, wallet),
        key,
        JSON.stringify(rewardSchema.parse({ key, title, earnedAt: now })),
      );
  }
  archive(
    actor: string,
    journey: Journey,
    route: StoryRoute | null,
    wallet: string | undefined,
    now: number,
  ) {
    const record = runSchema.parse({
      runId: journey.runId,
      policy: journey.policy,
      route,
      vow: journey.vow,
      sideComplete: journey.sideComplete,
      completedAt: now,
    });
    this.store.db
      .prepare(
        "INSERT INTO story_runs VALUES (?,?,?) ON CONFLICT(actor,run_id) DO UPDATE SET record=json_set(story_runs.record,'$.sideComplete',json(CASE WHEN json_extract(excluded.record,'$.sideComplete') THEN 'true' ELSE 'false' END))",
      )
      .run(actor, journey.runId, JSON.stringify(record));
    this.award(actor, wallet, "sanctuary-witness", "Sanctuary Witness", now);
  }
  hasProgress(actor: string): boolean {
    return !!this.store.db
      .prepare("SELECT 1 FROM story_progress WHERE actor=?")
      .get(actor);
  }
  loadProgress(actor: string): StoryProgress {
    const row = this.store.db
      .prepare("SELECT record FROM story_progress WHERE actor=?")
      .get(actor) as { record: string } | undefined;
    return row ? readStored(progressSchema, row.record) : freshProgress();
  }
  saveProgress(actor: string, progress: StoryProgress): void {
    const record = JSON.stringify(progressSchema.parse(progress));
    this.store.db
      .prepare(
        `INSERT INTO story_progress (actor, record) VALUES (?, ?)
         ON CONFLICT(actor) DO UPDATE SET record=excluded.record`,
      )
      .run(actor, record);
  }
  actorsForReservation(encounter: string, generation: string): string[] {
    return this.store.db
      .prepare(
        "SELECT actor FROM story_progress WHERE json_extract(record, '$.battleId')=? AND json_extract(record, '$.official.generation')=?",
      )
      .all(encounter, generation)
      .map((row) => String(row.actor));
  }
}
