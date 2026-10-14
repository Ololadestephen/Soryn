import { randomUUID } from "node:crypto";
import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { IdentityStore } from "../../src/server/auth/persistence";
import { AuthService } from "../../src/server/auth/service";
import { PrivyTokenVerifier } from "../../src/server/auth/privy";
import { createBattleHandlers } from "../../src/server/combat/http";
import { createIdentityHandlers } from "../../src/server/identityHttp";
import { identityFor } from "../../src/domain/identity";
import { ServiceError } from "../../src/server/errors";

const origin = "https://chog.example";
// Disposable provider signatures and wallet; the synthetic chain is never mainnet evidence.
async function setup() {
  const store = new Store(":memory:"),
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
  const chain = {
    isContract: async () => false,
    observe: async () => {
      if (!available) throw new ServiceError(503, "Fixture RPC unavailable.");
      height++;
      const result = {
        owner: owner.address.toLowerCase(),
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
  };
}
describe("combat HTTP current-owner and input boundaries", () => {
  it("hides pending choices and rejects client damage/loadouts, cross-session reads and duplicate conflicts", async () => {
    const ctx = await setup();
    try {
      const id = randomUUID(),
        start = {
          operation: "start",
          mode: "guest",
          id,
          characterId: "pip",
          opponent: "bolt",
        };
      expect((await ctx.post({ ...start, health: 999 })).status).toBe(400);
      expect((await ctx.post({ ...start, characterId: "aegis" })).status).toBe(
        403,
      );
      const opened = await ctx.post(start);
      expect(opened.status).toBe(200);
      const data = await opened.json();
      expect(data.battle.pending).toBeUndefined();
      expect(data.battle.authority).toBeUndefined();
      const step = {
        operation: "step",
        mode: "guest",
        id,
        round: 1,
        move: "special",
      };
      const played = await (await ctx.post(step)).json();
      expect(await (await ctx.post(step)).json()).toEqual(played);
      expect((await ctx.post({ ...step, move: "basic" })).status).toBe(409);
      expect((await ctx.post({ ...step, round: 3 })).status).toBe(409);
      expect(
        (await ctx.post({ ...step, round: 2, move: "teleport" })).status,
      ).toBe(400);
      expect(
        (await ctx.post(step, "", { origin: "https://other.example" })).status,
      ).toBe(403);
      expect(
        (
          await ctx.battles.get(
            new NextRequest(`${origin}/api/battle?id=${id}`),
          )
        ).status,
      ).toBe(404);
    } finally {
      ctx.store.close();
    }
  });
  it("requires signed provider, wallet grant and fresh ownership even for an idempotent replay", async () => {
    const ctx = await setup();
    try {
      const owner = await ctx.login(),
        id = randomUUID(),
        start = {
          operation: "start",
          mode: "official",
          id,
          characterId: "aegis",
          opponent: "pip",
        };
      expect((await ctx.post(start, owner.cookie)).status).toBe(401);
      expect((await ctx.post(start, owner.cookie, owner.headers)).status).toBe(
        200,
      );
      const step = {
        operation: "step",
        mode: "official",
        id,
        round: 1,
        move: "special",
      };
      const accepted = await ctx.post(step, owner.cookie, owner.headers);
      expect(accepted.status).toBe(200);
      const old = (await accepted.json()).battle;
      ctx.outage();
      expect(
        (
          await ctx.post(
            { ...step, round: 2, move: "basic" },
            owner.cookie,
            owner.headers,
          )
        ).status,
      ).toBe(503);
      expect(
        (
          await ctx.post({
            operation: "start",
            mode: "guest",
            id: randomUUID(),
            characterId: "moss",
            opponent: "bolt",
          })
        ).status,
      ).toBe(200);
      ctx.recover();
      ctx.awayBack();
      expect((await ctx.post(step, owner.cookie, owner.headers)).status).toBe(
        403,
      );
      const restored = await ctx.battles.get(
        new NextRequest(`${origin}/api/battle?mode=official&id=${id}`, {
          headers: { cookie: owner.cookie, ...owner.headers },
        }),
      );
      expect((await restored.json()).battle).toEqual(old);
      const wrong = await ctx.proof(ctx.outsider.address, "did:privy:other");
      expect((await ctx.post(start, owner.cookie, wrong)).status).toBe(401);
    } finally {
      ctx.store.close();
    }
  });
  it("non-owner authentication cannot select an official starter or holder fighter", async () => {
    const ctx = await setup();
    try {
      const outsider = await ctx.login(ctx.outsider);
      for (const characterId of ["pip", "nyx"])
        expect(
          (
            await ctx.post(
              {
                operation: "start",
                mode: "official",
                id: randomUUID(),
                characterId,
                opponent: "pip",
              },
              outsider.cookie,
              outsider.headers,
            )
          ).status,
        ).toBe(403);
    } finally {
      ctx.store.close();
    }
  });
});
