import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { IdentityStore } from "../../src/server/auth/persistence";
import { AuthService } from "../../src/server/auth/service";
import { PrivyTokenVerifier } from "../../src/server/auth/privy";
import { createBattleHandlers } from "../../src/server/combat/http";
import { createIdentityHandlers } from "../../src/server/identityHttp";
import { identityFor } from "../../src/domain/identity";
import { ServiceError } from "../../src/server/errors";

export const origin = "https://chog.example";
// Disposable provider signatures and wallet; the synthetic chain is never mainnet evidence.
export async function officialCombatFixture(providedStore?: Store) {
  const store = providedStore ?? new Store(":memory:"),
    owner = privateKeyToAccount(generatePrivateKey()),
    outsider = privateKeyToAccount(generatePrivateKey());
  const pair = await generateKeyPair("ES256", { extractable: true });
  const now = Date.now(),
    seconds = Math.floor(now / 1000),
    appId = "combat-synthetic-privy";
  async function proof(wallet: string, user = "did:privy:combat-fixture") {
    const sign = (extra: Record<string, unknown>) =>
      new SignJWT(extra)
        .setProtectedHeader({ alg: "ES256" })
        .setIssuer("privy.io")
        .setAudience(appId)
        .setSubject(user)
        .setIssuedAt(seconds)
        .setExpirationTime(seconds + 3600)
        .sign(pair.privateKey);
    return {
      Authorization: `Bearer ${await sign({ sid: "fixture-session" })}`,
      "privy-id-token": await sign({
        linked_accounts: JSON.stringify([
          { type: "wallet", chain_type: "ethereum", address: wallet },
        ]),
      }),
    };
  }
  let available = true,
    changed = false,
    height = 100;
  let chainOwner = owner.address.toLowerCase();
  const chain = {
    isContract: async () => false,
    observe: async () => {
      if (!available) throw new ServiceError(503, "Fixture RPC unavailable.");
      height++;
      const result = {
        owner: chainOwner,
        changed,
        pendingTransfer: false,
        checkedAt: now,
        block: {
          number: `0x${height.toString(16)}`,
          hash: `0x${height.toString(16).padStart(64, "0")}`,
          timestamp: `0x${seconds.toString(16)}`,
        },
      };
      changed = false;
      return result;
    },
  };
  const auth = new AuthService(
    new IdentityStore(store),
    chain,
    origin,
    () => now,
  );
  const verifier = new PrivyTokenVerifier(
    appId,
    await exportSPKI(pair.publicKey),
    () => now,
  );
  const battles = createBattleHandlers(store, origin, auth, verifier);
  const identity = createIdentityHandlers(
    new IdentityStore(store),
    auth,
    origin,
    verifier,
  );
  const guest = (
    await battles.get(new NextRequest(`${origin}/api/battle`))
  ).headers
    .get("set-cookie")!
    .split(";")[0];
  const post = (
    input: unknown,
    cookie = guest,
    headers: Record<string, string> = {},
  ) =>
    battles.post(
      new NextRequest(`${origin}/api/battle`, {
        method: "POST",
        headers: {
          origin,
          "Content-Type": "application/json",
          cookie,
          ...headers,
        },
        body: JSON.stringify(input),
      }),
    );
  async function login(account = owner) {
    const headers = await proof(account.address);
    const browser = (
      await identity.get(new NextRequest(`${origin}/api/identity`))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const challenge = await auth.challenge(
      browser.split("=")[1],
      account.address,
      identityFor("276"),
      "did:privy:combat-fixture",
    );
    const verified = await identity.post(
      new NextRequest(`${origin}/api/identity`, {
        method: "POST",
        headers: {
          origin,
          cookie: browser,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          operation: "verify",
          nonce: challenge.nonce,
          message: challenge.message,
          signature: await account.signMessage({ message: challenge.message }),
        }),
      }),
    );
    expect(verified.status).toBe(200);
    return {
      cookie: `${guest}; ${browser}; ${verified.headers.get("set-cookie")!.split(";")[0]}`,
      headers,
    };
  }
  return {
    store,
    auth,
    verifier,
    identity,
    post,
    battles,
    guest,
    login,
    outsider,
    proof,
    outage: () => {
      available = false;
    },
    recover: () => {
      available = true;
    },
    awayBack: () => {
      changed = true;
    },
    transferAway: () => {
      changed = true;
      chainOwner = outsider.address.toLowerCase();
    },
  };
}
