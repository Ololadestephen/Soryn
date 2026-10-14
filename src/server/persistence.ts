import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { actionSchema, scenarioSchema } from "../domain/game/contracts";
import { ServiceError } from "./errors";
import { readStored } from "./storedRecord";
import { officialAuthoritySchema, identitySchema } from "../domain/identity";

const RATE_WINDOW_MS = 60 * 1000;

export { profileSchema } from "../domain/ghosts/contracts";
import { profileSchema } from "../domain/ghosts/contracts";
import { tacticsSchema } from "../domain/game/tactical/contracts";
export const runSchema = z
  .strictObject({
    id: z.uuid(),
    actor: z.uuid(),
    scenario: scenarioSchema,
    tactics: tacticsSchema.nullable().default(null),
    actions: z.array(actionSchema).max(32),
    mode: z.enum(["guest", "official"]),
    authority: officialAuthoritySchema.nullable().default(null),
    exhibitId: z.uuid().nullable(),
    retryOf: z.uuid().nullable(),
    ghostOf: z.uuid().nullable().default(null),
    cohort: z.enum(["first-recorded", "informed-retry"]),
    rival: z
      .strictObject({
        source: z.enum(["previous-run", "museum"]),
        label: z.string().min(1).max(72),
        version: z.string().length(64),
        profile: profileSchema,
      })
      .nullable()
      .default(null),
    ghost: z
      .strictObject({
        version: z.string().length(64),
        trainingIds: z.array(z.uuid()).max(100),
        profile: profileSchema,
      })
      .nullable(),
  })
  .refine(
    (run) =>
      run.mode === "guest" ? run.authority === null : run.authority !== null,
    "Run mode and authority must match.",
  )
  .refine(
    (run) =>
      run.scenario.rules === "sandwich-rules/2"
        ? !!run.tactics &&
          JSON.stringify(run.tactics.loadout) ===
            JSON.stringify(run.scenario.loadout)
        : run.tactics === null,
    "Saved rules and tactical loadout must match.",
  );
export type RunRecord = Omit<z.infer<typeof runSchema>, "tactics"> & {
  tactics?: z.infer<typeof tacticsSchema> | null;
};
export const exhibitSchema = z.strictObject({
  id: z.uuid(),
  runId: z.uuid(),
  title: z.string().min(1).max(72),
  alias: z.string().min(1).max(32),
  scenario: scenarioSchema,
  actions: z.array(actionSchema).max(32),
  ghost: profileSchema,
  status: z.enum(["published", "withdrawn"]),
  identity: identitySchema.nullable().default(null),
});
export type ExhibitRecord = z.infer<typeof exhibitSchema>;

export class Store {
  readonly db: DatabaseSync;
  private transactionDepth = 0;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, actor TEXT NOT NULL, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS exhibits (id TEXT PRIMARY KEY, actor TEXT NOT NULL, run_id TEXT UNIQUE NOT NULL, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS exposures (actor TEXT NOT NULL, scenario TEXT NOT NULL, PRIMARY KEY(actor, scenario));
      CREATE TABLE IF NOT EXISTS rate_limits (actor TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(actor, bucket));
      `);
    if (Number(this.db.prepare("PRAGMA user_version").get()?.user_version) < 1)
      this.db.exec("PRAGMA user_version=1");
  }
  close(): void {
    this.db.close();
  }
  transaction<T>(operation: () => T): T {
    const depth = this.transactionDepth;
    const savepoint = `chog_nested_${depth}`;
    this.db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
    this.transactionDepth++;
    try {
      const result = operation();
      this.db.exec(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}`);
      if (depth > 0) this.db.exec(`RELEASE ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }
  rateLimit(actor: string, now = Date.now(), limit = 60): void {
    const bucket = Math.floor(now / RATE_WINDOW_MS);
    this.db.prepare("DELETE FROM rate_limits WHERE bucket < ?").run(bucket - 1);
    this.db
      .prepare(
        "INSERT INTO rate_limits VALUES (?, ?, 1) ON CONFLICT(actor,bucket) DO UPDATE SET count=count+1",
      )
      .run(actor, bucket);
    const row = this.db
      .prepare("SELECT count FROM rate_limits WHERE actor=? AND bucket=?")
      .get(actor, bucket);
    if (Number(row?.count) > limit)
      throw new ServiceError(
        429,
        "Too many requests. Wait a minute and retry.",
      );
  }
  getRun(id: string, actor: string): RunRecord {
    const row = this.db
      .prepare("SELECT record FROM runs WHERE id=? AND actor=?")
      .get(id, actor);
    if (!row)
      throw new ServiceError(404, "Run unavailable for this guest session.");
    return readStored(runSchema, row.record);
  }
  saveRun(run: RunRecord): void {
    const saved = this.db
      .prepare(
        "INSERT INTO runs VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET record=excluded.record WHERE runs.actor=excluded.actor",
      )
      .run(run.id, run.actor, JSON.stringify(runSchema.parse(run)));
    if (!Number(saved.changes))
      throw new ServiceError(409, "Run ID unavailable. Start with a new ID.");
  }
  history(actor: string): RunRecord[] {
    return this.db
      .prepare(
        "SELECT record FROM runs WHERE actor=? ORDER BY rowid DESC LIMIT 100",
      )
      .all(actor)
      .map((row) => readStored(runSchema, row.record));
  }
  expose(actor: string, scenario: RunRecord["scenario"]): boolean {
    // Same authored adventure remains familiar even when its patrol seed changes.
    const exposureKey = JSON.stringify({
      content: scenario.content,
      rules: scenario.rules,
    });
    const familyKeys = [
      JSON.stringify({
        content: "sandwich-rooms/1",
        rules: "sandwich-rules/1",
      }),
      JSON.stringify({
        content: "sandwich-rooms/2",
        rules: "sandwich-rules/2",
      }),
    ];
    const familiar = !!this.db
      .prepare(
        "SELECT 1 FROM exposures WHERE actor=? AND scenario IN (?, ?) LIMIT 1",
      )
      .get(actor, ...familyKeys);
    return (
      Number(
        this.db
          .prepare("INSERT OR IGNORE INTO exposures VALUES (?, ?)")
          .run(actor, exposureKey).changes,
      ) === 0 || familiar
    );
  }
  exhibit(id: string): ExhibitRecord {
    const row = this.db
      .prepare("SELECT record FROM exhibits WHERE id=?")
      .get(id);
    if (!row) throw new ServiceError(404, "Exhibit not found.");
    return readStored(exhibitSchema, row.record);
  }
  publication(runId: string): ExhibitRecord | null {
    const row = this.db
      .prepare("SELECT record FROM exhibits WHERE run_id=?")
      .get(runId);
    return row ? readStored(exhibitSchema, row.record) : null;
  }
  saveExhibit(exhibit: ExhibitRecord, actor: string): void {
    this.db
      .prepare(
        "INSERT INTO exhibits VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET record=excluded.record",
      )
      .run(
        exhibit.id,
        actor,
        exhibit.runId,
        JSON.stringify(exhibitSchema.parse(exhibit)),
      );
  }
  museum(): ExhibitRecord[] {
    return this.db
      .prepare("SELECT record FROM exhibits ORDER BY rowid DESC LIMIT 100")
      .all()
      .map((row) => readStored(exhibitSchema, row.record))
      .filter((record) => record.status === "published");
  }
}
