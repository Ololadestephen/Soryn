import { randomUUID } from "node:crypto";
import { z } from "zod";
import { tokenKey, type TokenIdentity } from "../../domain/identity";
import type { Store } from "../persistence";
import { readStored } from "../storedRecord";
import { ServiceError } from "../errors";
import type { OfficialAuthority } from "../../domain/identity";

/**
 * Private official token results, published only after explicit per-result consent.
 * One row per completed official series, official
 * story chapter, and — inside a series — one row per finished battle.
 * Guest results never reach this table.
 *
 * Rows are attributed to the token, not the wallet: `owner`/`generation`
 * record who was verified when the result landed, and the public profile
 * strips both. Writes are idempotent on (token, kind, source) so retries,
 * restarts, and replayed reads cannot double-record a result.
 */
export const tokenRecordKinds = [
  "series",
  "battle",
  "story",
  "story-encounter",
  "no-contest",
] as const;
export type TokenRecordKind = (typeof tokenRecordKinds)[number];

export const tokenRecordSchema = z.strictObject({
  id: z.uuid(),
  /** chain:collection:tokenId */
  token: z.string().min(5).max(160),
  kind: z.enum(tokenRecordKinds),
  /** Stable identity of the source result: series id, match id, or completion id. */
  source: z.string().min(1).max(160),
  headline: z.string().min(1).max(40),
  explanation: z.string().min(1).max(200),
  fighter: z.string().max(40).nullable().default(null),
  opponent: z.string().max(80).nullable().default(null),
  opponentFighter: z.string().max(40).nullable().default(null),
  arena: z.string().max(60).nullable().default(null),
  rounds: z.number().int().min(0).max(100).nullable().default(null),
  /** "you–opponent" wins, from this token's seat. */
  score: z.string().max(20).nullable().default(null),
  route: z.string().max(40).nullable().default(null),
  owner: z.string().min(1).max(64),
  generation: z.string().min(1).max(128),
  recordedAt: z.number().int(),
  rules: z.string().min(1).max(120).nullable().optional(),
  reason: z.string().max(48).nullable().optional(),
  eligibleForPublication: z.boolean().optional(),
  publication: z
    .strictObject({
      policy: z.literal("soryn-record-consent/1"),
      alias: z.string().trim().min(1).max(32),
      at: z.number().int(),
      status: z.enum(["published", "withdrawn"]),
    })
    .nullable()
    .optional(),
});
export type TokenRecord = z.infer<typeof tokenRecordSchema>;

/** A record row as shown publicly: attribution to the wallet removed. */
export interface PublicTokenRecord {
  id: string;
  attribution: string;
  rules: string;
  headline: string;
  explanation: string;
  fighter: string | null;
  opponent: string | null;
  opponentFighter: string | null;
  arena: string | null;
  rounds: number | null;
  score: string | null;
  route: string | null;
  kind: TokenRecordKind;
  recordedAt: number;
}

export function publicRecord(record: TokenRecord): PublicTokenRecord {
  if (
    record.publication?.status !== "published" ||
    !record.rules ||
    !record.eligibleForPublication
  )
    throw new ServiceError(404, "This record is private.");
  return {
    id: record.id,
    attribution: record.publication.alias,
    rules: record.rules,
    headline: record.headline,
    explanation:
      record.kind === "no-contest"
        ? record.reason === "ownership-changed"
          ? "Ownership changed; this encounter ended without a winner."
          : record.reason === "generation-invalidated"
            ? "The ownership generation was invalidated; this encounter ended without a winner."
            : record.reason === "verification-unavailable"
              ? "Verification remained unavailable; this encounter ended without a winner."
              : "This encounter ended without a winner."
        : record.kind === "story"
          ? "Completed The Fractured Sanctuary."
          : record.kind === "story-encounter"
            ? "Completed a Sanctuary encounter."
            : "A completed Soryn combat result.",
    fighter: record.fighter,
    opponent: null,
    opponentFighter: record.opponentFighter,
    arena: record.arena,
    rounds: record.rounds,
    score: record.score,
    route: record.route,
    kind: record.kind,
    recordedAt: record.recordedAt,
  };
}

export interface TokenRecordSummary {
  series: number;
  battles: number;
  story: number;
  noContest: number;
  wins: number;
  losses: number;
  draws: number;
}

const LIST_LIMIT = 200;

