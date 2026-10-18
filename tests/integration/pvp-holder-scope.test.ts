import {
  walletAccessFixture,
  qualifyingHoldings,
} from "../fixtures/wallet-access";
import { NextRequest } from "next/server";
import { expect, it, beforeEach, afterEach, vi } from "vitest";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { createPvpHandlers } from "../../src/server/pvp/http";

it("ends the series as no contest on confirmed transfer, never letting the old owner play", async () => {
  const ctx = await officialCombatFixture();
  const signed = await ctx.login();
  const peer = await walletAccessFixture(qualifyingHoldings, ctx);
  const pvp = createPvpHandlers(
    ctx.store,
    origin,
    ctx.auth,
    ctx.verifier,
    qualifyingHoldings,
  );
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
  const get = (path: string, official = true) =>
    pvp.get(
      new NextRequest(`${origin}/api/pvp${path}`, {
        headers: {
          ...(official ? signed.headers : peer.headers),
          cookie: official ? signed.cookie : friend,
        },
      }),
    );
  const friend = peer.cookie;
  try {
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
          characterId: "aegis",
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
    expect(
      (await post({ operation: "ready", invite, ready: true })).status,
    ).toBe(200);
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
    // The holder locks a hidden first-round move, then sells the token.
    expect(
      (
        await post({
          operation: "move",
          invite,
          round: 1,
          move: "basic",
        })
      ).status,
    ).toBe(200);
    ctx.transferAway();
    // The guest's reply triggers verification and voids the series instead
    // of recording the interrupted battle. The locked move never surfaces.
    const voided = await post(
      { operation: "move", invite, round: 1, move: "basic", mode: "guest" },
      false,
    );
    expect(voided.status).toBe(200);
    const view = await voided.json();
    expect(view.series.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(view.series.outcome.explanation).toContain("no contest");
    expect(view.history).toEqual([]);
    expect(view.battle).toBeNull();
    expect(view.result).toBeNull();
    // The old owner is done: every further official action fails closed.
    expect(
      (await post({ operation: "move", invite, round: 1, move: "basic" }))
        .status,
    ).toBe(403);
    expect((await post({ operation: "setup", invite })).status).toBe(403);
    // The guest cannot continue the voided series either.
    expect(
      (
        await post(
          { operation: "move", invite, round: 1, move: "basic", mode: "guest" },
          false,
        )
      ).status,
    ).toBe(409);
    // A valid JWT for another Privy subject still cannot act at all.
    const secret = signed.cookie.match(/chog_wallet=([a-f0-9]{64})/)![1];
    const session = ctx.auth.session(secret);
    const other = await ctx.proof(session.wallet, "did:privy:someone-else");
    expect(
      (
        await pvp.get(
          new NextRequest(`${origin}/api/pvp?invite=${invite}`, {
            headers: { ...other, cookie: signed.cookie },
          }),
        )
      ).status,
    ).toBe(401);
    // The new owner inherits no open series but can open a new room: the
    // void released the token lock.
    const outsider = await ctx.login(ctx.outsider);
    const reopened = await pvp.post(
      new NextRequest(`${origin}/api/pvp`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...outsider.headers,
          cookie: outsider.cookie,
        },
        body: JSON.stringify({ operation: "create", mode: "official" }),
      }),
    );
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).invite).not.toBe(invite);
    // Reads that need current authority fail closed after the transfer.
    const profile = await ctx.identity.get(
      new NextRequest(`${origin}/api/identity`, {
        headers: { ...signed.headers, cookie: signed.cookie },
      }),
    );
    expect(profile.status).toBe(403);
    expect((await get(`?invite=${invite}`)).status).toBe(403);
    ctx.auth.logout(secret);
    expect((await get(`?invite=${invite}`)).status).toBe(401);
  } finally {
    ctx.store.close();
  }
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
