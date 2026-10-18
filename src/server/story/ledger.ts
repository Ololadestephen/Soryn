import { z } from "zod";
import type { Journey } from "../../domain/story/journey";
import type { StoryRoute } from "../../domain/story/sanctuary";
import type { Store } from "../persistence";
import { readStored } from "../storedRecord";
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
  constructor(private readonly store: Store) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS story_runs (actor TEXT NOT NULL, run_id TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(actor,run_id)); CREATE TABLE IF NOT EXISTS story_rewards (actor TEXT NOT NULL, reward_key TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(actor,reward_key))",
    );
  }
  private owner(actor: string, wallet?: string) {
    if (
      !wallet ||
      !this.store.db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='wallet_accounts'",
        )
        .get()
    )
      return actor;
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
}
