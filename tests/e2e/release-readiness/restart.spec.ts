import { spawn, type ChildProcess } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { expect, test } from "@playwright/test";
import {
  choose,
  continueBattle,
  evidence,
  pair,
  publicBattle,
  publicPair,
  room,
  savePair,
} from "./support";

test("one server recovers a locked public battle and its intermission across real process restarts", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const directory = mkdtempSync(join(tmpdir(), "soryn-restart-"));
  const baseURL = "http://127.0.0.1:3400";
  const database = join(directory, "persistent.sqlite");
  let child: ChildProcess | null = null;
  const processes: { pid: number; startedAt: string }[] = [];
  mkdirSync(evidence, { recursive: true });
  async function start() {
    if (child)
      throw new Error("A server is already running against this database");
    try {
      const stale = await fetch(baseURL);
      if (stale.ok)
        throw new Error(
          `Port 3400 is already served by another process (${stale.status}); stop it first.`,
        );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Port 3400"))
        throw error;
    }
    child = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3400",
      ],
      {
        env: {
          ...process.env,
          APP_ORIGIN: baseURL,
          CHOG_DB_PATH: database,
          CHOG_PVP_TIMERS: "test",
          CHOG_PVP_MOVE_MS: "30000",
          CHOG_PVP_PRESENT_MS: "500",
          CHOG_PVP_LOADING_MS: "4000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.on("error", (error) =>
      appendFileSync(`${evidence}/restart-server.log`, String(error)),
    );
    child.stdout?.on("data", (data) =>
      appendFileSync(`${evidence}/restart-server.log`, data),
    );
    child.stderr?.on("data", (data) =>
      appendFileSync(`${evidence}/restart-server.log`, data),
    );
    processes.push({ pid: child.pid!, startedAt: new Date().toISOString() });
    const starting = child;
    try {
      await expect
        .poll(
          async () => {
            if (starting.exitCode !== null) return false;
            try {
              return (await fetch(baseURL)).ok;
            } catch {
              return false;
            }
          },
          { timeout: 30000 },
        )
        .toBe(true);
    } catch (error) {
      child = null;
      if (starting.exitCode === null) starting.kill("SIGKILL");
      throw error;
    }
  }
  async function stop() {
    if (!child) return;
    const owned = child;
    child = null;
    if (owned.exitCode !== null) return;
    const exited = once(owned, "exit");
    owned.kill("SIGTERM");
    const escalation = setTimeout(() => owned.kill("SIGKILL"), 10_000);
    await exited;
    clearTimeout(escalation);
  }
  let players: Awaited<ReturnType<typeof pair>> | null = null;
  try {
    await start();
    players = await pair(browser, baseURL, "server-restart");
    const { a, b } = players;
    const invite = await publicPair(a, b);
    const locked = await choose(a, "special");
    const lockDeadline = locked.deadlineAt;
    await stop();
    await start();
    await a.reload();
    await b.reload();
    await expect(a.locator(".turn-readiness")).toContainText("Move locked");
    const recovered = await room(a, invite);
    expect(recovered.battle!.id).toBe(locked.battle!.id);
    expect(recovered.you.move).toBe("special");
    expect(recovered.deadlineAt).toBe(lockDeadline);
    expect(recovered.series).toEqual(locked.series);
    await a.screenshot({ path: `${evidence}/restart-locked.png` });
    await choose(b, "guard");
    const between = await publicBattle(a, b, invite, "a");
    expect(between.series).toMatchObject({
      phase: "intermission",
      you: 1,
      opponent: 0,
    });
    await stop();
    await start();
    await a.reload();
    await b.reload();
    const resumed = await room(a, invite);
    expect(resumed.battle!.id).toBe(between.battle!.id);
    expect(resumed.series).toEqual(between.series);
    expect((await room(b, invite)).series).toMatchObject({
      you: 0,
      opponent: 1,
      deadlineAt: between.series!.deadlineAt,
    });
    await expect(
      a.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await a.screenshot({ path: `${evidence}/restart-intermission.png` });
    await continueBattle(a, b);
    const next = await room(a, invite);
    expect(next.battle!.id).not.toBe(between.battle!.id);
    expect(next.series).toMatchObject({ battle: 2, you: 1, opponent: 0 });
    writeFileSync(
      `${evidence}/restart.json`,
      JSON.stringify(
        {
          source:
            "Real SIGTERM, awaited exit and new Node process; same isolated SQLite path; real public queue and moves; no database mutation",
          processes,
          locked: recovered,
          intermission: resumed,
          nextBattle: next.battle!.id,
        },
        null,
        2,
      ),
    );
  } finally {
    if (players) await savePair(players);
    await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
