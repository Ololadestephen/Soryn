import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { QueueService } from "../../src/server/pvp/queue";
import { createMatchHandlers } from "../../src/server/match/http";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { identityFor, tokenKey } from "../../src/domain/identity";
import { pvpRoomSchema, roomOrigin } from "../../src/domain/pvp/types";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const NOW = 1700000000000;
function context(path = ":memory:") {
  const store = new Store(path);
  const service = new PvpService(new PvpStore(store), PVP_TIMERS);
  const queue = new QueueService(store, service);
  return { store, service, queue };
}
function pair(ctx: ReturnType<typeof context>, now = NOW) {
  ctx.queue.join({ actor: A, mode: "guest" }, now);
  ctx.queue.join({ actor: B, mode: "guest" }, now + 1);
  ctx.queue.accept(A, now + 2);
  return ctx.queue.accept(B, now + 3).invite!;
}
function start(
  ctx: ReturnType<typeof context>,
  invite: string,
  now = NOW + 10,
) {
  ctx.service.select(A, invite, "pip", now);
  ctx.service.select(B, invite, "bolt", now);
  ctx.service.ready(A, invite, true, now);
  ctx.service.ready(B, invite, true, now);
  ctx.service.assets(A, invite, now);
  ctx.service.assets(B, invite, now);
}
afterEach(() => vi.restoreAllMocks());

