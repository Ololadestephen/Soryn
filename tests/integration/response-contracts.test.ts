import {
  walletAccessFixture,
  qualifyingHoldings,
} from "../fixtures/wallet-access";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { expect, it, beforeEach, afterEach, vi } from "vitest";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { createStoryHandlers } from "../../src/server/story/http";
import { createMatchHandlers } from "../../src/server/match/http";
import { createPvpHandlers } from "../../src/server/pvp/http";
import {
  pvpRoomResponseSchema,
  pvpSessionSchema,
  queueViewSchema,
} from "../../src/domain/pvp/responses";
import { storyStateSchema } from "../../src/domain/story/responses";
import {
  competitorViewSchema,
  playMenuSchema,
} from "../../src/domain/responses";
import { createRecordHandlers } from "../../src/server/records/http";
import {
  guestSessionSchema,
  officialSessionSchema,
} from "../../src/domain/adventure/responses";
import { RunService } from "../../src/server/adventure/runs";
import { GuestJournal } from "../../src/server/adventure/journal";
it("shared parsers accept actual service/HTTP responses and reject swapped or malformed variants", async () => {
  const ctx = await officialCombatFixture();
  try {
    const req = () => new NextRequest(`${origin}/api/story`);
    const story = await (
      await createStoryHandlers(ctx.store, origin).get(req())
    ).json();
    expect(storyStateSchema.parse(story).step).toBe("meet");
    expect(
      storyStateSchema.safeParse({ ...story, step: "unknown" }).success,
    ).toBe(false);
    const match = await (
      await createMatchHandlers(ctx.store, origin).get(req())
    ).json();
    expect(queueViewSchema.parse(match).status).toBe("idle");
    const peer = await walletAccessFixture(qualifyingHoldings, ctx);
    const pvp = createPvpHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
      qualifyingHoldings,
    );
    const session = await (
      await pvp.get(new NextRequest(`${origin}/api/pvp?mode=guest`))
    ).json();
    expect(pvpSessionSchema.parse(session).activeInvite).toBeNull();
    expect(pvpRoomResponseSchema.safeParse(session).success).toBe(false);
    const room = await (
      await pvp.post(
        new NextRequest(`${origin}/api/pvp`, {
          method: "POST",
          headers: {
            origin,
            "Content-Type": "application/json",
            cookie: peer.cookie,
            ...peer.headers,
          },
          body: JSON.stringify({ operation: "create", mode: "guest" }),
        }),
      )
    ).json();
    expect(pvpRoomResponseSchema.parse(room).seated).toBe(true);
    expect(pvpSessionSchema.safeParse(room).success).toBe(false);
    const owner = await ctx.login();
    const competitor = await (
      await createRecordHandlers(ctx.store, origin, ctx.auth, ctx.verifier).get(
        new NextRequest(`${origin}/api/competitor`, {
          headers: { cookie: owner.cookie, ...owner.headers },
        }),
      )
    ).json();
    expect(competitorViewSchema.parse(competitor).identity.tokenId).toBe("276");
    expect(
      competitorViewSchema.safeParse({
        ...competitor,
        entries: [{ canPublish: "true" }],
      }).success,
    ).toBe(false);
    const actor = randomUUID(),
      runs = new RunService(ctx.store),
      journal = new GuestJournal(ctx.store, runs);
    runs.start(actor, randomUUID(), null, null);
    expect(
      guestSessionSchema.parse({
        ...runs.session(actor),
        journal: journal.read(actor),
      }).run?.step,
    ).toBe(0);
    expect(
      officialSessionSchema.safeParse({
        ...runs.session(actor),
        journal: journal.read(actor),
      }).success,
    ).toBe(false);
    expect(
      playMenuSchema.parse({
        story: "begin",
        matchInvite: null,
        practice: false,
      }).story,
    ).toBe("begin");
    expect(
      playMenuSchema.safeParse({
        story: "invented",
        matchInvite: 3,
        practice: "yes",
      }).success,
    ).toBe(false);
  } finally {
    ctx.store.close();
  }
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