export class TokenRecords {
  constructor(private readonly store: Store) {}
  /** Idempotent: a retry of the same result is ignored, not duplicated. */
  write(entry: Omit<TokenRecord, "id"> & { id?: string }): boolean {
    const record = tokenRecordSchema.parse({ id: randomUUID(), ...entry });
    const changes = Number(
      this.store.db
        .prepare(
          `INSERT OR IGNORE INTO token_record
           (id, token, kind, source, recorded_at, record)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.token,
          record.kind,
          record.source,
          record.recordedAt,
          JSON.stringify(record),
        ).changes,
    );
    return changes > 0;
  }
  list(identity: TokenIdentity): TokenRecord[] {
    return this.rows(tokenKey(identity));
  }
  published(identity: TokenIdentity): PublicTokenRecord[] {
    return this.rows(tokenKey(identity), true).map(publicRecord);
  }
  publish(
    id: string,
    authority: OfficialAuthority,
    alias: string,
    now: number,
  ) {
    return this.store.transaction(() => {
      const row = this.store.db
        .prepare("SELECT record FROM token_record WHERE id=? AND token=?")
        .get(id, tokenKey(authority.identity));
      if (!row) throw new ServiceError(404, "This record is unavailable.");
      const record = readStored(tokenRecordSchema, row.record);
      if (
        record.owner !== authority.ownership.owner ||
        record.generation !== authority.generation ||
        !record.eligibleForPublication ||
        !record.rules
      )
        throw new ServiceError(
          403,
          "Only the verified participating keeper may publish this result; legacy private history stays private.",
        );
      if (record.publication) {
        if (
          record.publication.status === "withdrawn" ||
          record.publication.alias !== alias.trim()
        )
          throw new ServiceError(
            409,
            "This publication consent has already been recorded.",
          );
        return publicRecord(record);
      }
      record.publication = {
        policy: "soryn-record-consent/1",
        alias: alias.trim(),
        at: now,
        status: "published",
      };
      this.store.db
        .prepare("UPDATE token_record SET record=? WHERE id=?")
        .run(JSON.stringify(tokenRecordSchema.parse(record)), id);
      return publicRecord(record);
    });
  }
  withdraw(id: string, wallet: string) {
    const row = this.store.db
      .prepare(
        "SELECT record FROM token_record WHERE id=? AND json_extract(record, '$.owner')=?",
      )
      .get(id, wallet);
    if (
      row &&
      readStored(tokenRecordSchema, row.record).publication?.status ===
        "withdrawn"
    )
      return;
    const result = this.store.db
      .prepare(
        "UPDATE token_record SET record=json_set(record, '$.publication.status', 'withdrawn') WHERE id=? AND json_extract(record, '$.owner')=? AND json_extract(record, '$.publication.status')='published'",
      )
      .run(id, wallet);
    if (!result.changes)
      throw new ServiceError(
        404,
        "No publication belongs to this signed-in keeper.",
      );
  }
  forKeeper(wallet: string): TokenRecord[] {
    return this.store.db
      .prepare(
        "SELECT record FROM token_record WHERE json_extract(record, '$.owner')=? ORDER BY recorded_at DESC, rowid DESC LIMIT 100",
      )
      .all(wallet)
      .map((row) => readStored(tokenRecordSchema, row.record));
  }
  private rows(token: string, publicOnly = false): TokenRecord[] {
    const rows = this.store.db
      .prepare(
        `SELECT record FROM token_record WHERE token=? ${publicOnly ? "AND json_extract(record, '$.publication.status')='published' AND json_extract(record, '$.eligibleForPublication')=1" : ""}
         ORDER BY recorded_at DESC, rowid DESC LIMIT ${LIST_LIMIT}`,
      )
      .all(token) as { record: string }[];
    return rows.map((row) => readStored(tokenRecordSchema, row.record));
  }
  summary(identity: TokenIdentity, publicOnly = false): TokenRecordSummary {
    const rows = this.store.db
      .prepare(
        `SELECT kind, json_extract(record, '$.headline') AS headline, COUNT(*) AS count FROM token_record WHERE token=? ${publicOnly ? "AND json_extract(record, '$.publication.status')='published' AND json_extract(record, '$.eligibleForPublication')=1" : ""} GROUP BY kind, json_extract(record, '$.headline')`,
      )
      .all(tokenKey(identity));
    const summary: TokenRecordSummary = {
      series: 0,
      battles: 0,
      story: 0,
      noContest: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    for (const record of rows) {
      const count = Number(record.count);
      if (record.kind === "series") summary.series += count;
      if (record.kind === "battle") summary.battles += count;
      if (record.kind === "story") summary.story += count;
      if (record.kind === "no-contest") summary.noContest += count;
      // The record counts completed series only; battle rows carry detail.
      if (record.kind === "series") {
        if (record.headline === "Victory") summary.wins += count;
        if (record.headline === "Defeat") summary.losses += count;
        if (record.headline === "Draw") summary.draws += count;
      }
    }
    return summary;
  }
}
