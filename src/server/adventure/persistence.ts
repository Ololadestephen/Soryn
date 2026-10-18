import { z } from "zod";
import { actionSchema, scenarioSchema } from "../../domain/game/contracts";
import { officialAuthoritySchema, identitySchema } from "../../domain/identity";
import { ServiceError } from "../errors";
import { readStored } from "../storedRecord";
import type { Store } from "../persistence";
export { profileSchema } from "../../domain/ghosts/contracts";
import { profileSchema } from "../../domain/ghosts/contracts";
import { tacticsSchema } from "../../domain/game/tactical/contracts";
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

export class AdventureStore {
  constructor(readonly store: Store) {}
  private get db() {
    return this.store.db;
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
