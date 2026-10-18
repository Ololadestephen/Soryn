import {
  walletAccessFixture,
  qualifyingHoldings,
} from "../fixtures/wallet-access";
import { beginStoryBattle, prepareStoryHttp } from "../fixtures/story-journey";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { legalMoves } from "../../src/domain/combat/moves";
import type { Move } from "../../src/domain/combat/contracts";
import {
  identityFor,
  tokenKey,
  type OfficialAuthority,
} from "../../src/domain/identity";
import { tokenActorUuid } from "../../src/server/tokenActors";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import type { AuthService } from "../../src/server/auth/service";
import type { PrivyVerifier } from "../../src/server/auth/privy";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { TokenLocks } from "../../src/server/pvp/locks";
import { QueueService } from "../../src/server/pvp/queue";
import { createMatchHandlers } from "../../src/server/match/http";
import { createPvpHandlers } from "../../src/server/pvp/http";
import { createStoryHandlers } from "../../src/server/story/http";
import { StoryService } from "../../src/server/story/service";
import { officialCombatFixture, origin } from "../fixtures/official-combat";

const TOKEN = tokenKey(identityFor("276"));

function walletSecret(cookie: string): string {
  return cookie.match(/chog_wallet=([a-f0-9]{64})/)![1];
}

async function setup() {
  const ctx = await officialCombatFixture();
  const signed = await ctx.login();
  const peer = await walletAccessFixture(qualifyingHoldings, ctx);
  const friend = peer.cookie;
  const pvp = createPvpHandlers(
    ctx.store,
    origin,
    ctx.auth,
    ctx.verifier,
    qualifyingHoldings,
  );
  const story = createStoryHandlers(ctx.store, origin, ctx.auth, ctx.verifier);
  const post = (input: Record<string, unknown>, official = true) =>
    pvp.post(
      new NextRequest(`${origin}/api/pvp`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...(official ? signed.headers : peer.headers),
          cookie: official ? signed.cookie : friend,
        },
        body: JSON.stringify(input),
      }),
    );
  const spost = (input: Record<string, unknown>) =>
    story.post(
      new NextRequest(`${origin}/api/story`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...signed.headers,
          cookie: signed.cookie,
        },
        body: JSON.stringify({ ...input, mode: "official" }),
      }),
    );
  return { ctx, signed, pvp, story, post, spost, peer };
}

