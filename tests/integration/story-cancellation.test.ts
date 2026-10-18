import { prepareStoryHttp } from "../fixtures/story-journey";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { createStoryHandlers } from "../../src/server/story/http";
import { TokenLocks } from "../../src/server/pvp/locks";
import { TokenRecords } from "../../src/server/records/tokenRecords";
import { identityFor, tokenKey } from "../../src/domain/identity";

describe("official Story cancellation", () => {
  it("cancels once without reward, frees its token and starts a new encounter", async () => {
    const ctx = await officialCombatFixture();
    try {
      const signed = await ctx.login();
      const story = createStoryHandlers(
        ctx.store,
        origin,
        ctx.auth,
        ctx.verifier,
      );
      const call = (operation: string, extra: Record<string, unknown> = {}) =>
        story.post(
          new NextRequest(`${origin}/api/story`, {
            method: "POST",
            headers: {
              origin,
              cookie: signed.cookie,
              "content-type": "application/json",
              ...signed.headers,
            },
            body: JSON.stringify({ operation, mode: "official", ...extra }),
          }),
        );
      await call("choose", { fighter: "pip" });
      await prepareStoryHttp((input) => call(String(input.operation), input));
      const began = await (await call("begin")).json();
      const cancelled = await (await call("cancel")).json();
      expect(cancelled).toMatchObject({
        step: "scout",
        battleId: null,
        completed: false,
        interruption: "cancelled",
      });
      await call("cancel");
      expect(
        new TokenLocks(ctx.store).get(tokenKey(identityFor("276")), Date.now()),
      ).toBeNull();
      expect(new TokenRecords(ctx.store).list(identityFor("276"))).toHaveLength(
        1,
      );
      expect(new TokenRecords(ctx.store).published(identityFor("276"))).toEqual(
        [],
      );
      const retry = await (await call("begin")).json();
      expect(retry.battleId).not.toBe(began.battleId);
      const stale = await (
        await call("resolve", { battleId: began.battleId })
      ).json();
      expect(stale).toMatchObject({
        battleId: retry.battleId,
        step: "scout",
        completed: false,
      });
      expect(
        new TokenLocks(ctx.store).get(tokenKey(identityFor("276")), Date.now())
          ?.encounter,
      ).toBe(retry.battleId);
      expect(new TokenRecords(ctx.store).list(identityFor("276"))).toHaveLength(
        1,
      );
    } finally {
      ctx.store.close();
    }
  });
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
