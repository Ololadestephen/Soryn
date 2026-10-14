import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { IdentityStore } from "../../src/server/auth/persistence";
import { AuthService } from "../../src/server/auth/service";
import { createIdentityHandlers } from "../../src/server/identityHttp";
import { identityFor } from "../../src/domain/identity";
import { ServiceError } from "../../src/server/errors";

const origin = "https://chog.example";
const owner = privateKeyToAccount(generatePrivateKey());
const outsider = privateKeyToAccount(generatePrivateKey());
const stores: Store[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.close()));
async function setup() {
  const store = new Store(":memory:");
  stores.push(store);
  const records = new IdentityStore(store);
  let height = 100;
  let available = true;
  const chain = {
    isContract: async () => false,
    observe: async () => {
      if (!available) throw new ServiceError(503, "RPC unavailable.");
      height++;
      return {
        owner: owner.address.toLowerCase(),
        changed: false,
        pendingTransfer: false,
        checkedAt: Date.now(),
        block: {
          number: `0x${height.toString(16)}`,
          hash: `0x${height.toString(16).padStart(64, "0")}`,
          timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
        },
      };
    },
  };
  const handlers = createIdentityHandlers(
    records,
    new AuthService(records, chain, origin),
    origin,
    {
      verify: async () => ({
        userId: "did:privy:test-http",
        sessionId: "fixture-session",
        wallets: [owner.address.toLowerCase(), outsider.address.toLowerCase()],
      }),
    },
  );
  const browser = (
    await handlers.get(new NextRequest(`${origin}/api/identity`))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const post = (
    input: unknown,
    cookie = browser,
    headers: Record<string, string> = {},
  ) =>
    handlers.post(
      new NextRequest(`${origin}/api/identity`, {
        method: "POST",
        headers: {
          origin,
          cookie,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(input),
      }),
    );
  async function login(account = owner) {
    const response = await post({
      operation: "challenge",
      wallet: account.address,
      identity: identityFor("276"),
    });
    expect(response.status).toBe(200);
    const challenge = await response.json();
    const verified = await post({
      operation: "verify",
      nonce: challenge.nonce,
      message: challenge.message,
      signature: await account.signMessage({ message: challenge.message }),
    });
    expect(verified.status).toBe(200);
    const cookie = verified.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=strict");
    return `${browser}; ${cookie.split(";")[0]}`;
  }
  return {
    store,
    records,
    handlers,
    browser,
    post,
    login,
    failRpc: () => {
      available = false;
    },
  };
}

describe("identity API boundaries", () => {
  it("requires browser, same origin, bounded JSON and exact token scope; guest cannot author", async () => {
    const ctx = await setup();
    const challenge = {
      operation: "challenge",
      wallet: owner.address,
      identity: identityFor("276"),
    };
    expect((await ctx.post(challenge, "")).status).toBe(401);
    expect(
      (
        await ctx.post(challenge, ctx.browser, {
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await ctx.post(challenge, ctx.browser, { "Content-Type": "text/plain" }))
        .status,
    ).toBe(415);
    for (const identity of [
      { ...identityFor("276"), chainId: 1 },
      { ...identityFor("276"), collection: outsider.address },
      { ...identityFor("276"), tokenId: "CHOG #1737" },
    ])
      expect((await ctx.post({ ...challenge, identity })).status).toBe(400);
    expect(
      (await ctx.post({ ...challenge, owner: true, score: 100 })).status,
    ).toBe(400);
    expect((await ctx.post({ padding: "a".repeat(5000) })).status).toBe(413);
    expect(
      (
        await ctx.post(
          { operation: "start", id: randomUUID(), retryOf: null },
          `${ctx.browser}; chog_guest=${randomUUID()}`,
        )
      ).status,
    ).toBe(401);
  });
  it("executes signature-to-chapter flow, duplicate retries and private/public isolation", async () => {
    const ctx = await setup();
    const cookie = await ctx.login();
    const id = randomUUID();
    const start = { operation: "start", id, retryOf: null };
    expect((await ctx.post(start, cookie)).status).toBe(200);
    const duplicate = await ctx.post(start, cookie);
    expect((await duplicate.json()).run.mode).toBe("official");
    const input = { operation: "step", id, step: 0, action: "door" };
    const parallel = await Promise.all([
      ctx.post(input, cookie),
      ctx.post(input, cookie),
    ]);
    expect(parallel.some((response) => response.status === 200)).toBe(true);
    const retry = await ctx.post(input, cookie);
    expect(retry.status).toBe(200);
    expect((await retry.json()).run.step).toBe(1);
    const publish = {
      operation: "publish",
      id,
      title: "Door",
      alias: "Keeper",
      consent: true,
      museum: true,
    };
    expect(
      (await ctx.post({ ...publish, consent: false }, cookie)).status,
    ).toBe(400);
    const response = await ctx.post(publish, cookie);
    expect(response.status).toBe(200);
    const privateView = await response.json();
    const publicView = await (
      await ctx.handlers.get(
        new NextRequest(`${origin}/api/identity?tokenId=276`),
      )
    ).json();
    expect(publicView.chapters).toEqual(privateView.chapters);
    for (const secret of [
      owner.address.toLowerCase(),
      id,
      "runId",
      "withdrawals",
      "trainingIds",
      "actor",
      "secret",
    ])
      expect(JSON.stringify(publicView)).not.toContain(secret);
    expect(privateView.withdrawals[0].runId).toBe(id);
    expect((await ctx.post({ operation: "withdraw", id }, cookie)).status).toBe(
      200,
    );
    expect(ctx.records.chapters(identityFor("276"))).toEqual([]);
    const logout = await ctx.post({ operation: "logout" }, cookie);
    expect(logout.status).toBe(200);
    expect((await ctx.post(start, cookie)).status).toBe(401);
  });
  it("rejects non-owner writes and RPC failures through the actual HTTP handler", async () => {
    const ctx = await setup();
    const outsiderCookie = await ctx.login(outsider);
    expect(
      (
        await ctx.post(
          { operation: "start", id: randomUUID(), retryOf: null },
          outsiderCookie,
        )
      ).status,
    ).toBe(403);
    const cookie = await ctx.login();
    ctx.failRpc();
    expect(
      (
        await ctx.post(
          { operation: "start", id: randomUUID(), retryOf: null },
          cookie,
        )
      ).status,
    ).toBe(503);
    expect(ctx.store.museum()).toEqual([]);
  });
  it("fails closed on corrupted stored permissions and preserves legacy guest records", async () => {
    const ctx = await setup();
    const cookie = await ctx.login();
    ctx.store.db.exec("UPDATE wallet_sessions SET record='invalid-json'");
    expect(
      (
        await ctx.post(
          { operation: "start", id: randomUUID(), retryOf: null },
          cookie,
        )
      ).status,
    ).toBe(503);
    const guest = randomUUID();
    const { RunService } = await import("../../src/server/runs");
    const service = new RunService(ctx.store);
    const run = service.start(guest, randomUUID(), null);
    const row = ctx.store.db
      .prepare("SELECT record FROM runs WHERE id=?")
      .get(run.id);
    const legacy = JSON.parse(String(row?.record));
    delete legacy.authority;
    ctx.store.db
      .prepare("UPDATE runs SET record=? WHERE id=?")
      .run(JSON.stringify(legacy), run.id);
    expect(service.session(guest).run?.mode).toBe("guest");
    const failure = service.step(guest, run.id, 0, "door");
    expect(failure.observation.outcome).toBe("trapped");
  });
  it("marks prior guest and inherited chapter exposure as informed retries", async () => {
    const ctx = await setup();
    const guest = randomUUID();
    const { RunService } = await import("../../src/server/runs");
    new RunService(ctx.store).start(guest, randomUUID(), null);
    const initial = await ctx.post(
      {
        operation: "challenge",
        wallet: owner.address,
        identity: identityFor("276"),
      },
      `${ctx.browser}; chog_guest=${guest}`,
    );
    const challenge = await initial.json();
    const signed = await ctx.post(
      {
        operation: "verify",
        nonce: challenge.nonce,
        message: challenge.message,
        signature: await owner.signMessage({ message: challenge.message }),
      },
      `${ctx.browser}; chog_guest=${guest}`,
    );
    const cookie = `${ctx.browser}; ${signed.headers.get("set-cookie")!.split(";")[0]}`;
    const started = await ctx.post(
      { operation: "start", id: randomUUID(), retryOf: null },
      cookie,
    );
    expect((await started.json()).run.cohort).toBe("informed-retry");
  });
});
