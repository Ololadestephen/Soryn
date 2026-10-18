import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;

function run(args: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      join(process.cwd(), "tests/integration/register-ts.mjs"),
      join(process.cwd(), "tests/integration/pvp-process-cli.ts"),
      ...args,
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 10000 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || "Process failed.");
  return JSON.parse(result.stdout) as {
    invite: string;
    deadline: number;
    seated?: boolean;
    you?: { move: string | null };
    opponent?: { locked?: boolean; move?: string };
    battle?: { rounds: { player: string; opponent: string }[] };
    rounds?: number;
    deadlineAt?: number;
    phase?: string;
    wins?: { a: number; b: number };
  };
}

describe("private match process restart", { timeout: 20000 }, () => {
  it("keeps a hidden lock and resolves it once after the process exits", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-pvp-process-")),
      "pvp.sqlite",
    );
    const seeded = run(["seed", path]);
    const friend = run(["peek", path, seeded.invite, B, String(NOW + 25)]);
    expect(friend.opponent?.locked).toBe(true);
    expect(friend.you?.move).toBeNull();
    expect(friend.opponent && "move" in friend.opponent).toBe(false);
    expect(JSON.stringify(friend.battle?.rounds ?? [])).not.toContain(
      "special",
    );
    const host = run(["peek", path, seeded.invite, A, String(NOW + 25)]);
    expect(host.you?.move).toBe("special");
    const resolved = run([
      "peek",
      path,
      seeded.invite,
      B,
      String(NOW + PVP_TIMERS.moveMs),
    ]);
    expect(resolved.battle?.rounds).toHaveLength(1);
    expect(resolved.battle?.rounds[0]).toMatchObject({
      player: "guard",
      opponent: "special",
    });
    expect(resolved.deadlineAt).toBe(seeded.deadline + PVP_TIMERS.presentMs);
  });

  it("reads one committed round from a new process", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-pvp-commit-")),
      "pvp.sqlite",
    );
    const seeded = run(["seed", path]);
    const finished = run(["finish", path, seeded.invite, B, String(NOW + 40)]);
    expect(finished.rounds).toBe(1);
    const again = run(["peek", path, seeded.invite, A, String(NOW + 40)]);
    expect(again.battle?.rounds).toHaveLength(1);
    expect(again.battle?.rounds[0]).toMatchObject({
      player: "special",
      opponent: "guard",
    });
  });

  it("keeps a series intermission when the process exits", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-series-process-")),
      "series.sqlite",
    );
    const seeded = run(["series-seed", path]);
    expect(seeded.phase).toBe("intermission");
    expect(seeded.wins).toEqual({ a: 1, b: 0 });
    const restored = run(["series-peek", path, seeded.invite]);
    expect(restored.phase).toBe("intermission");
    expect(restored.wins).toEqual({ a: 1, b: 0 });
    expect(restored.deadline).toBe(seeded.deadline);
  });
});
