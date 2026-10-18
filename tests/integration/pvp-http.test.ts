import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { officialCombatFixture } from "../fixtures/official-combat";
import {
  qualifyingHoldings,
  walletAccessFixture,
} from "../fixtures/wallet-access";
import { WalletAccessAuth } from "../../src/server/access/auth";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { createPvpHandlers } from "../../src/server/pvp/http";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const origin = "https://chog.example";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

interface BattleBody {
  seated?: boolean;
  invite?: string;
  you?: { move: string | null; name?: string };
  opponent?: { locked?: boolean; name?: string };
  battle?: {
    snapshot: { player: { id: string }; opponent: { id: string } };
    state: {
      player: { health: number };
      opponent: { health: number };
    };
    rounds: { player: string; opponent: string }[];
  };
  latestSeq?: number;
  history?: { opponent: string; explanation: string }[];
  error?: string;
  code?: string;
  phase?: string;
  revision?: number;
}

beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
const contexts = new WeakMap<
  ReturnType<typeof createPvpHandlers>,
  Awaited<ReturnType<typeof officialCombatFixture>>
>();
const sessions = new Map<
  string,
  { headers: Record<string, string>; actor: string }
>();
async function handlers(store = new Store(":memory:")) {
  const ctx = await officialCombatFixture(store);
  const pvp = createPvpHandlers(
    store,
    origin,
    ctx.auth,
    ctx.verifier,
    qualifyingHoldings,
  );
  contexts.set(pvp, ctx);
  return { store, pvp };
}

async function read(response: Response) {
  const raw = await response.text();
  return {
    status: response.status,
    raw,
    body: JSON.parse(raw) as BattleBody,
  };
}

function cookieFrom(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("Missing guest cookie.");
  return header.split(";")[0] ?? "";
}

async function mint(pvp: ReturnType<typeof createPvpHandlers>) {
  const ctx = contexts.get(pvp);
  if (!ctx) throw Error("Missing fixture context");
  const f = await walletAccessFixture(qualifyingHoldings, ctx);
  const login = new WalletAccessAuth(ctx.store, ctx.auth, ctx.verifier, origin);
  const player = await login.player(
    new NextRequest(`${origin}/api/access`, {
      headers: { cookie: f.cookie, ...f.headers },
    }),
  );
  sessions.set(f.cookie, { headers: f.headers, actor: player.actor });
  return f.cookie;
}

function post(
  pvp: ReturnType<typeof createPvpHandlers>,
  cookie: string,
  input: Record<string, unknown>,
) {
  return pvp.post(
    new NextRequest(`${origin}/api/pvp`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        cookie,
        ...sessions.get(cookie)?.headers,
      },
      body: JSON.stringify({ mode: "guest", ...input }),
    }),
  );
}

function get(
  pvp: ReturnType<typeof createPvpHandlers>,
  cookie: string,
  invite?: string,
) {
  const path = invite
    ? `${origin}/api/pvp?mode=guest&invite=${encodeURIComponent(invite)}`
    : `${origin}/api/pvp`;
  return pvp.get(
    new NextRequest(path, {
      headers: { cookie, ...sessions.get(cookie)?.headers },
    }),
  );
}

function actorOf(cookie: string) {
  return sessions.get(cookie)?.actor ?? cookie.split("=")[1] ?? "";
}

function health(body: BattleBody, id: string) {
  const battle = body.battle;
  if (!battle) throw new Error("Missing battle.");
  return battle.snapshot.player.id === id
    ? battle.state.player.health
    : battle.state.opponent.health;
}

async function seatedRoom(pvp: ReturnType<typeof createPvpHandlers>) {
  const host = await mint(pvp);
  const friend = await mint(pvp);
  const created = await read(await post(pvp, host, { operation: "create" }));
  const invite = created.body.invite ?? "";
  await post(pvp, friend, { operation: "join", invite });
  await post(pvp, host, { operation: "select", invite, characterId: "pip" });
  await post(pvp, friend, {
    operation: "select",
    invite,
    characterId: "bolt",
  });
  await post(pvp, host, { operation: "ready", invite, ready: true });
  await post(pvp, friend, { operation: "ready", invite, ready: true });
  await post(pvp, host, { operation: "assets", invite });
  await post(pvp, friend, { operation: "assets", invite });
  return { host, friend, invite };
}

