import type { DatabaseSync } from "node:sqlite";

export const RELEASE_SCHEMA_VERSION = 3;

/** Additive and transactional. Rollback to an older binary uses a pre-migration backup. */
export function migrateReleaseSchema(db: DatabaseSync) {
  const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
  if (version > RELEASE_SCHEMA_VERSION)
    throw new Error("Database schema is newer than this application.");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS token_locks (
        token TEXT PRIMARY KEY, encounter TEXT NOT NULL, kind TEXT NOT NULL,
        owner TEXT NOT NULL, generation TEXT NOT NULL, opened_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS token_record (
        id TEXT PRIMARY KEY, token TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL,
        recorded_at INTEGER NOT NULL, record TEXT NOT NULL, UNIQUE(token, kind, source)
      );
      CREATE INDEX IF NOT EXISTS token_record_token ON token_record(token, recorded_at DESC);
      CREATE TABLE IF NOT EXISTS story_progress (actor TEXT PRIMARY KEY, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pvp_queue (
        actor TEXT PRIMARY KEY, joined_at INTEGER NOT NULL, status TEXT NOT NULL,
        offer_id TEXT, accepted INTEGER NOT NULL DEFAULT 0, deadline_at INTEGER,
        declines INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, room_invite TEXT
      );
    `);
    const columns = new Set(
      db
        .prepare("PRAGMA table_info(pvp_queue)")
        .all()
        .map((row) => String(row.name)),
    );
    for (const column of [
      "token_key",
      "token_owner",
      "token_generation",
      "token_encounter",
    ])
      if (!columns.has(column))
        db.exec(`ALTER TABLE pvp_queue ADD COLUMN ${column} TEXT`);
    db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (?, ?)").run(
      RELEASE_SCHEMA_VERSION,
      "official-participation-and-records",
    );
    db.exec(`PRAGMA user_version=${RELEASE_SCHEMA_VERSION}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