async function openBattle(
  post: (
    input: Record<string, unknown>,
    official?: boolean,
  ) => Promise<Response>,
): Promise<string> {
  const created = await post({ operation: "create", mode: "official" });
  expect(created.status).toBe(200);
  const { invite } = await created.json();
  expect(
    (await post({ operation: "join", invite, mode: "guest" }, false)).status,
  ).toBe(200);
  expect(
    (
      await post({
        operation: "select",
        invite,
        characterId: "pip",
        mode: "official",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await post(
        { operation: "select", invite, characterId: "bolt", mode: "guest" },
        false,
      )
    ).status,
  ).toBe(200);
  expect((await post({ operation: "ready", invite, ready: true })).status).toBe(
    200,
  );
  expect(
    (
      await post(
        { operation: "ready", invite, ready: true, mode: "guest" },
        false,
      )
    ).status,
  ).toBe(200);
  await post({ operation: "assets", invite });
  await post({ operation: "assets", invite, mode: "guest" }, false);
  return invite;
}

describe("transfer timing across official rooms", () => {
  it("closes a solo lobby on the first post-transfer action, then fails closed", async () => {
    const { ctx, post } = await setup();
    try {
      const created = await post({ operation: "create", mode: "official" });
      const { invite } = await created.json();
      ctx.transferAway();
      const closed = await post({
        operation: "select",
        invite,
        characterId: "pip",
        mode: "official",
      });
      expect(closed.status).toBe(200);
      expect((await closed.json()).phase).toBe("closed");
      expect(
        (
          await post({
            operation: "select",
            invite,
            characterId: "pip",
            mode: "official",
          })
        ).status,
      ).toBe(403);
    } finally {
      ctx.store.close();
    }
  });

  it("closes a joined lobby instead of letting the guest play on", async () => {
    const { ctx, post } = await setup();
    try {
      const created = await post({ operation: "create", mode: "official" });
      const { invite } = await created.json();
      expect(
        (await post({ operation: "join", invite, mode: "guest" }, false))
          .status,
      ).toBe(200);
      ctx.transferAway();
      const closed = await post(
        { operation: "select", invite, characterId: "bolt", mode: "guest" },
        false,
      );
      expect(closed.status).toBe(200);
      expect((await closed.json()).phase).toBe("closed");
    } finally {
      ctx.store.close();
    }
  });

  it("treats a generation rotation without owner change as a transfer", async () => {
    const { ctx, post } = await setup();
    try {
      const invite = await openBattle(post);
      ctx.awayBack();
      const voided = await post({
        operation: "move",
        invite,
        round: 1,
        move: "basic",
      });
      expect(voided.status).toBe(200);
      expect((await voided.json()).series.outcome).toMatchObject({
        kind: "no-contest",
        winner: null,
      });
    } finally {
      ctx.store.close();
    }
  });
});

describe("RPC outage across official rooms", () => {
  it("fails official writes closed, keeps guest play, and recovers", async () => {
    const { ctx, post, pvp, peer } = await setup();
    try {
      const invite = await openBattle(post);
      ctx.outage();
      const blocked = await post({
        operation: "move",
        invite,
        round: 1,
        move: "basic",
      });
      expect(blocked.status).toBe(503);
      expect(await blocked.json()).toMatchObject({
        error: expect.stringMatching(/unavailable/i),
      });
      // Opponent polls also fail closed; they cannot commit deadlines during an outage.
      const seen = await pvp.get(
        new NextRequest(`${origin}/api/pvp?invite=${invite}`, {
          headers: { cookie: peer.cookie, ...peer.headers },
        }),
      );
      expect(seen.status).toBe(503);
      const saved = new PvpStore(ctx.store).byInvite(invite);
      expect(saved.series?.outcome).toBeNull();
      ctx.recover();
      expect(
        (await post({ operation: "move", invite, round: 1, move: "basic" }))
          .status,
      ).toBe(200);
    } finally {
      ctx.store.close();
    }
  });

  it("never trusts a stale grant observed across an outage transfer", async () => {
    const { ctx, post } = await setup();
    try {
      const invite = await openBattle(post);
      ctx.outage();
      ctx.transferAway();
      ctx.recover();
      const voided = await post({
        operation: "move",
        invite,
        round: 1,
        move: "basic",
      });
      expect(voided.status).toBe(200);
      expect((await voided.json()).series.outcome).toMatchObject({
        kind: "no-contest",
        winner: null,
      });
    } finally {
      ctx.store.close();
    }
  });
});

describe("two sessions on one token", () => {
  it("resumes the open room instead of opening a second series", async () => {
    const { ctx, post, pvp } = await setup();
    try {
      const created = await post({ operation: "create", mode: "official" });
      const { invite } = await created.json();
      const second = await ctx.login();
      const reopened = await pvp.post(
        new NextRequest(`${origin}/api/pvp`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            ...second.headers,
            cookie: second.cookie,
          },
          body: JSON.stringify({ operation: "create", mode: "official" }),
        }),
      );
      expect(reopened.status).toBe(200);
      expect((await reopened.json()).invite).toBe(invite);
      // The same wallet acts in the same seat from either session.
      const selected = await pvp.post(
        new NextRequest(`${origin}/api/pvp`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            ...second.headers,
            cookie: second.cookie,
          },
          body: JSON.stringify({
            operation: "select",
            invite,
            characterId: "pip",
            mode: "official",
          }),
        }),
      );
      expect(selected.status).toBe(200);
      expect(
        (
          await post({
            operation: "select",
            invite,
            characterId: "pip",
            mode: "official",
          })
        ).status,
      ).toBe(200);
    } finally {
      ctx.store.close();
    }
  });
});

