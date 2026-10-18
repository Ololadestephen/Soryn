import { AdventureStore } from "../../src/server/adventure/persistence";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  identityFor,
  identitySchema,
  tokenIdSchema,
} from "../../src/domain/identity";
import { Store } from "../../src/server/persistence";
import { IdentityStore } from "../../src/server/auth/persistence";
import { AuthService } from "../../src/server/auth/service";
import { OfficialService } from "../../src/server/adventure/official";
import { RunService } from "../../src/server/adventure/runs";
import { GuestJournal } from "../../src/server/adventure/journal";
import { ServiceError } from "../../src/server/errors";
import type { OwnershipReader } from "../../src/server/nft/rpc";

// Disposable signatures and chain simulations. No user wallet or network writes.
const alice = privateKeyToAccount(generatePrivateKey());
const bob = privateKeyToAccount(generatePrivateKey());
const identity = identityFor("276");
const stores: Store[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.close()));
class ChainFixture implements OwnershipReader {
  owner = alice.address.toLowerCase();
  changed = false;
  pendingTransfer = false;
  unavailable = false;
  contractWallet = false;
  height = 100;
  now = Date.now();
  async isContract() {
    return this.contractWallet;
  }
  async observe() {
    if (this.unavailable)
      throw new ServiceError(503, "Fixture RPC unavailable.");
    this.height++;
    const observation = {
      owner: this.owner,
      changed: this.changed,
      pendingTransfer: this.pendingTransfer,
      checkedAt: this.now,
      block: {
        number: `0x${this.height.toString(16)}`,
        hash: `0x${this.height.toString(16).padStart(64, "0")}`,
        timestamp: `0x${Math.floor(this.now / 1000).toString(16)}`,
      },
    };
    this.changed = false;
    return observation;
  }
}
function setup(path = ":memory:") {
  const store = new Store(path);
  stores.push(store);
  const records = new IdentityStore(store);
  const chain = new ChainFixture();
  const auth = new AuthService(
    records,
    chain,
    "https://chog.example",
    () => chain.now,
  );
  const official = new OfficialService(records);
  return { store, records, chain, auth, official };
}
async function signIn(
  ctx: ReturnType<typeof setup>,
  account = alice,
  browser = randomUUID(),
) {
  const challenge = await ctx.auth.challenge(
    browser,
    account.address,
    identity,
  );
  const signature = await account.signMessage({ message: challenge.message });
  return ctx.auth.verify(
    browser,
    challenge.nonce,
    challenge.message,
    signature,
  );
}
async function start(
  ctx: ReturnType<typeof setup>,
  secret: string,
  id = randomUUID(),
) {
  const authorized = await ctx.auth.authorize(secret);
  return ctx.official.start(authorized.session, authorized.authority, id, null);
}
async function step(
  ctx: ReturnType<typeof setup>,
  secret: string,
  id: string,
  index: number,
  action: "door" | "inspect",
) {
  const authorized = await ctx.auth.authorize(secret);
  return ctx.official.step(
    authorized.session,
    authorized.authority,
    id,
    index,
    action,
  );
}

