import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createStoryHandlers } from "../../src/server/story/http";
import { createMatchHandlers } from "../../src/server/match/http";
import {
  qualifyingHoldings,
  walletAccessFixture,
} from "../fixtures/wallet-access";
import { origin } from "../fixtures/official-combat";
import { prepareStoryHttp } from "../fixtures/story-journey";
import { WalletAccessAuth } from "../../src/server/access/auth";
const A = "11111111-1111-4111-8111-111111111111";
function request(
  path: string,
  input?: unknown,
  cookie = `chog_guest=${A}`,
  headers: Record<string, string> = {},
  from = origin,
) {
  return new NextRequest(`${origin}${path}`, {
    method: input ? "POST" : "GET",
    headers: {
      origin: from,
      "content-type": "application/json",
      cookie,
      ...headers,
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
}
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
describe("holder-first Story and shared queue boundaries", () => {
  it("rejects cross-origin, guest gameplay and invented progress; keeps wallet and browser checkpoints private", async () => {
    const f = await walletAccessFixture(qualifyingHoldings);
    const { store, auth, verifier } = f.ctx;
    const story = createStoryHandlers(
      store,
      origin,
      auth,
      verifier,
      qualifyingHoldings,
    );
    const post = (input: Record<string, unknown>) =>
      story.post(
        request("/api/story", { mode: "guest", ...input }, f.cookie, f.headers),
      );
    try {
      expect(
        (
          await story.post(
            request(
              "/api/story",
              { operation: "choose", fighter: "pip" },
              "",
              {},
              "https://foreign.example",
            ),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await story.post(
            request("/api/story", { operation: "choose", fighter: "pip" }, ""),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await story.post(
            request("/api/story", { operation: "choose", fighter: "pip" }),
          )
        ).status,
      ).toBe(403);
      expect(
        (await post({ operation: "choose", fighter: "pip", completed: true }))
          .status,
      ).toBe(400);
      expect(
        (await post({ operation: "choose", fighter: "ember" })).status,
      ).toBe(403);
      expect((await post({ operation: "choose", fighter: "pip" })).status).toBe(
        200,
      );
      await prepareStoryHttp(post);
      const begun = await (await post({ operation: "begin" })).json();
      expect(
        await (
          await post({ operation: "resolve", battleId: begun.battleId })
        ).json(),
      ).toMatchObject({
        step: "scout",
        battleId: begun.battleId,
        completed: false,
      });
      expect(
        await (await story.get(request("/api/story"))).json(),
      ).toMatchObject({ step: "meet", fighter: null, battleId: null });
      const player = await new WalletAccessAuth(
        store,
        auth,
        verifier,
        origin,
      ).player(request("/api/access", undefined, f.cookie, f.headers));
      expect(
        (
          await story.get(
            request("/api/story", undefined, `chog_guest=${player.actor}`),
          )
        ).status,
      ).toBe(401);
      expect(
        (await post({ operation: "route", route: "foundry" })).status,
      ).toBe(409);
      expect((await post({ operation: "replay" })).status).toBe(409);
    } finally {
      store.close();
    }
  });
  it("requires explicit authenticated admission, never joins on read, and never leaks private seat identities", async () => {
    const a = await walletAccessFixture(qualifyingHoldings),
      b = await walletAccessFixture(qualifyingHoldings, a.ctx);
    const { store, auth, verifier } = a.ctx;
    const match = createMatchHandlers(
      store,
      origin,
      auth,
      verifier,
      qualifyingHoldings,
    );
    const post = (f: typeof a, input: Record<string, unknown>) =>
      match.post(
        request("/api/match", { mode: "guest", ...input }, f.cookie, f.headers),
      );
    try {
      expect(
        (await match.post(request("/api/match", { operation: "accept" }, "")))
          .status,
      ).toBe(401);
      expect(
        (await match.post(request("/api/match", { operation: "join" }))).status,
      ).toBe(403);
      expect(
        (
          await match.post(
            request(
              "/api/match",
              { operation: "join" },
              "",
              {},
              "https://foreign.example",
            ),
          )
        ).status,
      ).toBe(403);
      expect(
        (await post(a, { operation: "join", actor: randomUUID() })).status,
      ).toBe(400);
      const read = await match.get(request("/api/match", undefined, ""));
      expect(await read.json()).toMatchObject({ status: "idle", invite: null });
      for (const flag of ["HttpOnly", "Secure", "SameSite=strict"])
        expect(read.headers.get("set-cookie")).toContain(flag);
      expect(
        store.db.prepare("SELECT count(*) n FROM pvp_queue").get()?.n,
      ).toBe(0);
      expect((await (await post(a, { operation: "join" })).json()).status).toBe(
        "waiting",
      );
      expect((await (await post(b, { operation: "join" })).json()).status).toBe(
        "offered",
      );
      expect(
        (await (await post(a, { operation: "accept" })).json()).invite,
      ).toBeNull();
      const sealed = await post(b, { operation: "accept" });
      expect(sealed.status).toBe(200);
      const raw = await sealed.text();
      expect(JSON.parse(raw).status).toBe("matched");
      for (const f of [a, b]) {
        const player = await new WalletAccessAuth(
          store,
          auth,
          verifier,
          origin,
        ).player(request("/api/access", undefined, f.cookie, f.headers));
        expect(raw).not.toContain(player.actor);
        expect(raw).not.toContain(f.account.address.toLowerCase());
      }
    } finally {
      store.close();
    }
  });
});