describe("official story interruption over HTTP", () => {
  function driveVictory(
    battles: BattleService,
    authority: OfficialAuthority,
    battleId: string,
  ) {
    for (let n = 0; n < 30; n += 1) {
      const record = battles.records.get(
        battleId,
        tokenActorUuid(authority.identity, authority.ownership.owner),
      );
      if (record.state.outcome) return record;
      const legal = legalMoves(record.snapshot, record.state, "player");
      const move: Move = legal.includes("special") ? "special" : "basic";
      battles.step(
        tokenActorUuid(authority.identity, authority.ownership.owner),
        battleId,
        record.state.round,
        move,
        authority,
      );
    }
    throw new Error("Story battle did not finish");
  }

  async function storyAs(
    ctx: { store: Store; auth: AuthService; verifier: PrivyVerifier },
    login: { cookie: string; headers: Record<string, string> },
    input: Record<string, unknown>,
  ) {
    const story = createStoryHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
    );
    return story.post(
      new NextRequest(`${origin}/api/story`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...login.headers,
          cookie: login.cookie,
        },
        body: JSON.stringify({ ...input, mode: "official" }),
      }),
    );
  }

  it("discards the open encounter on transfer and keeps saved progress", async () => {
    const { ctx, signed, spost } = await setup();
    const battles = new BattleService(new BattleStore(ctx.store));
    try {
      const secret = walletSecret(signed.cookie);
      const authority = (await ctx.auth.authorize(secret)).authority;
      expect(
        (await spost({ operation: "choose", fighter: "pip" })).status,
      ).toBe(200);
      await prepareStoryHttp(spost);
      const scout = await (await spost({ operation: "begin" })).json();
      driveVictory(battles, authority, scout.battleId);
      expect(
        (
          await (
            await spost({ operation: "resolve", battleId: scout.battleId })
          ).json()
        ).step,
      ).toBe("route");
      expect((await spost({ operation: "route", route: "grove" })).status).toBe(
        200,
      );
      for (const action of ["prints", "companion", "bank"])
        await spost({ operation: "interact", action });
      const guardian = await (await spost({ operation: "begin" })).json();
      battles.step(
        tokenActorUuid(authority.identity, authority.ownership.owner),
        guardian.battleId,
        1,
        "basic",
        authority,
      );
      ctx.transferAway();
      const discarded = await spost({
        operation: "resolve",
        battleId: guardian.battleId,
      });
      expect(discarded.status).toBe(200);
      expect(await discarded.json()).toMatchObject({
        step: "path",
        battleId: null,
        completed: false,
      });
      // Succession inherits published accomplishments, never the old keeper's unfinished run.
      const outsider = await ctx.login(ctx.outsider);
      expect(
        (await storyAs(ctx, outsider, { operation: "begin" })).status,
      ).toBe(409);
      await storyAs(ctx, outsider, { operation: "choose", fighter: "pip" });
      await prepareStoryHttp((input) => storyAs(ctx, outsider, input));
      const resumed = await (
        await storyAs(ctx, outsider, { operation: "begin" })
      ).json();
      expect(resumed.step).toBe("scout");
      expect(resumed.battleId).not.toBe(guardian.battleId);
      // The orphaned battle rejects the new generation outright.
      const fresh = await ctx.auth.authorize(walletSecret(outsider.cookie));
      expect(() =>
        battles.step(
          tokenActorUuid(authority.identity, authority.ownership.owner),
          guardian.battleId,
          1,
          "basic",
          fresh.authority,
        ),
      ).toThrow(/interrupted/);
    } finally {
      ctx.store.close();
    }
  });

  it("duplicate resolves do not duplicate progress", async () => {
    const { ctx, signed, spost } = await setup();
    const battles = new BattleService(new BattleStore(ctx.store));
    try {
      const secret = walletSecret(signed.cookie);
      const authority = (await ctx.auth.authorize(secret)).authority;
      await spost({ operation: "choose", fighter: "pip" });
      await prepareStoryHttp(spost);
      const scout = await (await spost({ operation: "begin" })).json();
      driveVictory(battles, authority, scout.battleId);
      const first = await (
        await spost({ operation: "resolve", battleId: scout.battleId })
      ).json();
      const second = await (
        await spost({ operation: "resolve", battleId: scout.battleId })
      ).json();
      expect(first.step).toBe("route");
      expect(second.step).toBe("route");
    } finally {
      ctx.store.close();
    }
  });
});

describe("token lock competition across surfaces", () => {
  it("one token cannot hold a private series and a story encounter at once", async () => {
    const { ctx, signed, post } = await setup();
    try {
      const secret = walletSecret(signed.cookie);
      const authority = (await ctx.auth.authorize(secret)).authority;
      const created = await post({ operation: "create", mode: "official" });
      expect(created.status).toBe(200);
      const story = new StoryService(
        ctx.store,
        new BattleService(new BattleStore(ctx.store)),
      );
      const rowActor = `token:${TOKEN}`;
      story.choose(rowActor, "pip");
      expect(() =>
        beginStoryBattle(story, rowActor, Date.now(), {
          token: TOKEN,
          binding: {
            identity: authority.identity,
            owner: authority.ownership.owner,
            generation: authority.generation,
          },
          authority,
        }),
      ).toThrow(/already in an official series/);
    } finally {
      ctx.store.close();
    }
  });

  it("a queue reservation blocks private rooms until it lapses", () => {
    const store = new Store(":memory:");
    try {
      const pvp = new PvpService(new PvpStore(store), PVP_TIMERS);
      const queue = new QueueService(store, pvp);
      const holder = {
        actor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        mode: "official" as const,
      };
      const binding = {
        key: TOKEN,
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      };
      queue.join({ actor: holder.actor, mode: "guest" }, 1_000, binding);
      expect(() =>
        pvp.create(holder, 1_000, {
          identity: identityFor("276"),
          owner: binding.owner,
          generation: binding.generation,
        }),
      ).toThrow(/already in an official queue/);
      queue.cancel(holder.actor, 1_000);
      const created = pvp.create(holder, 1_000, {
        identity: identityFor("276"),
        owner: binding.owner,
        generation: binding.generation,
      });
      expect(created.invite).toBeTruthy();
    } finally {
      store.close();
    }
  });
});

