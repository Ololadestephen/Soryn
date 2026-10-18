import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { TokenLocks } from "../../src/server/pvp/locks";

function acquire(path: string, encounter: string, now: number) {
  return new Promise<string>((done, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        resolve("tests/integration/register-ts.mjs"),
        resolve("tests/integration/token-lock-process-cli.ts"),
        path,
        encounter,
        String(now),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "",
      errors = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (errors += data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? done(output) : reject(new Error(errors)),
    );
  });
}
describe("atomic token reservations across processes", () => {
  it("allows one simultaneous Story/private reservation, preserves it on restart and rejects stale cleanup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "soryn-lock-race-")),
      path = join(dir, "race.sqlite");
    try {
      const setup = new Store(path);
      setup.close();
      const now = Date.now();
      const results = await Promise.all([
        acquire(path, "story", now),
        acquire(path, "private-series", now),
      ]);
      expect(results.sort()).toEqual(["acquired", "conflict"]);
      const reopened = new Store(path);
      try {
        const locks = new TokenLocks(reopened),
          held = locks.get("143:fixture:276", now)!;
        expect(["story", "private-series"]).toContain(held.encounter);
        expect(locks.release(held.token, "old-encounter")).toBe(false);
        expect(locks.get(held.token, now)).toEqual(held);
        expect(locks.release(held.token, held.encounter)).toBe(true);
        expect(locks.get(held.token, now)).toBeNull();
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
