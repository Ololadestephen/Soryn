import {
  walletAccessFixture,
  qualifyingHoldings,
} from "../fixtures/wallet-access";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { identityFor, tokenKey } from "../../src/domain/identity";
import { createMatchHandlers } from "../../src/server/match/http";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { TokenLocks } from "../../src/server/pvp/locks";
import { TokenRecords } from "../../src/server/records/tokenRecords";
import { TokenProfileService } from "../../src/server/records/profile";
import { timersFromEnv } from "../../src/domain/pvp/timers";
import { officialCombatFixture, origin } from "../fixtures/official-combat";

const TOKEN = identityFor("276");
const KEY = tokenKey(TOKEN);

function matchCall(
  match: ReturnType<typeof createMatchHandlers>,
  input: Record<string, unknown>,
  cookie: string,
  headers: Record<string, string> = {},
) {
  return match.post(
    new NextRequest(`${origin}/api/match`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        cookie,
        ...headers,
      },
      body: JSON.stringify(input),
    }),
  );
}

function matchState(
  match: ReturnType<typeof createMatchHandlers>,
  cookie: string,
  headers: Record<string, string> = {},
) {
  return match.get(
    new NextRequest(`${origin}/api/match`, { headers: { cookie, ...headers } }),
  );
}

describe("holder entry through the public queue", () => {
  it("seats a verified token, transfers the lock, and names the seat", async () => {
    const ctx = await officialCombatFixture();
    const signed = await ctx.login();
    const match = createMatchHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
      qualifyingHoldings,
    );
    const peer = await walletAccessFixture(qualifyingHoldings, ctx);
    const guestCookie = peer.cookie;
    const holder = await matchCall(
      match,
      { operation: "join" },
      signed.cookie,
      signed.headers,
    );
    expect(holder.status).toBe(200);
    expect((await holder.json()).status).toBe("waiting");
    const row = ctx.store.db
      .prepare("SELECT * FROM pvp_queue WHERE token_key=?")
      .get(KEY) as { status: string } | undefined;
    expect(row?.status).toBe("waiting");
    const guest = await matchCall(
      match,
      { operation: "join", mode: "guest" },
      guestCookie,
      peer.headers,
    );
    expect((await guest.json()).status).toBe("offered");
    // Both sides get the offer; accepting on both seals the matched room.
    const offered = await matchState(match, signed.cookie, signed.headers);
    const offer = await offered.json();
    expect(offer.status).toBe("offered");
    await matchCall(
      match,
      { operation: "accept" },
      signed.cookie,
      signed.headers,
    );
    const sealed = await matchCall(
      match,
      { operation: "accept", mode: "guest" },
      guestCookie,
      peer.headers,
    );
    const { invite } = await sealed.json();
    expect(invite).toBeTruthy();
    const room = new PvpService(
      new PvpStore(ctx.store),
      timersFromEnv(process.env),
    ).records.byInvite(invite);
    const official = [room.seats.a, room.seats.b].find(
      (seat) => seat?.mode === "official",
    );
    expect(official?.holderGrant?.identity.tokenId).toBe("276");
    expect(official?.name).toBe("Chog #276");
    expect(
      [room.seats.a, room.seats.b].some((seat) => seat?.mode === "guest"),
    ).toBe(true);
    // The queue lock hands over to the room's series lock, one holder per token.
    const lock = new TokenLocks(ctx.store).get(KEY, Date.now());
    expect(lock?.encounter).toBe(room.series!.id);
    expect(lock?.kind).toBe("series");
  });

  it("rejects anonymous queue admission without binding a token", async () => {
    const ctx = await officialCombatFixture();
    const match = createMatchHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
    );
    const guestCookie = `chog_guest=${randomUUID()}`;
    const joined = await matchCall(match, { operation: "join" }, guestCookie);
    expect(joined.status).toBe(403);
    const bound = ctx.store.db
      .prepare("SELECT * FROM pvp_queue WHERE token_key IS NOT NULL")
      .all();
    expect(bound).toHaveLength(0);
  });
});

describe("verified token picker and public profile", () => {
  it("lists the fresh token, drops it on transfer, and holds the picker on outage", async () => {
    const ctx = await officialCombatFixture();
    const signed = await ctx.login();
    const records = new TokenRecords(ctx.store);
    records.write({
      token: KEY,
      kind: "series",
      source: "series-fixture",
      headline: "Victory",
      explanation: "First to two battle wins.",
      fighter: "Pip",
      opponent: "Guest 4",
      opponentFighter: "Bolt",
      arena: "Ruined Sanctuary",
      rounds: null,
      score: "2–0",
      route: null,
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recordedAt: 1_700_000_000_000,
    });
    const picker = () =>
      ctx.identity.post(
        new NextRequest(`${origin}/api/identity`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            cookie: signed.cookie,
            ...signed.headers,
          },
          body: JSON.stringify({ operation: "tokens" }),
        }),
      );
    const listed = await picker();
    expect(listed.status).toBe(200);
    const { tokens } = await listed.json();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].identity.tokenId).toBe("276");
    expect(tokens[0].records).toMatchObject({ series: 1, wins: 1 });
    ctx.transferAway();
    const afterTransfer = await picker();
    expect(afterTransfer.status).toBe(200);
    expect((await afterTransfer.json()).tokens).toEqual([]);
    // Verification outages stay loud instead of looking like a transfer.
    const ctx2 = await officialCombatFixture();
    const signed2 = await ctx2.login();
    const picker2 = () =>
      ctx2.identity.post(
        new NextRequest(`${origin}/api/identity`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            cookie: signed2.cookie,
            ...signed2.headers,
          },
          body: JSON.stringify({ operation: "tokens" }),
        }),
      );
    ctx2.outage();
    expect((await picker2()).status).toBe(503);
    ctx2.recover();
    expect((await picker2()).status).toBe(200);
  });

  it("shows a dated verified owner, then the unavailable state", async () => {
    const ctx = await officialCombatFixture();
    const profile = new TokenProfileService(
      new TokenRecords(ctx.store),
      ctx.auth.ownership,
    );
    const verified = await profile.profile(TOKEN);
    expect(verified.ownership.status).toBe("verified");
    expect(verified.ownership.owner).toMatch(/^0x[0-9a-f]{40}$/);
    expect(verified.ownership.checkedAt).toBeTypeOf("number");
    ctx.outage();
    const offline = await profile.profile(TOKEN);
    expect(offline).toEqual({
      identity: TOKEN,
      ownership: { status: "unavailable", owner: null, checkedAt: null },
      records: [],
      summary: {
        series: 0,
        battles: 0,
        story: 0,
        noContest: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
    });
  });
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