describe("restart with an active lock", () => {
  it("recovers the room and its lock, then cleans up on close", async () => {
    const directory = mkdtempSync(join(tmpdir(), "chog-restart-"));
    const path = join(directory, "restart.sqlite");
    const grant = {
      identity: identityFor("276"),
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    let store = new Store(path);
    const actor = {
      actor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      mode: "official" as const,
    };
    const created = new PvpService(new PvpStore(store), PVP_TIMERS).create(
      actor,
      1_000,
      grant,
    );
    store.close();
    store = new Store(path);
    try {
      const service = new PvpService(
        new PvpStore(store),
        PVP_TIMERS,
        undefined,
        undefined,
        undefined,
        async () => [],
      );
      const room = service.records.byInvite(created.invite);
      expect(room.seats.a?.holderGrant).toMatchObject({
        owner: grant.owner,
      });
      expect(service.locks.get(TOKEN, 1_000)?.encounter).toBe(
        service.records.byInvite(created.invite).series!.id,
      );
      expect(
        await service.guardOfficialRoom(
          created.invite,
          { seat: "a", grant },
          1_000,
        ),
      ).toBeNull();
      service.close(actor.actor, created.invite, 1_000);
      expect(service.locks.get(TOKEN, 1_000)).toBeNull();
    } finally {
      store.close();
    }
    const reopened = new Store(path);
    try {
      expect(new TokenLocks(reopened).get(TOKEN, 1_000)).toBeNull();
    } finally {
      reopened.close();
    }
  });
});

describe("former owner reads", () => {
  it("keeps only completed history after revocation, never live state", async () => {
    const { ctx, signed, post } = await setup();
    try {
      const created = await post({ operation: "create", mode: "official" });
      expect(created.status).toBe(200);
      ctx.transferAway();
      const pvp = createPvpHandlers(ctx.store, origin, ctx.auth, ctx.verifier);
      const session = await pvp.get(
        new NextRequest(`${origin}/api/pvp`, {
          headers: { ...signed.headers, cookie: signed.cookie },
        }),
      );
      expect(session.status).toBe(200);
      expect(await session.json()).toMatchObject({
        activeInvite: null,
        activePhase: null,
        history: [],
      });
    } finally {
      ctx.store.close();
    }
  });
});

// These are synthetic signed sessions and fixture RPC observations, never real wallets.
it("queue recovery records RPC stalls and applies confirmed ownership interruptions before freeing participation", async () => {
  const { ctx, signed, post } = await setup();
  try {
    const invite = await openBattle(post);
    const matches = createMatchHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
    );
    const read = () =>
      matches.get(
        new NextRequest(`${origin}/api/match?mode=official`, {
          headers: { ...signed.headers, cookie: signed.cookie },
        }),
      );
    const before = new PvpStore(ctx.store).byInvite(invite);
    ctx.outage();
    expect((await read()).status).toBe(503);
    const stalled = new PvpStore(ctx.store).byInvite(invite);
    expect(stalled.ownershipStallSince).not.toBeNull();
    expect(stalled.closedAt).toBeNull();
    expect(stalled.match?.id).toBe(before.match?.id);
    expect(stalled.series?.outcome).toBeNull();
    expect(new TokenLocks(ctx.store).get(TOKEN, Date.now())).not.toBeNull();
    ctx.recover();
    expect((await read()).status).toBe(200);
    ctx.transferAway();
    expect((await read()).status).toBe(403);
    const ended = new PvpStore(ctx.store).byInvite(invite);
    expect(ended.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(ended.closedAt).not.toBeNull();
    expect(new TokenLocks(ctx.store).get(TOKEN, Date.now())).toBeNull();
  } finally {
    ctx.store.close();
  }
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
