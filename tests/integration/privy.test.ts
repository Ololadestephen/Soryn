import { generateKeyPair, exportSPKI, exportJWK, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PrivyTokenVerifier,
  requireLinkedWallet,
} from "../../src/server/auth/privy";
import { Store } from "../../src/server/persistence";
import { IdentityStore } from "../../src/server/auth/persistence";
import { AuthService } from "../../src/server/auth/service";
import { createIdentityHandlers } from "../../src/server/identityHttp";
import { identityFor } from "../../src/domain/identity";

const appId = "local-privy-verifier-test";
const now = Date.now();
const seconds = Math.floor(now / 1000);
const owner = privateKeyToAccount(generatePrivateKey());
const wallet = owner.address.toLowerCase();
const pair = await generateKeyPair("ES256", { extractable: true });
const pem = await exportSPKI(pair.publicKey);
afterEach(() => vi.unstubAllGlobals());
const verifier = new PrivyTokenVerifier(appId, pem, () => now);
async function token(
  extra: Record<string, unknown>,
  options: {
    key?: CryptoKey;
    issuer?: string;
    audience?: string;
    subject?: string;
    issued?: number;
    expires?: number;
  } = {},
) {
  return new SignJWT(extra)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(options.issuer ?? "privy.io")
    .setAudience(options.audience ?? appId)
    .setSubject(options.subject ?? "did:privy:test-user")
    .setIssuedAt(options.issued ?? seconds)
    .setExpirationTime(options.expires ?? seconds + 3600)
    .sign(options.key ?? pair.privateKey);
}
async function proof(
  options: Parameters<typeof token>[1] = {},
  accounts: unknown = [
    { type: "wallet", chain_type: "ethereum", address: owner.address },
    { type: "email", address: "test@example.invalid" },
  ],
) {
  return {
    access: await token({ sid: "test-session" }, options),
    identity: await token(
      { linked_accounts: JSON.stringify(accounts) },
      options,
    ),
  };
}

