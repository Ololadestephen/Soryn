import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  walletAccessFixture,
  qualifyingHoldings,
} from "../fixtures/wallet-access";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { createAccessHandlers } from "../../src/server/access/http";
import { AuthService } from "../../src/server/auth/service";
import { IdentityStore } from "../../src/server/auth/persistence";
import { Store } from "../../src/server/persistence";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function req(
  f: Awaited<ReturnType<typeof walletAccessFixture>>,
  operation?: string,
) {
  return new NextRequest(`${origin}/api/access`, {
    method: operation ? "POST" : "GET",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: f.cookie,
      ...f.headers,
    },
    ...(operation ? { body: JSON.stringify({ operation }) } : {}),
  });
}
it("reports a paused rollout before sign-in without querying holdings, while keeping records readable", async () => {
  const reader = {
    token: vi.fn(qualifyingHoldings.token),
    nft: vi.fn(qualifyingHoldings.nft),
  };
  const f = await walletAccessFixture(reader);
  try {
    vi.stubEnv("SORYN_HOLDER_ACCESS", "disabled");
    const anonymous = await f.handlers.get(
      new NextRequest(`${origin}/api/access`),
    );
    expect(await anonymous.json()).toMatchObject({
      status: "paused",
      authenticated: false,
    });
    expect((await f.handlers.get(req(f))).status).toBe(200);
    const recordRequest = new NextRequest(`${origin}/api/access?records=1`, {
      headers: { cookie: f.cookie, ...f.headers },
    });
    expect(await (await f.handlers.get(recordRequest)).json()).toMatchObject({
      authenticated: true,
      message: "Private wallet records",
    });
    expect(reader.token).not.toHaveBeenCalled();
    expect(reader.nft).not.toHaveBeenCalled();
    vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
    expect(
      await (
        await f.handlers.get(new NextRequest(`${origin}/api/access`))
      ).json(),
    ).toMatchObject({ status: "signed-out", authenticated: false });
  } finally {
    f.ctx.store.close();
  }
});
it("revokes wallet-play sign-in before reconnect; replayed and expired challenges remain unusable", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  const f = await walletAccessFixture(qualifyingHoldings);
  try {
    const wrongOrigin = new NextRequest(`${origin}/api/access`, {
      method: "POST",
      headers: {
        origin: "https://unrelated.example",
        "content-type": "application/json",
        cookie: f.cookie,
      },
      body: JSON.stringify({ operation: "logout" }),
    });
    expect((await f.handlers.post(wrongOrigin)).status).toBe(403);
    expect(await (await f.handlers.get(req(f))).json()).toMatchObject({
      authenticated: true,
    });
    const logout = () =>
      new NextRequest(`${origin}/api/access`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          cookie: f.cookie,
        },
        body: JSON.stringify({ operation: "logout" }),
      });
    const response = await f.handlers.post(logout());
    expect((await f.handlers.post(logout())).status).toBe(200);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signedOut: true });
    expect(response.headers.get("set-cookie")).toMatch(
      /chog_wallet=;.*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/,
    );
    expect(await (await f.handlers.get(req(f))).json()).toMatchObject({
      status: "signed-out",
    });
    expect((await f.post(f.verification, f.browser)).status).toBe(401);
    const challengeReply = await f.post(
      { operation: "challenge", wallet: f.account.address },
      f.browser,
    );
    expect(challengeReply.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(challengeReply.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(challengeReply.headers.get("set-cookie")).toMatch(
      /SameSite=strict/i,
    );
    const challenge = await challengeReply.json(),
      signature = await f.account.signMessage({ message: challenge.message });
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    expect(
      (
        await f.post(
          { operation: "verify", ...challenge, signature },
          f.browser,
        )
      ).status,
    ).toBe(401);
    // A fresh nonce and signature can reconnect the same wallet; no old nonce is revived.
    const nextReply = await f.post(
      { operation: "challenge", wallet: f.account.address },
      f.browser,
    );
    const next = await nextReply.json(),
      nextSignature = await f.account.signMessage({ message: next.message });
    expect(
      (
        await f.post(
          { operation: "verify", ...next, signature: nextSignature },
          f.browser,
        )
      ).status,
    ).toBe(200);
  } finally {
    f.ctx.store.close();
  }
});
it("persists authenticated wallet identity and grants through a real SQLite close/reopen", async () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  const dir = mkdtempSync(join(tmpdir(), "soryn-access-restart-")),
    file = join(dir, "isolated.sqlite");
  const first = new Store(file),
    ctx = await officialCombatFixture(first),
    f = await walletAccessFixture(qualifyingHoldings, ctx);
  let reopened: Store | undefined;
  try {
    const before = await (await f.handlers.get(req(f))).json();
    expect(before.status).toBe("token");
    const actor = first.db
      .prepare("SELECT actor FROM wallet_accounts")
      .get()?.actor;
    first.close();
    reopened = new Store(file);
    const auth = new AuthService(
      new IdentityStore(reopened),
      {
        isContract: async () => false,
        observe: async () => {
          throw Error(
            "Wallet-play restart must not invent an NFT ownership read",
          );
        },
      },
      origin,
    );
    const api = createAccessHandlers(
      reopened,
      origin,
      auth,
      ctx.verifier,
      qualifyingHoldings,
    );
    expect(await (await api.get(req(f))).json()).toMatchObject({
      authenticated: true,
      status: "token",
      fighters: before.fighters,
    });
    expect(
      reopened.db.prepare("SELECT actor FROM wallet_accounts").get()?.actor,
    ).toBe(actor);
    expect(
      reopened.db.prepare("SELECT COUNT(*) n FROM access_grants").get()?.n,
    ).toBe(1);
    expect((await api.post(req(f, "logout"))).status).toBe(200);
    expect(await (await api.get(req(f))).json()).toMatchObject({
      status: "signed-out",
    });
  } finally {
    if (reopened) reopened.close();
    else first.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
