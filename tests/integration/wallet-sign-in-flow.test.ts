import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hexToString } from "viem";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { createAccessHandlers } from "../../src/server/access/http";
import {
  signInToWallet,
  readWalletSession,
} from "../../src/components/auth/walletSignIn";
import type { WalletAdapter } from "../../src/components/auth/WalletAdapter";
import { qualifyingHoldings } from "../fixtures/wallet-access";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Labelled synthetic Privy JWTs and a disposable EOA, with actual HTTP handlers,
 * nonce consumption, ECDSA verification, cookies and SQLite session readback. */
async function flow(
  options: {
    lost?: "body" | "cookie";
    invalid?: boolean;
    expire?: boolean;
    reject?: boolean;
  } = {},
) {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "disabled");
  const ctx = await officialCombatFixture(),
    account = privateKeyToAccount(generatePrivateKey());
  const proof = {
    ...(await ctx.proof(account.address)),
    "x-soryn-wallet": account.address.toLowerCase(),
  };
  const reader = {
    token: vi.fn(qualifyingHoldings.token),
    nft: vi.fn(qualifyingHoldings.nft),
  };
  const api = createAccessHandlers(
    ctx.store,
    origin,
    ctx.auth,
    ctx.verifier,
    reader,
  );
  const jar = new Map<string, string>(),
    events: string[] = [],
    setCookies: string[] = [];
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null;
    events.push(
      data?.operation ??
        (path.includes("records=1") ? "session" : "eligibility"),
    );
    const req = new NextRequest(origin + path, {
      ...init,
      signal: init?.signal ?? undefined,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers)),
        origin,
        cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
      },
    });
    const reply = await (data ? api.post(req) : api.get(req));
    if (options.lost === "cookie" && data?.operation === "verify" && reply.ok)
      throw new TypeError("Synthetic lost cookie and response");
    const cookie = reply.headers.get("set-cookie");
    if (cookie) {
      setCookies.push(cookie);
      const part = cookie.split(";")[0],
        at = part.indexOf("=");
      jar.set(part.slice(0, at), part.slice(at + 1));
    }
    if (options.lost === "body" && data?.operation === "verify" && reply.ok)
      throw new TypeError("Synthetic lost response body");
    return reply;
  });
  vi.stubGlobal("fetch", fetcher);
  const provider = vi.fn(
    async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_chainId") return "0x8f";
      if (method === "eth_accounts") return [account.address];
      expect(method).toBe("personal_sign");
      if (options.reject)
        throw Object.assign(new Error("Signature rejected by fixture user"), {
          code: 4001,
        });
      if (options.expire) vi.setSystemTime(Date.now() + 300_001);
      return options.invalid
        ? "0x1234"
        : account.signMessage({
            message: hexToString(params![0] as `0x${string}`),
          });
    },
  );
  const wallet: WalletAdapter = {
    ready: true,
    authenticated: true,
    address: account.address.toLowerCase(),
    wallets: [],
    selectWallet: () => {},
    login: () => {},
    logout: async () => {},
    headers: async () => proof,
    provider: async () => ({ request: provider }),
  };
  return {
    ctx,
    wallet,
    reader,
    events,
    setCookies,
    provider,
    fetcher,
    api,
    proof,
    jar,
    run: () => signInToWallet(wallet, () => {}, new AbortController().signal),
  };
}
it("real fixture signature establishes a Secure canonical session while admissions remain paused; refresh and retry need no second signature", async () => {
  const f = await flow();
  try {
    const result = await f.run();
    expect(result.session.authenticated).toBe(true);
    expect(f.events).toEqual(["session", "challenge", "verify", "session"]);
    expect(await readWalletSession(f.proof)).toMatchObject({
      authenticated: true,
    });
    const view = await f.api.get(
      new NextRequest(origin + "/api/access", {
        headers: {
          ...f.proof,
          cookie: [...f.jar].map(([k, v]) => k + "=" + v).join("; "),
        },
      }),
    );
    expect(await view.json()).toMatchObject({
      authenticated: true,
      status: "paused",
    });
    await f.run();
    expect(
      f.provider.mock.calls.filter(([r]) => r.method === "personal_sign"),
    ).toHaveLength(1);
    expect(f.reader.token).not.toHaveBeenCalled();
    expect(f.reader.nft).not.toHaveBeenCalled();
    for (const cookie of f.setCookies) {
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=strict/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Domain=/);
    }
    const verifyRequest = f.fetcher.mock.calls.find(([, init]) =>
      String(init?.body).includes('"verify"'),
    );
    const signed = JSON.parse(String(verifyRequest?.[1]?.body));
    expect(signed.message).toContain(new URL(origin).host);
    expect(signed.message).toContain("URI: " + origin);
    expect(signed.message).toContain("Chain ID: 143");
  } finally {
    f.ctx.store.close();
  }
});
it("a lost successful response body recovers the cookie-backed session without replay or another signature", async () => {
  const f = await flow({ lost: "body" });
  try {
    expect((await f.run()).session.authenticated).toBe(true);
    expect(f.events).toEqual(["session", "challenge", "verify", "session"]);
  } finally {
    f.ctx.store.close();
  }
});
it("a lost Set-Cookie cannot be recovered as authenticated solely from provider state; no automatic retry", async () => {
  const f = await flow({ lost: "cookie" });
  try {
    await expect(f.run()).rejects.toThrow("lost cookie");
    expect(f.events).toEqual(["session", "challenge", "verify", "session"]);
    expect(await readWalletSession(f.proof)).toMatchObject({
      authenticated: false,
    });
  } finally {
    f.ctx.store.close();
  }
});
it.each([{ invalid: true }, { reject: true }, { expire: true }])(
  "rejected, invalid or expired fixture signatures never establish a session: %j",
  async (options) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const f = await flow(options);
    try {
      await expect(f.run()).rejects.toThrow();
      expect(
        f.ctx.store.db
          .prepare("select count(*) n from wallet_access_sessions")
          .get()?.n,
      ).toBe(0);
      if (options.reject) expect(f.events).not.toContain("verify");
    } finally {
      f.ctx.store.close();
    }
  },
);
it("canonical origin validation rejects www and unrelated origin POSTs before consuming a challenge", async () => {
  const f = await flow();
  try {
    for (const other of [
      "https://www.chog.example",
      "https://unrelated.example",
    ]) {
      const reply = await f.api.post(
        new NextRequest(origin + "/api/access", {
          method: "POST",
          headers: {
            ...f.proof,
            origin: other,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            operation: "challenge",
            wallet: f.wallet.address,
          }),
        }),
      );
      expect(reply.status).toBe(403);
      expect(reply.headers.get("set-cookie")).toBeNull();
    }
    expect(
      f.ctx.store.db
        .prepare("select count(*) n from wallet_access_challenges")
        .get()?.n,
    ).toBe(0);
  } finally {
    f.ctx.store.close();
  }
});
it("per-identity challenge limits return Retry-After, recover at the boundary, and do not share a global or forwarded-IP bucket", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const f = await flow();
  try {
    const post = (proof: Record<string, string>) =>
      f.api.post(
        new NextRequest(origin + "/api/access", {
          method: "POST",
          headers: {
            ...proof,
            origin,
            "content-type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body: JSON.stringify({
            operation: "challenge",
            wallet: f.wallet.address,
          }),
        }),
      );
    for (let i = 0; i < 60; i++) expect((await post(f.proof)).status).toBe(200);
    const limited = await post(f.proof);
    expect(limited.status).toBe(429);
    const seconds = Number(limited.headers.get("Retry-After"));
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
    const other = await f.ctx.proof(
      f.wallet.address,
      "did:privy:independent-fixture",
    );
    expect((await post(other)).status).toBe(200);
    vi.setSystemTime(Date.now() + seconds * 1000);
    expect((await post(f.proof)).status).toBe(200);
  } finally {
    f.ctx.store.close();
  }
});