describe("Privy ES256 authentication boundary", () => {
  it("verifies matching signed tokens and extracts only linked Ethereum wallets", async () => {
    const signed = await proof();
    const identity = await verifier.verify(signed.access, signed.identity);
    expect(identity).toEqual({
      userId: "did:privy:test-user",
      sessionId: "test-session",
      wallets: [wallet],
    });
    expect(() => requireLinkedWallet(identity, owner.address)).not.toThrow();
    expect(() => requireLinkedWallet(identity, `0x${"2".repeat(40)}`)).toThrow(
      "not linked",
    );
    expect(JSON.stringify(identity)).not.toContain("test@example");
  });
  it("rejects wrong issuer/audience, expiry, future issue times and untrusted keys", async () => {
    const other = await generateKeyPair("ES256");
    for (const options of [
      { issuer: "evil.invalid" },
      { audience: "another-app" },
      { expires: seconds - 1 },
      { issued: seconds + 60 },
      { key: other.privateKey },
    ]) {
      const signed = await proof(options);
      await expect(
        verifier.verify(signed.access, signed.identity),
      ).rejects.toMatchObject({ status: 401 });
    }
  });
  it("rejects mismatched subjects, forged/oversized tokens and swapped token roles", async () => {
    const signed = await proof();
    const otherIdentity = await token(
      { linked_accounts: "[]" },
      { subject: "did:privy:another-user" },
    );
    for (const [access, identity] of [
      [signed.access, otherIdentity],
      [signed.access + "corrupted", signed.identity],
      [signed.identity, signed.access],
      ["a".repeat(25000), signed.identity],
      ["", signed.identity],
    ]) {
      await expect(verifier.verify(access, identity)).rejects.toMatchObject({
        status: 401,
      });
    }
  });
  it("requires claims and rejects algorithm substitution and malformed account data", async () => {
    const signed = await proof();
    const hmac = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .sign(new Uint8Array(32));
    const noExpiry = await new SignJWT({
      sub: "did:privy:test-user",
      sid: "test-session",
      iat: seconds,
      iss: "privy.io",
      aud: appId,
    })
      .setProtectedHeader({ alg: "ES256" })
      .sign(pair.privateKey);
    const badIdentity = await token({ linked_accounts: "not-json" });
    await expect(verifier.verify(hmac, signed.identity)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      verifier.verify(noExpiry, signed.identity),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      verifier.verify(signed.access, badIdentity),
    ).rejects.toMatchObject({ status: 401 });
    const solana = await proof({}, [
      { type: "wallet", chain_type: "solana", address: "different-chain" },
    ]);
    expect(
      (await verifier.verify(solana.access, solana.identity)).wallets,
    ).toEqual([]);
  });
  it("accepts escaped PEM line breaks without changing verification", async () => {
    const signed = await proof();
    const escaped = pem
      .split(String.fromCharCode(10))
      .join(String.fromCharCode(92) + "n");
    expect(
      (
        await new PrivyTokenVerifier(appId, escaped, () => now).verify(
          signed.access,
          signed.identity,
        )
      ).userId,
    ).toBe("did:privy:test-user");
  });
  it("uses the official key-set URL and verifies either rotating signing key", async () => {
    const second = await generateKeyPair("ES256", { extractable: true });
    const keys = [
      {
        ...(await exportJWK(pair.publicKey)),
        alg: "ES256",
        use: "sig",
        kid: "first",
      },
      {
        ...(await exportJWK(second.publicKey)),
        alg: "ES256",
        use: "sig",
        kid: "second",
      },
    ];
    const fetchKeys = vi.fn(async (url: unknown) => {
      expect(String(url)).toBe(
        `https://api.privy.io/v1/apps/${appId}/jwks.json`,
      );
      return Response.json({ keys });
    });
    vi.stubGlobal("fetch", fetchKeys);
    const remote = new PrivyTokenVerifier(appId, "", () => now, "jwks");
    const signed = async (
      key: CryptoKey,
      kid: string,
      payload: Record<string, unknown>,
    ) =>
      new SignJWT(payload)
        .setProtectedHeader({ alg: "ES256", kid })
        .setIssuer("privy.io")
        .setAudience(appId)
        .setSubject("did:privy:test-user")
        .setIssuedAt(seconds)
        .setExpirationTime(seconds + 3600)
        .sign(key);
    const access = await signed(pair.privateKey, "first", {
      sid: "test-session",
    });
    const identity = await signed(second.privateKey, "second", {
      linked_accounts: JSON.stringify([
        { type: "wallet", chain_type: "ethereum", address: wallet },
      ]),
    });
    expect((await remote.verify(access, identity)).wallets).toEqual([wallet]);
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    expect(String(fetchKeys.mock.calls[0]?.[0])).toBe(
      `https://api.privy.io/v1/apps/${appId}/jwks.json`,
    );
    const untrusted = await generateKeyPair("ES256");
    await expect(
      remote.verify(
        await signed(untrusted.privateKey, "first", { sid: "test-session" }),
        identity,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("fails closed when published signing keys are unavailable or malformed", async () => {
    const signed = await proof();
    for (const response of [
      new Response("offline", { status: 503 }),
      Response.json({ keys: null }),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );
      await expect(
        new PrivyTokenVerifier(appId, "", () => now, "jwks").verify(
          signed.access,
          signed.identity,
        ),
      ).rejects.toMatchObject({ status: 503 });
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Fixture network unavailable");
      }),
    );
    await expect(
      new PrivyTokenVerifier(appId, "", () => now, "jwks").verify(
        signed.access,
        signed.identity,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("fails closed when app/key configuration is missing or malformed", async () => {
    const signed = await proof();
    await expect(
      new PrivyTokenVerifier("", pem).verify(signed.access, signed.identity),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      new PrivyTokenVerifier(appId, "").verify(signed.access, signed.identity),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      new PrivyTokenVerifier(appId, "not-a-valid-spki-pem").verify(
        signed.access,
        signed.identity,
      ),
    ).rejects.toMatchObject({
      status: 503,
      cause: expect.any(Error),
    });
  });
  it("requires verified Privy identity for nonce/grant/play, binds user and rejects legacy cookie-only writes", async () => {
    const store = new Store(":memory:");
    try {
      const records = new IdentityStore(store);
      const origin = "https://chog.example";
      const chain = {
        isContract: async () => false,
        observe: async () => ({
          owner: wallet,
          changed: false,
          pendingTransfer: false,
          checkedAt: now,
          block: {
            number: "0x64",
            hash: `0x${"1".repeat(64)}`,
            timestamp: `0x${seconds.toString(16)}`,
          },
        }),
      };
      const auth = new AuthService(records, chain, origin, () => now);
      const api = createIdentityHandlers(records, auth, origin, verifier);
      const opened = await api.get(new NextRequest(`${origin}/api/identity`));
      const browser = opened.headers.get("set-cookie")?.split(";")[0] ?? "";
      const signed = await proof();
      const headers = {
        Authorization: `Bearer ${signed.access}`,
        "privy-id-token": signed.identity,
      };
      const post = (
        input: unknown,
        cookie = browser,
        extra: Record<string, string> = {},
      ) =>
        api.post(
          new NextRequest(`${origin}/api/identity`, {
            method: "POST",
            headers: {
              origin,
              cookie,
              "Content-Type": "application/json",
              ...extra,
            },
            body: JSON.stringify(input),
          }),
        );
      const challengeInput = {
        operation: "challenge",
        wallet,
        identity: identityFor("276"),
      };
      expect((await post(challengeInput)).status).toBe(401);
      const unlinked = { ...challengeInput, wallet: `0x${"2".repeat(40)}` };
      expect((await post(unlinked, browser, headers)).status).toBe(403);
      const challengeReply = await post(challengeInput, browser, headers);
      expect(challengeReply.status).toBe(200);
      const challenge = await challengeReply.json();
      const signature = await owner.signMessage({ message: challenge.message });
      const verifyInput = {
        operation: "verify",
        nonce: challenge.nonce,
        message: challenge.message,
        signature,
      };
      const another = await proof({ subject: "did:privy:another-user" });
      const otherHeaders = {
        Authorization: `Bearer ${another.access}`,
        "privy-id-token": another.identity,
      };
      expect((await post(verifyInput, browser, otherHeaders)).status).toBe(401);
      const grant = await post(verifyInput, browser, headers);
      expect(grant.status).toBe(200);
      const cookie = `${browser}; ${grant.headers.get("set-cookie")?.split(";")[0]}`;
      const start = { operation: "start", id: randomUUID(), retryOf: null };
      expect((await post(start, cookie)).status).toBe(401);
      expect((await post(start, cookie, otherHeaders)).status).toBe(401);
      const started = await post(start, cookie, headers);
      expect(started.status).toBe(200);
      expect((await started.json()).run.mode).toBe("official");
      const privateView = await api.get(
        new NextRequest(`${origin}/api/identity`, {
          headers: { cookie, ...headers },
        }),
      );
      expect((await privateView.json()).account.wallet).toBe(wallet);
      const withoutProvider = await api.get(
        new NextRequest(`${origin}/api/identity`, { headers: { cookie } }),
      );
      expect((await withoutProvider.json()).account).toBeNull();
      const replay = await post(verifyInput, browser, headers);
      expect(replay.status).toBe(401);
      expect((await post({ operation: "logout" }, cookie)).status).toBe(200);
    } finally {
      store.close();
    }
  });
});
