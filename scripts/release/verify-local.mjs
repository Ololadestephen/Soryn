import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Production transport + migration fixture, never a real gameplay or mainnet claim.
const dir = mkdtempSync(join(tmpdir(), "soryn-release-check-"));
const path = join(dir, "fixture.sqlite"),
  backup = join(dir, "before.sqlite");
const base = "http://127.0.0.1:3500";
let child;
const checks = [];
async function stop() {
  if (!child || child.exitCode !== null) return;
  const process = child;
  child = null;
  const exit = once(process, "exit");
  process.kill("SIGTERM");
  const timer = setTimeout(() => process.kill("SIGKILL"), 5000);
  await exit;
  clearTimeout(timer);
}
async function start(database, build) {
  try {
    await fetch(`${base}/health`);
    throw new Error("Check port 3500 is already occupied.");
  } catch (error) {
    if (error.message.includes("already occupied")) throw error;
  }
  const env = {
    ...process.env,
    APP_ORIGIN: base,
    CHOG_DB_PATH: database,
    SORYN_BUILD_ID: build,
  };
  delete env.CHOG_PVP_TIMERS;
  delete env.CHOG_PVP_MOVE_MS;
  delete env.CHOG_PVP_PRESENT_MS;
  delete env.CHOG_PVP_LOADING_MS;
  child = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3500",
    ],
    { env, stdio: "ignore" },
  );
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null)
      throw new Error("Production server exited before readiness.");
    try {
      const response = await fetch(`${base}/health`);
      const data = await response.json();
      if (
        response.ok &&
        JSON.stringify(data) === JSON.stringify({ ready: true, build })
      ) {
        checks.push({ build, health: data });
        return;
      }
    } catch {
      /* Retry during bounded startup only. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Production readiness timed out.");
}
function inspect(database) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const version = db.prepare("PRAGMA user_version").get().user_version;
    const fixture = db
      .prepare("SELECT record FROM private_release_fixture")
      .get().record;
    const lock = db
      .prepare("SELECT encounter FROM token_locks")
      .get()?.encounter;
    const integrity = db
      .prepare("PRAGMA integrity_check")
      .get().integrity_check;
    if (
      fixture !== "preserved-private-checkpoint" ||
      lock !== "active-fixture" ||
      integrity !== "ok"
    )
      throw new Error("Persistence verification failed.");
    return {
      version,
      fixturePreserved: true,
      activeLockPreserved: true,
      integrity,
    };
  } finally {
    db.close();
  }
}
try {
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA user_version=2; CREATE TABLE private_release_fixture (record TEXT); INSERT INTO private_release_fixture VALUES ('preserved-private-checkpoint'); CREATE TABLE token_locks (token TEXT PRIMARY KEY, encounter TEXT NOT NULL, kind TEXT NOT NULL, owner TEXT NOT NULL, generation TEXT NOT NULL, opened_at INTEGER NOT NULL, expires_at INTEGER NOT NULL); INSERT INTO token_locks VALUES ('143:fixture:276','active-fixture','story','fixture-owner','fixture-generation',1,9999999999999);",
  );
  db.close();
  execFileSync(
    process.execPath,
    [resolve("scripts/release/backup.mjs"), path, backup],
    { stdio: "pipe" },
  );
  await start(path, "m7c-local-first");
  checks.push(inspect(path));
  await stop();
  await start(path, "m7c-local-restart");
  checks.push(inspect(path));
  await stop();
  checks.push({ preMigrationBackup: inspect(backup) });
  await start(backup, "m7c-local-restored");
  checks.push(inspect(backup));
  await stop();
  mkdirSync("docs/evidence/soryn-readiness", { recursive: true });
  writeFileSync(
    "docs/evidence/soryn-readiness/local-release.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        source:
          "Temporary additive-migration/storage fixture; production Next server, timers unset; not a holder playtest.",
        checks,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Production migration, restart and backup restoration passed.\n",
  );
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
