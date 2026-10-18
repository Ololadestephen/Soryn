import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { identityFor, tokenKey } from "../../src/domain/identity";
import { TokenRecords } from "../../src/server/records/tokenRecords";
import { createRecordHandlers } from "../../src/server/records/http";
import { officialCombatFixture, origin } from "../fixtures/official-combat";

const token = identityFor("276");
describe("private results and public consent boundary", () => {
  it("requires consent, origin and fresh participating authority; legacy rows never publish", async () => {
    const ctx = await officialCombatFixture();
    try {
      const signed = await ctx.login();
      const authority = (
        await ctx.auth.authorize(signed.cookie.match(/chog_wallet=([^;]+)/)![1])
      ).authority;
      const rows = new TokenRecords(ctx.store);
      const data = {
        token: tokenKey(token),
        kind: "battle" as const,
        source: "fixture-completed",
        headline: "Victory",
        explanation: "Private opponent and account details",
        fighter: "Pip",
        opponent: "Private opponent",
        opponentFighter: "Bolt",
        arena: "sanctuary",
        rounds: 5,
        score: null,
        route: null,
        owner: authority.ownership.owner,
        generation: authority.generation,
        recordedAt: Date.now(),
      };
      rows.write({
        ...data,
        rules: "soryn-fixture-rules/1",
        eligibleForPublication: true,
      });
      rows.write({ ...data, source: "legacy-private" });
      const records = rows.list(token);
      const current = records.find((r) => r.source === data.source)!;
      const legacy = records.find((r) => r.source === "legacy-private")!;
      const handlers = createRecordHandlers(
        ctx.store,
        origin,
        ctx.auth,
        ctx.verifier,
      );
      const publish = (extra: Record<string, unknown> = {}, from = origin) =>
        handlers.post(
          new NextRequest(`${origin}/api/competitor`, {
            method: "POST",
            headers: {
              origin: from,
              "content-type": "application/json",
              cookie: signed.cookie,
              ...signed.headers,
            },
            body: JSON.stringify({
              operation: "publish",
              id: current.id,
              alias: "Fixture keeper",
              consent: true,
              ...extra,
            }),
          }),
        );
      expect(rows.published(token)).toEqual([]);
      expect((await publish({ consent: false })).status).toBe(400);
      expect((await publish({}, "https://wrong.example")).status).toBe(403);
      expect((await publish({ id: legacy.id })).status).toBe(403);
      ctx.outage();
      expect((await publish()).status).toBe(503);
      ctx.recover();
      expect((await publish()).status).toBe(200);
      expect((await publish()).status).toBe(200);
      const output = JSON.stringify(rows.published(token));
      for (const value of [
        authority.generation,
        authority.ownership.owner,
        "Private opponent",
        data.explanation,
        data.source,
      ])
        expect(output).not.toContain(value);
      expect(rows.published(token)).toHaveLength(1);
      ctx.awayBack();
      expect((await publish()).status).toBe(403);
      const renewed = await ctx.login();
      const fresh = (
        await ctx.auth.authorize(
          renewed.cookie.match(/chog_wallet=([^;]+)/)![1],
        )
      ).authority;
      expect(() =>
        rows.publish(current.id, fresh, "Fixture keeper", Date.now()),
      ).toThrow(/participating keeper/);
      rows.withdraw(current.id, authority.ownership.owner);
      rows.withdraw(current.id, authority.ownership.owner);
      expect(rows.published(token)).toEqual([]);
    } finally {
      ctx.store.close();
    }
  });
  it("validates exact chain/collection/token before RPC and limits public scraping", async () => {
    const ctx = await officialCombatFixture();
    try {
      const handlers = createRecordHandlers(
        ctx.store,
        origin,
        ctx.auth,
        ctx.verifier,
      );
      for (const [id, query] of [
        ["0276", ""],
        ["276", "?chainId=1"],
        ["276", "?collection=0x1111111111111111111111111111111111111111"],
        ["276", "?chainId=143&chainId=1"],
      ]) {
        const result = await handlers.profile(
          new NextRequest(`${origin}/api/chog/${id}${query}`),
          id,
        );
        expect(result.status).toBe(400);
      }
      expect(
        ctx.store.db.prepare("SELECT COUNT(*) AS n FROM token_ownership").get()
          ?.n,
      ).toBe(0);
      ctx.outage();
      const offline = await handlers.profile(
        new NextRequest(`${origin}/api/chog/276`),
        "276",
      );
      expect((await offline.json()).ownership).toEqual({
        status: "unavailable",
        owner: null,
        checkedAt: null,
      });
      for (let n = 1; n < 30; n++)
        ctx.store.rateLimit("public:token-profile", Date.now(), 30);
      expect(
        (
          await handlers.profile(
            new NextRequest(`${origin}/api/chog/276`),
            "276",
          )
        ).status,
      ).toBe(429);
    } finally {
      ctx.store.close();
    }
  });
});
