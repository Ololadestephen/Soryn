import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { migrateReleaseSchema } from "../../src/server/migrations";
import { TokenLocks } from "../../src/server/pvp/locks";
import { readiness } from "../../src/server/readiness";

const lock = {
  token: "143:collection:276",
  encounter: "fixture-story",
  kind: "story" as const,
  owner: "fixture-owner",
  generation: "fixture-generation",
  openedAt: 100,
  expiresAt: 10000,
};
describe("release storage safeguards", () => {
  it("migrates legacy rows additively, preserves locks on reopen, and restores a verified online backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "soryn-release-"));
    const path = join(dir, "legacy.sqlite"),
      saved = join(dir, "backup.sqlite");
    try {
      const legacy = new DatabaseSync(path);
      legacy.exec(
        "PRAGMA user_version=2; CREATE TABLE private_fixture (id TEXT PRIMARY KEY, record TEXT); INSERT INTO private_fixture VALUES ('saved', 'private-progress'); CREATE TABLE pvp_queue (actor TEXT PRIMARY KEY, joined_at INTEGER NOT NULL, status TEXT NOT NULL, offer_id TEXT, accepted INTEGER NOT NULL DEFAULT 0, deadline_at INTEGER, declines INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, room_invite TEXT); INSERT INTO pvp_queue (actor,joined_at,status) VALUES ('legacy-actor',100,'waiting');",
      );
      legacy.close();
      const first = new Store(path);
      new TokenLocks(first).acquire(lock);
      execFileSync(
        process.execPath,
        [resolve("scripts/release/backup.mjs"), path, saved],
        { stdio: "pipe" },
      );
      expect(statSync(saved).mode & 0o777).toBe(0o600);
      first.close();
      const restored = new Store(saved);
      expect(
        restored.db.prepare("PRAGMA user_version").get()?.user_version,
      ).toBe(3);
      expect(
        restored.db.prepare("SELECT record FROM private_fixture").get()?.record,
      ).toBe("private-progress");
      expect(
        restored.db.prepare("SELECT token_key FROM pvp_queue").get()?.token_key,
      ).toBeNull();
      expect(new TokenLocks(restored).get(lock.token, 101)).toEqual(lock);
      expect(
        new TokenLocks(restored).release(lock.token, "wrong-encounter"),
      ).toBe(false);
      restored.close();
      const reopened = new Store(path);
      expect(
        reopened.db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()
          ?.n,
      ).toBe(1);
      expect(new TokenLocks(reopened).get(lock.token, 101)).toEqual(lock);
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("rolls back a failed additive migration and refuses a newer schema", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        "PRAGMA user_version=2; CREATE TABLE schema_migrations (wrong TEXT);",
      );
      expect(() => migrateReleaseSchema(db)).toThrow();
      expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(2);
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE name='token_locks'")
          .get(),
      ).toBeUndefined();
      db.exec("PRAGMA user_version=99");
      expect(() => migrateReleaseSchema(db)).toThrow(/newer/);
    } finally {
      db.close();
    }
  });
  it("health returns only readiness and a bounded public build ID", async () => {
    const store = new Store(":memory:");
    try {
      const ok = readiness(() => store, "m7c-local");
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ready: true, build: "m7c-local" });
      store.close();
      const failed = readiness(() => store, "secret/path?token=private");
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({
        ready: false,
        build: "unidentified",
      });
    } finally {
      /* closed above to exercise the failed boundary */
    }
  });
});
