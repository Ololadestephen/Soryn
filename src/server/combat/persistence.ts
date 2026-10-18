import { z } from "zod";
import { accessGrantSchema } from "../../domain/access/policy";
import {
  snapshotSchema,
  stateSchema,
  roundSchema,
  moveSchema,
} from "../../domain/combat/contracts";
import { officialAuthoritySchema } from "../../domain/identity";
import { Store } from "../persistence";
import { readStored } from "../storedRecord";
import { ServiceError } from "../errors";
import { arenaSchema, arenaChoiceSchema } from "../../domain/combat/arenas";

export const battleRecordSchema = z
  .strictObject({
    id: z.uuid(),
    actor: z.uuid(),
    mode: z.enum(["guest", "official"]),
    origin: z.enum(["practice", "story"]).optional(),
    interruption: z
      .enum([
        "ownership-changed",
        "generation-invalidated",
        "verification-unavailable",
        "reservation-expired",
        "legacy-encounter",
        "cancelled",
      ])
      .optional(),
    authority: officialAuthoritySchema.nullable(),
    access: accessGrantSchema.optional(),
    cosmetic: z.boolean().optional(),
    snapshot: snapshotSchema,
    arena: arenaSchema.optional(),
    arenaChoice: arenaChoiceSchema.optional(),
    state: stateSchema,
    rounds: z.array(roundSchema).max(20),
    pending: z
      .strictObject({ move: moveSchema, reason: z.string().max(240) })
      .nullable(),
  })
  .refine(
    (record) => !record.access || record.access.actor === record.actor,
    "Wallet battle grant belongs to another player.",
  )
  .refine(
    (record) =>
      record.mode === "guest"
        ? record.authority === null
        : record.authority !== null,
    "Battle authority mismatch.",
  );
export type BattleRecord = z.infer<typeof battleRecordSchema>;
export class BattleStore {
  constructor(readonly store: Store) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS battles (id TEXT PRIMARY KEY, actor TEXT NOT NULL, mode TEXT NOT NULL, record TEXT NOT NULL)",
    );
  }
  get(id: string, actor: string): BattleRecord {
    const row = this.store.db
      .prepare("SELECT record FROM battles WHERE id=? AND actor=?")
      .get(id, actor);
    if (!row)
      throw new ServiceError(404, "Battle unavailable for this session.");
    return readStored(battleRecordSchema, row.record);
  }
  find(id: string) {
    return !!this.store.db.prepare("SELECT 1 FROM battles WHERE id=?").get(id);
  }
  save(record: BattleRecord) {
    const result = this.store.db
      .prepare(
        "INSERT INTO battles VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record WHERE battles.actor=excluded.actor AND battles.mode=excluded.mode",
      )
      .run(
        record.id,
        record.actor,
        record.mode,
        JSON.stringify(battleRecordSchema.parse(record)),
      );
    if (!result.changes) throw new ServiceError(409, "Battle ID unavailable.");
  }
  history(actor: string, mode: "guest" | "official") {
    return this.store.db
      .prepare(
        "SELECT record FROM battles WHERE actor=? AND mode=? ORDER BY rowid DESC LIMIT 50",
      )
      .all(actor, mode)
      .map((row) => readStored(battleRecordSchema, row.record));
  }
}
