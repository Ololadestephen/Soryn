import { afterEach, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import type { PvpRoom } from "../../src/domain/pvp/types";
import { legalMoves } from "../../src/domain/combat/moves";
import { createPvpHandlers } from "../../src/server/pvp/http";
import { PvpStore } from "../../src/server/pvp/persistence";
import { walletAccessFixture } from "../fixtures/wallet-access";
import { origin } from "../fixtures/official-combat";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

type WalletFixture = Awaited<ReturnType<typeof walletAccessFixture>>;
async function advanceBattle(
  room: PvpRoom,
  players: readonly [WalletFixture, WalletFixture],
  post: (
    who: WalletFixture,
    data: Record<string, unknown>,
  ) => Promise<NextResponse>,
  invite: string,
) {
  const [a, b] = players;
  if (room.series?.phase === "intermission") {
    for (const who of [a, b])
      expect((await post(who, { operation: "continue", invite })).status).toBe(
        200,
      );
  } else if (room.match?.phase === "loading") {
    for (const who of [a, b])
      expect((await post(who, { operation: "assets", invite })).status).toBe(
        200,
      );
  } else if (room.match?.phase === "choose") {
    const battle = room.match;
    for (const [who, side] of [
      [a, "player"],
      [b, "opponent"],
    ] as const) {
      const moves = legalMoves(battle.snapshot, battle.state, side);
      expect(
        (
          await post(who, {
            operation: "move",
            invite,
            round: battle.state.round,
            move: moves.includes("special") ? "special" : "basic",
          })
        ).status,
      ).toBe(200);
    }
  }
}

/** Actual authenticated HTTP admissions and deterministic combat, not a forged terminal room. */
async function completedSeries() {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  let eligible = true;
  const token = vi.fn(async () => ({
    qualifies: eligible,
    block: "0x100",
    checkedAt: Date.now(),
  }));
  const reader = {
    token,
    nft: async () => ({
      qualifies: false,
      block: "0x100",
      checkedAt: Date.now(),
    }),
  };
  const a = await walletAccessFixture(reader),
    b = await walletAccessFixture(reader, a.ctx);
  const { store, auth, verifier } = a.ctx;
  const api = createPvpHandlers(store, origin, auth, verifier, reader),
    records = new PvpStore(store);
  function request(
    who: typeof a,
    data?: Record<string, unknown>,
    invite?: string,
  ) {
    return new NextRequest(
      `${origin}/api/pvp${invite ? `?mode=guest&invite=${invite}` : ""}`,
      {
        method: data ? "POST" : "GET",
        headers: {
          Origin: origin,
          "content-type": "application/json",
          Cookie: who.cookie,
          ...who.headers,
        },
        ...(data ? { body: JSON.stringify({ mode: "guest", ...data }) } : {}),
      },
    );
  }
  const post = (who: typeof a, data: Record<string, unknown>) =>
    api.post(request(who, data));
  const created = await post(a, { operation: "create" });
  expect(created.status).toBe(200);
  const { invite } = await created.json();
  for (const [who, data] of [
    [b, { operation: "join" }],
    [a, { operation: "select", characterId: "pip" }],
    [b, { operation: "select", characterId: "bolt" }],
    [a, { operation: "ready", ready: true }],
    [b, { operation: "ready", ready: true }],
  ] as const)
    expect((await post(who, { ...data, invite })).status).toBe(200);
  vi.useFakeTimers({ toFake: ["Date"] });
  let clock = Date.now();
  for (let step = 0; step < 65; step++) {
    const room = records.byInvite(invite);
    if (room.series?.phase === "complete") break;
    await advanceBattle(room, [a, b], post, invite);
    clock += room.timers.presentMs + 1;
    vi.setSystemTime(clock);
    expect((await api.get(request(a, undefined, invite))).status).toBe(200);
  }
  expect(records.byInvite(invite).series?.phase).toBe("complete");
  return {
    a,
    b,
    store,
    records,
    invite,
    post,
    token,
    setEligible: (value: boolean) => {
      eligible = value;
    },
  };
}

it.each(["rematch", "setup"])(
  "archived %s cannot revive a series or its old access grant",
  async (operation) => {
    const f = await completedSeries();
    try {
      const before = f.records.byInvite(f.invite),
        reads = f.token.mock.calls.length;
      f.setEligible(false);
      expect((await f.post(f.a, { operation, invite: f.invite })).status).toBe(
        409,
      );
      expect(f.token.mock.calls.length).toBe(reads);
      expect(f.records.byInvite(f.invite).series).toEqual(before.series);
      expect(f.records.byInvite(f.invite).closedAt).not.toBeNull();
      // The actual rematch path is a new invitation, and must ignore the old cached grant.
      expect((await f.post(f.a, { operation: "create" })).status).toBe(403);
      expect(f.token.mock.calls.length).toBeGreaterThan(reads);
      vi.stubEnv("SORYN_HOLDER_ACCESS", "disabled");
      expect((await f.post(f.a, { operation: "create" })).status).toBe(503);
      vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
      f.setEligible(true);
      const next = await f.post(f.a, { operation: "create" });
      expect(next.status).toBe(200);
      expect((await next.json()).invite).not.toBe(f.invite);
      expect(f.records.byInvite(f.invite).series).toEqual(before.series);
      expect(
        f.store.db.prepare("SELECT COUNT(*) n FROM token_locks").get()?.n,
      ).toBe(0);
      expect(
        f.store.db.prepare("SELECT COUNT(*) n FROM token_record").get()?.n,
      ).toBe(0);
    } finally {
      f.store.close();
    }
  },
);
