import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ServiceError } from "./errors";
import { migrateReleaseSchema } from "./migrations";

const RATE_WINDOW_MS = 60 * 1000;

export class Store {
  readonly db: DatabaseSync;
  private transactionDepth = 0;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000");
    try {
      migrateReleaseSchema(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.db.exec("PRAGMA journal_mode=WAL");
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
        undefined,
        {
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(((bucket + 1) * RATE_WINDOW_MS - now) / 1000),
          ),
        },
      );
  }
}