it("withdraws a public pregame pair once, freeing both people without letting an invite claim a seat", () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    expect(() =>
      ctx.service.join({ actor: C, mode: "guest" }, invite, NOW + 4),
    ).toThrow(/paired players/);
    ctx.service.select(B, invite, "bolt", NOW + 5);
    ctx.service.ready(B, invite, true, NOW + 6);
    ctx.service.leave(A, invite, NOW + 7);
    expect(ctx.service.records.byInvite(invite).closedAt).toBe(NOW + 7);
    const other = ctx.service.preview(invite, B, NOW + 8);
    expect(other.seated && other.notice).toMatch(/left before/);
    expect(ctx.service.session(A, NOW + 8).activeInvite).toBeNull();
    expect(ctx.service.session(B, NOW + 8).activeInvite).toBeNull();
    expect(
      ctx.store.db.prepare("SELECT COUNT(*) n FROM pvp_queue").get()?.n,
    ).toBe(0);
    pair(ctx, NOW + 10);
    expect(() => ctx.service.leave(A, invite, NOW + 20)).not.toThrow();
    ctx.service.close(B, invite, NOW + 21);
    expect(
      ctx.store.db
        .prepare("SELECT COUNT(*) n FROM pvp_queue WHERE status='matched'")
        .get()?.n,
    ).toBe(2);
  } finally {
    ctx.store.close();
  }
});
it("private withdrawal clears readiness, keeps sharing usable and never authorizes an occupied seat", () => {
  const ctx = context();
  try {
    const invite = ctx.service.create({ actor: A, mode: "guest" }, NOW).invite;
    ctx.service.join({ actor: B, mode: "guest" }, invite, NOW + 1);
    ctx.service.select(A, invite, "pip", NOW + 2);
    ctx.service.ready(A, invite, true, NOW + 3);
    ctx.service.leave(B, invite, NOW + 4);
    ctx.service.leave(B, invite, NOW + 5);
    const room = ctx.service.records.byInvite(invite);
    expect(room.closedAt).toBeNull();
    expect(room.seats.a?.ready).toBe(false);
    ctx.service.join({ actor: C, mode: "guest" }, invite, NOW + 6);
    expect(() => ctx.service.select(B, invite, "bolt", NOW + 7)).toThrow(
      /not seated/,
    );
    expect(ctx.service.records.byInvite(invite).seats.b?.actor).toBe(C);
  } finally {
    ctx.store.close();
  }
});
it("surrender is terminal and idempotent; a new private invitation preserves the archived result", async () => {
  const ctx = context();
  try {
    const invite = ctx.service.create({ actor: A, mode: "guest" }, NOW).invite;
    ctx.service.join({ actor: B, mode: "guest" }, invite, NOW + 1);
    start(ctx, invite);
    await Promise.all(
      [A, B, A].map((actor) =>
        Promise.resolve().then(() =>
          ctx.service.surrender(actor, invite, NOW + 20),
        ),
      ),
    );
    const old = ctx.service.records.byInvite(invite);
    expect(old.series?.outcome).toMatchObject({ kind: "forfeit", winner: "b" });
    expect(old.series?.recorded).toHaveLength(1);
    expect(ctx.service.session(A, NOW + 21).activeInvite).toBeNull();
    expect(() => ctx.service.setup(A, invite, NOW + 22)).toThrow(/archived/);
    expect(() => ctx.service.rematch(A, invite, NOW + 22)).toThrow(/archived/);
    const next = ctx.service.create({ actor: A, mode: "guest" }, NOW + 23);
    expect(next.invite).not.toBe(invite);
    expect(next.series).toMatchObject({ phase: "setup", you: 0, opponent: 0 });
    expect(ctx.service.records.byInvite(invite).series).toEqual(old.series);
    const refreshed = ctx.service.preview(invite, A, NOW + 24);
    expect(refreshed.seated && refreshed.phase).toBe("complete");
    expect(refreshed.seated && refreshed.result?.headline).toBe("Defeat");
    expect(ctx.service.session(A, NOW + 25).activeInvite).toBe(next.invite);
  } finally {
    ctx.store.close();
  }
});
it("temporary loss of presence and refresh preserve the live battle and deadline", () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    start(ctx, invite);
    const before = ctx.service.preview(invite, A, NOW + 11);
    const away = ctx.service.preview(
      invite,
      B,
      NOW + 12 + PVP_TIMERS.disconnectMs,
    );
    expect(away.seated && away.opponent?.connected).toBe(false);
    expect(away.seated && away.result).toBeNull();
    const back = ctx.service.preview(
      invite,
      A,
      NOW + 13 + PVP_TIMERS.disconnectMs,
    );
    expect(back.seated && back.deadlineAt).toBe(
      before.seated && before.deadlineAt,
    );
    expect(back.seated && back.battle?.id).toBe(
      before.seated && before.battle?.id,
    );
    expect(ctx.service.records.byInvite(invite).closedAt).toBeNull();
  } finally {
    ctx.store.close();
  }
});
it("two real drawn battles close the series without awarding a win", async () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    start(ctx, invite);
    let now = NOW + 11;
    for (let battle = 0; battle < 2; battle++) {
      for (let turn = 0; turn < 20; turn++) {
        const current = ctx.service.records.byInvite(invite).match!;
        ctx.service.move(A, invite, current.state.round, "guard", now++);
        ctx.service.move(B, invite, current.state.round, "guard", now++);
        now += PVP_TIMERS.presentMs + 1;
        ctx.service.preview(invite, A, now);
      }
      if (battle === 0) {
        expect(ctx.service.session(A, now).activeInvite).toBe(invite);
        await ctx.service.continueSeries(A, invite, now++);
        await ctx.service.continueSeries(B, invite, now++);
        ctx.service.assets(A, invite, now++);
        ctx.service.assets(B, invite, now++);
      }
    }
    expect(ctx.service.records.byInvite(invite).series?.outcome).toMatchObject({
      kind: "draw",
      winner: null,
    });
    expect(ctx.service.records.byInvite(invite).series?.wins).toEqual({
      a: 0,
      b: 0,
    });
    expect(ctx.service.session(A, now).activeInvite).toBeNull();
    expect(
      ctx.store.db.prepare("SELECT COUNT(*) n FROM pvp_queue").get()?.n,
    ).toBe(0);
  } finally {
    ctx.store.close();
  }
});
it("returning to the queue settles an abandoned guest battle without a room poll", async () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    start(ctx, invite);
    vi.spyOn(Date, "now").mockReturnValue(NOW + 100000);
    const handler = createMatchHandlers(ctx.store, "http://localhost:3000");
    const response = await handler.get(
      new NextRequest("http://localhost:3000/api/match?mode=guest", {
        headers: { cookie: `chog_guest=${A}` },
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("idle");
    expect(ctx.service.records.byInvite(invite).series?.outcome).toMatchObject({
      kind: "abandoned",
      winner: null,
    });
    expect(ctx.service.records.byInvite(invite).closedAt).not.toBeNull();
  } finally {
    ctx.store.close();
  }
});
it("expired public selection releases both matched associations lazily on queue access", () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    expect(ctx.queue.state(A, NOW + 100000).status).toBe("idle");
    expect(ctx.queue.state(B, NOW + 100000).status).toBe("idle");
    expect(ctx.service.records.byInvite(invite).closedAt).not.toBeNull();
  } finally {
    ctx.store.close();
  }
});
it("restart-safe legacy terminal cleanup never releases a newer token encounter", () => {
  const dir = mkdtempSync(join(tmpdir(), "soryn-lifecycle-"));
  const path = join(dir, "test.sqlite");
  let ctx = context(path);
  try {
    const grant = {
      identity: identityFor("276"),
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      generation: A,
    };
    const old = ctx.service.create({ actor: A, mode: "official" }, NOW, grant);
    const stored = ctx.service.records.byInvite(old.invite);
    stored.closedAt = NOW + 1;
    ctx.service.records.save(stored); // legacy archive persisted before its lock cleanup
    ctx.store.close();
    ctx = context(path);
    expect(ctx.service.session(A, NOW + 2).activeInvite).toBeNull();
    expect(ctx.service.locks.get(tokenKey(grant.identity), NOW + 2)).toBeNull();
    const fresh = ctx.service.create(
      { actor: A, mode: "official" },
      NOW + 3,
      grant,
    );
    const current = ctx.service.locks.get(tokenKey(grant.identity), NOW + 3)!;
    expect(current.encounter).not.toBe(stored.series?.id);
    ctx.service.close(A, old.invite, NOW + 4);
    ctx.service.preview(old.invite, A, NOW + 5);
    expect(ctx.service.locks.get(tokenKey(grant.identity), NOW + 5)).toEqual(
      current,
    );
    expect(ctx.service.session(A, NOW + 6).activeInvite).toBe(fresh.invite);
  } finally {
    ctx.store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it("origin is explicit for new rooms and backward compatible with the historical public-only starter-room contract", () => {
  const ctx = context();
  try {
    const invite = pair(ctx);
    const current = ctx.service.records.byInvite(invite);
    expect(current.origin).toBe("public");
    const legacy = pvpRoomSchema.parse({ ...current, origin: undefined });
    expect(roomOrigin(legacy)).toBe("public");
    expect(roomOrigin({ ...legacy, origin: "private" })).toBe("private");
    expect(roomOrigin({ ...legacy, roster: "private" })).toBe("private");
  } finally {
    ctx.store.close();
  }
});
