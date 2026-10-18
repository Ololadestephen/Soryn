import { LEGACY_ACCESS_POLICY } from "../../src/domain/access/policy";
import { legalMoves } from "../../src/domain/combat/moves";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPvpHandlers } from "../../src/server/pvp/http";
import { createMatchHandlers } from "../../src/server/match/http";
import { createStoryHandlers } from "../../src/server/story/http";
import { walletAccessFixture } from "../fixtures/wallet-access";
import { origin } from "../fixtures/official-combat";
import { PvpStore } from "../../src/server/pvp/persistence";
import { Entitlements } from "../../src/server/access/service";
import { WalletAccessAuth } from "../../src/server/access/auth";
import { StoryService } from "../../src/server/story/service";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
const noNft = async () => ({
  qualifies: false,
  checkedAt: Date.now(),
  block: "0x100",
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function request(
  path: string,
  fixture: { cookie: string; headers: Record<string, string> },
  data?: unknown,
) {
  return new NextRequest(`${origin}${path}`, {
    method: data ? "POST" : "GET",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: fixture.cookie,
      ...fixture.headers,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
it("wallet-play signatures bind browser, wallet, Privy subject and a one-use expiring nonce without a fake NFT", async () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  const reader = {
    token: async () => ({
      qualifies: true,
      checkedAt: Date.now(),
      block: "0x100",
    }),
    nft: noNft,
  };
  const f = await walletAccessFixture(reader);
  try {
    expect((await f.post(f.verification, f.browser)).status).toBe(401);
    expect((await f.post(f.verification, "")).status).toBe(401);
    const login = new WalletAccessAuth(
      f.ctx.store,
      f.ctx.auth,
      f.ctx.verifier,
      origin,
    );
    const player = await login.player(request("/api/access", f));
    expect(player.wallet).toBe(f.account.address.toLowerCase());
    await expect(
      login.player(
        request("/api/access", {
          ...f,
          headers: { ...f.headers, "x-soryn-wallet": `0x${"99".repeat(20)}` },
        }),
      ),
    ).rejects.toThrow(/selected wallet changed/);
    expect(
      f.ctx.store.db.prepare("SELECT COUNT(*) n FROM wallet_sessions").get()?.n,
    ).toBe(0);
    expect((await f.handlers.get(request("/api/access", f))).status).toBe(200);
    expect(
      (
        await f.handlers.get(
          request("/api/access", { cookie: f.cookie, headers: {} }),
        )
      ).status,
    ).toBe(200); // honest signed-out projection, not access
    const spoof = await f.handlers.get(
      request("/api/access", { cookie: f.cookie, headers: {} }),
    );
    expect((await spoof.json()).status).toBe("signed-out");
    const fresh = await f.post({
      operation: "challenge",
      wallet: f.account.address.toLowerCase(),
    });
    const challenge = await fresh.json();
    f.ctx.store.db
      .prepare(
        "UPDATE wallet_access_challenges SET record=json_set(record,'$.expires',0) WHERE nonce=?",
      )
      .run(challenge.nonce);
    expect(
      (
        await f.post(
          {
            operation: "verify",
            ...challenge,
            signature: await f.account.signMessage({
              message: challenge.message,
            }),
          },
          fresh.headers.get("set-cookie")!.split(";")[0],
        )
      ).status,
    ).toBe(401);
  } finally {
    f.ctx.store.close();
  }
});
it("enforces direct Story, queue, room and fighter admission; preserves six-fighter grants through the whole series and rechecks the next one", async () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  let eligible = true;
  const token = vi.fn(async () => ({
    qualifies: eligible,
    checkedAt: Date.now(),
    block: "0x100",
  }));
  const reader = { token, nft: noNft };
  const a = await walletAccessFixture(reader),
    b = await walletAccessFixture(reader, a.ctx);
  const { store, auth, verifier } = a.ctx;
  const pvp = createPvpHandlers(store, origin, auth, verifier, reader),
    match = createMatchHandlers(store, origin, auth, verifier, reader),
    story = createStoryHandlers(store, origin, auth, verifier, reader);
  const post = (who: typeof a, data: Record<string, unknown>) =>
    pvp.post(request("/api/pvp", who, { mode: "guest", ...data }));
  try {
    const guest = { cookie: a.ctx.guest, headers: {} };
    expect(
      (
        await match.post(
          request("/api/match", guest, { operation: "join", mode: "guest" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await pvp.post(
          request("/api/pvp", guest, { operation: "create", mode: "guest" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await story.post(
          request("/api/story", guest, {
            operation: "choose",
            fighter: "pip",
            mode: "guest",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await post(a, { operation: "create", access: { kind: "nft" } })).status,
    ).toBe(400);
    const created = await post(a, { operation: "create" });
    expect(created.status).toBe(200);
    expect(created.headers.get("set-cookie")).toBeNull(); // guest cookie/history is untouched
    const { invite } = await created.json();
    expect((await post(b, { operation: "join", invite })).status).toBe(200);
    expect(
      (await post(a, { operation: "select", invite, characterId: "aegis" }))
        .status,
    ).toBe(200);
    expect(
      (await post(b, { operation: "select", invite, characterId: "nyx" }))
        .status,
    ).toBe(200);
    expect(
      (await post(a, { operation: "select", invite, characterId: "ember" }))
        .status,
    ).toBe(403);
    const simultaneousReady = await Promise.all([
      post(a, { operation: "ready", invite, ready: true }),
      post(b, { operation: "ready", invite, ready: true }),
    ]);
    expect(simultaneousReady.map((reply) => reply.status)).toEqual([200, 200]);
    const records = new PvpStore(store);
    const frozen = records.byInvite(invite);
    expect(frozen.series?.phase).toBe("battle");
    expect(frozen.seats.a?.access?.kind).toBe("token");
    expect(frozen.seats.a?.holderGrant).toBeNull();
    // A pre-upgrade started series retains its original 50-token policy grant.
    for (const seat of Object.values(frozen.seats)) {
      if (seat?.access) seat.access.policy = LEGACY_ACCESS_POLICY;
    }
    records.save(frozen);
    eligible = false;
    const calls = token.mock.calls.length;
    expect(
      (await pvp.get(request(`/api/pvp?invite=${invite}&mode=guest`, a)))
        .status,
    ).toBe(200);
    expect(token).toHaveBeenCalledTimes(calls);
    // Run authoritative moves into intermission with qualification already lost.
    vi.useFakeTimers({ toFake: ["Date"] });
    let clock = Date.now();
    await post(a, { operation: "assets", invite });
    await post(b, { operation: "assets", invite });
    for (let turn = 0; turn < 20; turn++) {
      const current = records.byInvite(invite);
      if (current.series?.phase !== "battle") break;
      const battle = current.match!;
      const aMoves = legalMoves(battle.snapshot, battle.state, "player");
      const bMoves = legalMoves(battle.snapshot, battle.state, "opponent");
      expect(
        (
          await post(a, {
            operation: "move",
            invite,
            round: battle.state.round,
            move: aMoves.includes("special") ? "special" : "basic",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await post(b, {
            operation: "move",
            invite,
            round: battle.state.round,
            move: bMoves.includes("special") ? "special" : "basic",
          })
        ).status,
      ).toBe(200);
      clock += current.timers.presentMs + 1;
      vi.setSystemTime(clock);
      await pvp.get(request(`/api/pvp?invite=${invite}&mode=guest`, a));
    }
    expect(records.byInvite(invite).series?.phase).toBe("intermission");
    const firstId = records.byInvite(invite).match!.id;
    expect((await post(a, { operation: "continue", invite })).status).toBe(200);
    expect((await post(b, { operation: "continue", invite })).status).toBe(200);
    expect(records.byInvite(invite).match!.id).not.toBe(firstId);
    expect(records.byInvite(invite).series?.battleNumber).toBe(2);
    expect(records.byInvite(invite).seats.a?.access?.policy).toBe(
      LEGACY_ACCESS_POLICY,
    );
    expect(token).toHaveBeenCalledTimes(calls);
    vi.useRealTimers();

    expect((await post(a, { operation: "surrender", invite })).status).toBe(
      200,
    );
    expect(records.byInvite(invite).closedAt).not.toBeNull();
    expect((await post(a, { operation: "create" })).status).toBe(403);
    const login = new WalletAccessAuth(store, auth, verifier, origin);
    const player = await login.player(request("/api/access", a));
    expect(
      (
        await pvp.get(
          request("/api/pvp?mode=guest", {
            cookie: `chog_guest=${player.actor}`,
            headers: {},
          }),
        )
      ).status,
    ).toBe(401);
    expect(new Entitlements(store, reader).stored(player.actor)?.kind).toBe(
      "token",
    );
    expect(
      store.db.prepare("SELECT COUNT(*) n FROM token_record").get()?.n ?? 0,
    ).toBe(0);
  } finally {
    store.close();
  }
});
it("a started interaction retains its five-minute grant, while the next encounter and expired admission recheck holdings", async () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  let eligible = true;
  const reader = {
    token: async () => ({
      qualifies: eligible,
      checkedAt: Date.now(),
      block: "0x1",
    }),
    nft: noNft,
  };
  const f = await walletAccessFixture(reader);
  const handlers = createStoryHandlers(
    f.ctx.store,
    origin,
    f.ctx.auth,
    f.ctx.verifier,
    reader,
  );
  const post = (data: Record<string, unknown>) =>
    handlers.post(request("/api/story", f, { mode: "guest", ...data }));
  try {
    expect((await post({ operation: "choose", fighter: "aegis" })).status).toBe(
      200,
    );
    expect(
      (await post({ operation: "interact", action: "runes" })).status,
    ).toBe(200);
    // Simulate an encounter persisted before the threshold upgrade, keeping its authored clues.
    f.ctx.store.db
      .prepare(
        "UPDATE story_progress SET record=json_set(record, '$.journey.interaction.access.policy', ?)",
      )
      .run(LEGACY_ACCESS_POLICY);
    eligible = false;
    expect(
      (await post({ operation: "interact", action: "companion" })).status,
    ).toBe(200);
    const solved = await post({ operation: "interact", action: "align" });
    expect((await solved.json()).journey.stage).toBe("battle");
    expect((await post({ operation: "begin" })).status).toBe(403);
    eligible = true;
    expect((await post({ operation: "begin" })).status).toBe(200);
    eligible = false;
    const resumed = await post({ operation: "begin" });
    expect(resumed.status).toBe(200);
    const state = await resumed.json();
    expect(
      (await post({ operation: "resolve", battleId: state.battleId })).status,
    ).toBe(200);
    const login = new WalletAccessAuth(
      f.ctx.store,
      f.ctx.auth,
      f.ctx.verifier,
      origin,
    );
    const player = await login.player(request("/api/access", f));
    const service = new StoryService(
      f.ctx.store,
      new BattleService(new BattleStore(f.ctx.store)),
    );
    expect(service.state(player.actor).journey?.stage).toBe("battle");
  } finally {
    f.ctx.store.close();
  }
});
it("an expired noncombat grant requires new holdings without erasing clues", async () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  let eligible = true;
  const reader = {
    token: async () => ({
      qualifies: eligible,
      block: "0x1",
      checkedAt: Date.now(),
    }),
    nft: noNft,
  };
  const f = await walletAccessFixture(reader);
  const story = createStoryHandlers(
    f.ctx.store,
    origin,
    f.ctx.auth,
    f.ctx.verifier,
    reader,
  );
  const post = (data: Record<string, unknown>) =>
    story.post(request("/api/story", f, { mode: "guest", ...data }));
  try {
    expect((await post({ operation: "choose", fighter: "pip" })).status).toBe(
      200,
    );
    expect(
      (await post({ operation: "interact", action: "runes" })).status,
    ).toBe(200);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 300001);
    // Simulate an encounter persisted before the threshold upgrade, keeping its authored clues.
    f.ctx.store.db
      .prepare(
        "UPDATE story_progress SET record=json_set(record, '$.journey.interaction.access.policy', ?)",
      )
      .run(LEGACY_ACCESS_POLICY);
    eligible = false;
    expect(
      (await post({ operation: "interact", action: "companion" })).status,
    ).toBe(403);
    const saved = await story.get(request("/api/story?mode=guest", f));
    expect((await saved.json()).journey.clues).toEqual(["runes"]);
    eligible = true;
    expect(
      (await post({ operation: "interact", action: "companion" })).status,
    ).toBe(200);
  } finally {
    f.ctx.store.close();
    vi.useRealTimers();
  }
});