describe("private battle HTTP", () => {
  it("keeps cookieless records isolated and refuses new anonymous room creation", async () => {
    const { pvp } = await handlers();
    const first = cookieFrom(
      await pvp.get(new NextRequest(`${origin}/api/pvp`)),
    );
    const second = cookieFrom(
      await pvp.get(new NextRequest(`${origin}/api/pvp`)),
    );
    expect(first).not.toBe(second);
    const created = await read(await post(pvp, first, { operation: "create" }));
    expect(created.status).toBe(403);
    expect(created.body.seated).toBeUndefined();
    expect((await read(await get(pvp, second))).body.history ?? []).toEqual([]);
  });

  it("rejects an action stamped for an earlier battle without changing the room", async () => {
    const { pvp } = await handlers();
    const { host, invite } = await seatedRoom(pvp);
    const before = await read(await get(pvp, host, invite));
    const stale = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    for (const operation of ["assets", "continue"] as const) {
      const reply = await read(
        await post(pvp, host, { operation, invite, matchId: stale }),
      );
      expect(reply.status).toBe(409);
      expect(reply.body.code).toBe("stale-battle");
    }
    const after = await read(await get(pvp, host, invite));
    expect(after.body.revision).toBe(before.body.revision);
    expect(after.body.phase).toBe(before.body.phase);
  });

  it("hides a locked move, mirrors health, and rejects bad seats", async () => {
    const { store, pvp } = await handlers();
    const { host, friend, invite } = await seatedRoom(pvp);
    const outsider = await mint(pvp);
    const locked = await read(
      await post(pvp, host, {
        operation: "move",
        invite,
        round: 1,
        move: "special",
      }),
    );
    expect(locked.status).toBe(200);
    expect(locked.raw).toMatch(/"move"\s*:\s*"special"/);
    const stored = store.db
      .prepare("SELECT record FROM pvp_rooms WHERE invite=?")
      .get(invite) as { record: string };
    expect(stored.record).toMatch(/"move":"special"/);
    const hidden = await read(await get(pvp, friend, invite));
    expect(hidden.body.opponent?.locked).toBe(true);
    expect(hidden.body.you?.move).toBeNull();
    expect(hidden.body.battle?.rounds).toEqual([]);
    expect(hidden.raw).not.toMatch(/"move"\s*:\s*"special"/);
    expect(hidden.raw).not.toContain(actorOf(host));
    const same = await read(
      await post(pvp, host, {
        operation: "move",
        invite,
        round: 1,
        move: "special",
      }),
    );
    expect(same.status).toBe(200);
    expect(same.body.battle?.rounds).toEqual([]);
    const changed = await read(
      await post(pvp, host, {
        operation: "move",
        invite,
        round: 1,
        move: "basic",
      }),
    );
    expect(changed.status).toBe(409);
    const stale = await read(
      await post(pvp, friend, {
        operation: "move",
        invite,
        round: 2,
        move: "guard",
      }),
    );
    expect(stale.status).toBe(409);
    const resolved = await read(
      await post(pvp, friend, {
        operation: "move",
        invite,
        round: 1,
        move: "guard",
      }),
    );
    const hostView = await read(await get(pvp, host, invite));
    expect(resolved.body.battle?.rounds).toHaveLength(1);
    expect(hostView.body.battle?.rounds).toHaveLength(1);
    expect(hostView.body.latestSeq).toBe(resolved.body.latestSeq);
    expect(health(hostView.body, "pip")).toBe(health(resolved.body, "pip"));
    expect(health(hostView.body, "bolt")).toBe(health(resolved.body, "bolt"));
    expect(hostView.body.battle?.rounds[0]?.player).toBe("special");
    expect(resolved.body.battle?.rounds[0]?.opponent).toBe("special");
    const blocked = await read(
      await post(pvp, outsider, {
        operation: "move",
        invite,
        round: 1,
        move: "basic",
      }),
    );
    expect(blocked.status).toBe(403);
    const full = await read(
      await post(pvp, outsider, { operation: "join", invite }),
    );
    expect(full.status).toBe(409);
    const closed = await read(await get(pvp, outsider, invite));
    expect(closed.status).toBe(403);
    store.close();
  });

  it("rejects fighters outside the six-player grant, missing wallet sessions and unknown moves", async () => {
    const { store, pvp } = await handlers();
    const host = await mint(pvp);
    const created = await read(await post(pvp, host, { operation: "create" }));
    const invite = created.body.invite ?? "";
    const friend = await mint(pvp);
    await post(pvp, friend, { operation: "join", invite });
    const third = await mint(pvp);
    const full = await read(
      await post(pvp, third, { operation: "join", invite }),
    );
    expect(full.status).toBe(409);
    expect(full.body.error).toMatch(/full/);
    const holder = await read(
      await post(pvp, host, {
        operation: "select",
        invite,
        characterId: "ember",
      }),
    );
    expect(holder.status).toBe(403);
    const official = await read(
      await post(pvp, host, { operation: "create", mode: "official" }),
    );
    expect(official.status).toBe(401);
    const unknown = await read(
      await post(pvp, host, {
        operation: "move",
        invite,
        round: 1,
        move: "spin",
      }),
    );
    expect(unknown.status).toBe(400);
    const bare = await read(await post(pvp, "", { operation: "join", invite }));
    expect(bare.status).toBe(401);
    store.close();
  });

  it("drops seat control when a player leaves and keeps history private", async () => {
    const { store, pvp } = await handlers();
    const host = await mint(pvp);
    const friend = await mint(pvp);
    const created = await read(await post(pvp, host, { operation: "create" }));
    const invite = created.body.invite ?? "";
    await post(pvp, friend, { operation: "join", invite });
    await post(pvp, host, { operation: "select", invite, characterId: "pip" });
    await post(pvp, friend, {
      operation: "select",
      invite,
      characterId: "bolt",
    });
    await post(pvp, host, { operation: "ready", invite, ready: true });
    await post(pvp, friend, { operation: "ready", invite, ready: true });
    new PvpService(new PvpStore(store), PVP_TIMERS).preview(
      invite,
      actorOf(host),
      Date.now() + 120_000,
    );
    const mine = await read(await get(pvp, host));
    const stranger = await mint(pvp);
    const theirs = await read(await get(pvp, stranger));
    expect(mine.body.history?.length).toBeGreaterThan(0);
    expect(theirs.body.history ?? []).toEqual([]);
    expect(theirs.raw).not.toContain(actorOf(host));
    expect(mine.raw).not.toContain(actorOf(friend));
    const fresh = await mint(pvp);
    const lobby = await read(await post(pvp, fresh, { operation: "create" }));
    const open = lobby.body.invite ?? "";
    const guest = await mint(pvp);
    await post(pvp, guest, { operation: "join", invite: open });
    const left = await read(
      await post(pvp, fresh, { operation: "leave", invite: open }),
    );
    expect(left.status).toBe(200);
    expect(left.body.seated).toBe(false);
    const denied = await read(
      await post(pvp, fresh, {
        operation: "select",
        invite: open,
        characterId: "pip",
      }),
    );
    expect(denied.status).toBe(403);
    const replacement = await mint(pvp);
    const joined = await read(
      await post(pvp, replacement, { operation: "join", invite: open }),
    );
    expect(joined.status).toBe(200);
    expect(joined.body.seated).toBe(true);
    store.close();
  });

  it("resolves simultaneous seat submissions as one round", async () => {
    const folder = mkdtempSync(join(tmpdir(), "chog-pvp-race-"));
    const path = join(folder, "race.sqlite");
    const now = 1_700_000_000_000;
    const service = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const created = service.create({ actor: A, mode: "guest" }, now);
    service.join({ actor: B, mode: "guest" }, created.invite, now);
    service.select(A, created.invite, "pip", now);
    service.select(B, created.invite, "bolt", now);
    service.ready(A, created.invite, true, now);
    service.ready(B, created.invite, true, now);
    service.assets(A, created.invite, now);
    service.assets(B, created.invite, now);
    service.records.store.close();
    const raced = await Promise.all([
      race(path, A, created.invite, "special", now + 20),
      race(path, B, created.invite, "guard", now + 20),
    ]);
    expect(raced.every((entry) => entry.ok)).toBe(true);
    expect(raced.reduce((total, entry) => total + entry.rounds, 0)).toBe(1);
    const check = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const view = check.preview(created.invite, A, now + 20);
    expect(view.seated).toBe(true);
    if (!view.seated) return;
    expect(view.battle?.rounds).toHaveLength(1);
    expect(view.battle?.rounds[0]).toMatchObject({
      player: "special",
      opponent: "guard",
    });
    expect(() => check.move(A, created.invite, 1, "basic", now + 21)).toThrow(
      /another move/,
    );
    const repeated = check.move(A, created.invite, 1, "special", now + 21);
    expect(repeated.battle?.rounds).toHaveLength(1);
    check.records.store.close();
  });

  it("rejects setup from a cookie that does not hold a seat", async () => {
    const { pvp } = await handlers();
    const host = await mint(pvp);
    const friend = await mint(pvp);
    const created = await read(await post(pvp, host, { operation: "create" }));
    const invite = created.body.invite ?? "";
    await post(pvp, friend, { operation: "join", invite });
    await post(pvp, host, {
      operation: "select",
      invite,
      characterId: "pip",
    });
    await post(pvp, host, { operation: "ready", invite, ready: true });
    const stranger = await mint(pvp);
    const blocked = await read(
      await post(pvp, stranger, { operation: "setup", invite }),
    );
    expect(blocked.status).toBe(403);
    const still = await read(await get(pvp, host, invite));
    expect(still.body.you?.name).toBeTruthy();
    expect(still.raw).toContain("pip");
  });

  it("marks the guest cookie Secure when the public origin is HTTPS", async () => {
    const { pvp } = await handlers();
    const response = await pvp.get(
      new NextRequest("http://127.0.0.1:3010/api/pvp"),
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });
});

function race(
  path: string,
  actor: string,
  invite: string,
  move: "basic" | "special" | "guard",
  now: number,
) {
  return new Promise<{
    ok: boolean;
    rounds: number;
    seq: number;
    move: string | null;
    message?: string;
  }>((resolve, reject) => {
    const worker = new Worker(
      join(process.cwd(), "tests/integration/pvp-seat-worker.ts"),
      {
        execArgv: [
          "--import",
          join(process.cwd(), "tests/integration/register-ts.mjs"),
        ],
        workerData: { path, actor, invite, move, now },
      },
    );
    worker.once("message", resolve);
    worker.once("error", reject);
  });
}