describe("wallet authentication and transfer-safe token chapters", () => {
  it("uses actual uint256 token IDs and rejects alternate chain/collection/display names", () => {
    expect(identityFor("276").tokenId).toBe("276");
    for (const bad of [
      "CHOG #1737",
      "0276",
      "-1",
      "1.5",
      (2n ** 256n).toString(),
    ])
      expect(tokenIdSchema.safeParse(bad).success).toBe(false);
    expect(identitySchema.safeParse({ ...identity, chainId: 1 }).success).toBe(
      false,
    );
    expect(
      identitySchema.safeParse({ ...identity, collection: bob.address })
        .success,
    ).toBe(false);
  });
  it("verifies real EOA signatures, exact bindings, browser scope, expiry and nonce replay", async () => {
    const ctx = setup();
    const browser = randomUUID();
    const challenge = await ctx.auth.challenge(
      browser,
      alice.address,
      identity,
    );
    expect(challenge.message).toContain(
      "https://chog.example wants you to sign in",
    );
    expect(challenge.message).toContain("Chain ID: 143");
    expect(challenge.message).toContain(":276");
    const signature = await alice.signMessage({ message: challenge.message });
    for (const [from, message] of [
      [randomUUID(), challenge.message],
      [browser, challenge.message.replace("chog.example", "evil.example")],
      [browser, challenge.message.replace("Chain ID: 143", "Chain ID: 1")],
      [browser, challenge.message.replace(alice.address, bob.address)],
      [browser, challenge.message.replace(challenge.nonce, "0".repeat(48))],
    ]) {
      await expect(
        ctx.auth.verify(from, challenge.nonce, message, signature),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      ctx.auth.verify(
        browser,
        challenge.nonce,
        challenge.message,
        await bob.signMessage({ message: challenge.message }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    const signed = await ctx.auth.verify(
      browser,
      challenge.nonce,
      challenge.message,
      signature,
    );
    expect(ctx.auth.session(signed.secret).wallet).toBe(
      alice.address.toLowerCase(),
    );
    await expect(
      ctx.auth.verify(browser, challenge.nonce, challenge.message, signature),
    ).rejects.toMatchObject({ status: 401 });
    const expired = await ctx.auth.challenge(browser, alice.address, identity);
    const expiredSignature = await alice.signMessage({
      message: expired.message,
    });
    ctx.chain.now += 5 * 60_000;
    await expect(
      ctx.auth.verify(
        browser,
        expired.nonce,
        expired.message,
        expiredSignature,
      ),
    ).rejects.toMatchObject({ status: 401 });
    ctx.chain.now += 10 * 60_000;
    expect(() => ctx.auth.session(signed.secret)).toThrow("expired");
  });
  it("rejects non-owner writes and unsupported contract-wallet sign-in", async () => {
    const ctx = setup();
    const outsider = await signIn(ctx, bob);
    expect(outsider.session.generation).toBeNull();
    await expect(ctx.auth.authorize(outsider.secret)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      new AdventureStore(ctx.store).history(outsider.session.actor),
    ).toEqual([]);
    ctx.chain.contractWallet = true;
    await expect(
      ctx.auth.challenge(randomUUID(), alice.address, identity),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("revokes old grants after away/back, even without observing the intermediate owner", async () => {
    const ctx = setup();
    const old = await signIn(ctx);
    const run = await start(ctx, old.secret);
    ctx.chain.changed = true; // Two token Transfer logs, current address again Alice.
    await expect(ctx.auth.authorize(old.secret)).rejects.toMatchObject({
      status: 403,
    });
    expect(ctx.auth.session(old.secret).revoked).toBe(true);
    const fresh = await signIn(ctx);
    const auth = await ctx.auth.authorize(fresh.secret);
    expect(auth.authority.generation).not.toBe(old.session.generation);
    expect(() =>
      ctx.official.step(auth.session, auth.authority, run.id, 0, "door"),
    ).toThrow("ownership generation");
    expect(
      new AdventureStore(ctx.store).getRun(run.id, old.session.actor).actions,
    ).toEqual([]);
    expect(ctx.official.session(fresh.session).run).toBeNull();
  });
  it("rejects transfers during signing, reorg generations and pending transfers", async () => {
    const ctx = setup();
    const browser = randomUUID();
    const challenge = await ctx.auth.challenge(
      browser,
      alice.address,
      identity,
    );
    ctx.chain.changed = true;
    await expect(
      ctx.auth.verify(
        browser,
        challenge.nonce,
        challenge.message,
        await alice.signMessage({ message: challenge.message }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    const signed = await signIn(ctx);
    ctx.chain.changed = true; // Replaced checkpoint is a new generation even for same owner.
    await expect(ctx.auth.authorize(signed.secret)).rejects.toMatchObject({
      status: 403,
    });
    const renewed = await signIn(ctx);
    ctx.chain.changed = true;
    ctx.chain.pendingTransfer = true;
    await expect(ctx.auth.authorize(renewed.secret)).rejects.toMatchObject({
      status: 503,
    });
    expect(ctx.auth.session(renewed.secret).revoked).toBe(true);
  });
  it("keeps consented history and frozen ghosts with the token while excluding private drafts", async () => {
    const ctx = setup();
    const signed = await signIn(ctx);
    const draft = await start(ctx, signed.secret);
    await step(ctx, signed.secret, draft.id, 0, "inspect");
    const failure = await start(ctx, signed.secret);
    await step(ctx, signed.secret, failure.id, 0, "door");
    const auth = await ctx.auth.authorize(signed.secret);
    const chapter = ctx.official.publish(
      auth.session,
      auth.authority,
      failure.id,
      "Painted door",
      "First keeper",
      true,
    );
    expect(chapter.ghost.profile.runs).toBe(1);
    expect(
      ctx.official.publish(
        auth.session,
        auth.authority,
        failure.id,
        "Changed title",
        "Changed alias",
        true,
      ),
    ).toEqual(chapter);
    const frozen = JSON.stringify(chapter);
    const another = await start(ctx, signed.secret);
    await step(ctx, signed.secret, another.id, 0, "door");
    expect(JSON.stringify(ctx.records.chapters(identity)[0])).toBe(frozen);
    ctx.chain.owner = bob.address.toLowerCase();
    ctx.chain.changed = true;
    const successor = await signIn(ctx, bob);
    const inherited = ctx.official.session(successor.session);
    expect(inherited.run).toBeNull();
    expect(inherited.chapters).toEqual([chapter]);
    const publicBytes = JSON.stringify(inherited.chapters);
    for (const privateValue of [
      draft.id,
      failure.id,
      signed.session.actor,
      alice.address.toLowerCase(),
      "trainingIds",
      "secret_hash",
      "runId",
    ])
      expect(publicBytes).not.toContain(privateValue);
    await expect(ctx.auth.authorize(signed.secret)).rejects.toMatchObject({
      status: 403,
    });
    const next = await start(ctx, successor.secret);
    const result = await step(ctx, successor.secret, next.id, 0, "door");
    expect(result.ghost?.profile.runs).toBe(1);
    const publicRuns = new RunService(ctx.store);
    expect(publicRuns.session(signed.session.actor).run).toBeNull();
    const guestJournal = new GuestJournal(ctx.store, publicRuns);
    expect(guestJournal.read(signed.session.actor)).toEqual({
      chapters: [],
      challenges: [],
    });
    expect(() =>
      guestJournal.chapter(signed.session.actor, failure.id),
    ).toThrow("Completed guest chapter unavailable");
    expect(() =>
      guestJournal.race(signed.session.actor, randomUUID(), failure.id),
    ).toThrow("Completed guest chapter unavailable");
    expect(() =>
      publicRuns.step(signed.session.actor, draft.id, 1, "door"),
    ).toThrow("another mode");
    expect(() => ctx.official.withdraw(successor.session, failure.id)).toThrow(
      "unavailable",
    );
    ctx.official.withdraw(ctx.auth.session(signed.secret), failure.id); // Original author retains consent revocation.
    expect(ctx.records.chapters(identity)).toEqual([]);
    expect(new AdventureStore(ctx.store).museum()).toEqual([]);
  });
  it("fails closed on RPC outage without changing private actions or public chapters", async () => {
    const ctx = setup();
    const signed = await signIn(ctx);
    const run = await start(ctx, signed.secret);
    ctx.chain.unavailable = true;
    await expect(
      step(ctx, signed.secret, run.id, 0, "door"),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      new AdventureStore(ctx.store).getRun(run.id, signed.session.actor)
        .actions,
    ).toEqual([]);
    expect(ctx.records.chapters(identity)).toEqual([]);
  });
  it("persists checkpoint, hashed session, private/public boundaries and generation across reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "chog-identity-"));
    try {
      const ctx = setup(join(directory, "test.sqlite"));
      const signed = await signIn(ctx);
      const run = await start(ctx, signed.secret);
      await step(ctx, signed.secret, run.id, 0, "door");
      const auth = await ctx.auth.authorize(signed.secret);
      const chapter = ctx.official.publish(
        auth.session,
        auth.authority,
        run.id,
        "Persistent",
        "Original keeper",
        false,
      );
      const raw = ctx.store.db.prepare("SELECT * FROM wallet_sessions").get();
      expect(JSON.stringify(raw)).not.toContain(signed.secret);
      stores.splice(stores.indexOf(ctx.store), 1);
      ctx.store.close();
      const reopened = setup(join(directory, "test.sqlite"));
      reopened.chain.now = ctx.chain.now;
      reopened.chain.height = ctx.chain.height;
      expect(reopened.auth.session(signed.secret).generation).toBe(
        signed.session.generation,
      );
      expect(reopened.records.chapters(identity)).toEqual([chapter]);
      reopened.chain.changed = true;
      await expect(
        reopened.auth.authorize(signed.secret),
      ).rejects.toMatchObject({ status: 403 });
      stores.splice(stores.indexOf(reopened.store), 1);
      reopened.store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("rolls back both chapter and museum if publication storage fails", async () => {
    const ctx = setup();
    const signed = await signIn(ctx);
    const run = await start(ctx, signed.secret);
    await step(ctx, signed.secret, run.id, 0, "door");
    const auth = await ctx.auth.authorize(signed.secret);
    ctx.store.db.exec(
      "CREATE TRIGGER reject_exhibit BEFORE INSERT ON exhibits BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;",
    );
    expect(() =>
      ctx.official.publish(
        auth.session,
        auth.authority,
        run.id,
        "Atomic",
        "Keeper",
        true,
      ),
    ).toThrow("fixture failure");
    expect(ctx.records.chapters(identity)).toEqual([]);
    expect(new AdventureStore(ctx.store).museum()).toEqual([]);
  });
});
