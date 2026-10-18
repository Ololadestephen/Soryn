import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { identityFor, type BlockReference } from "../../src/domain/identity";
import {
  OwnershipService,
  OWNERSHIP_REQUEST_MS,
} from "../../src/server/auth/ownership";
import { IdentityStore } from "../../src/server/auth/persistence";
import { ServiceError } from "../../src/server/errors";
import type {
  ChainObservation,
  OwnershipReader,
} from "../../src/server/nft/rpc";
import { Store } from "../../src/server/persistence";

const alice = `0x${"a".repeat(40)}`;
const bob = `0x${"b".repeat(40)}`;
const identity = identityFor("276");

function block(number: number): BlockReference {
  return {
    number: `0x${number.toString(16)}`,
    hash: `0x${number.toString(16).padStart(64, "0")}`,
    timestamp: `0x${number.toString(16)}`,
  };
}

class Chain implements OwnershipReader {
  owner = alice;
  changed = false;
  pendingTransfer = false;
  failure: ServiceError | null = null;
  onObserve: (() => void) | null = null;
  private height = 100;
  constructor(private clock: { now: number }) {}
  async isContract() {
    return false;
  }
  async observe(): Promise<ChainObservation> {
    this.onObserve?.();
    if (this.failure) throw this.failure;
    this.height += 1;
    return {
      owner: this.owner,
      changed: this.changed,
      pendingTransfer: this.pendingTransfer,
      checkedAt: this.clock.now,
      block: block(this.height),
    };
  }
}

const stores: Store[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.close()));

function setup() {
  const store = new Store(":memory:");
  stores.push(store);
  const records = new IdentityStore(store);
  const clock = { now: 1_700_000_000_000 };
  const chain = new Chain(clock);
  const service = new OwnershipService(records, chain, () => clock.now);
  return { records, chain, service, clock };
}

describe("ownership generations", () => {
  it("shares only an in-flight observation; a later official action reads the chain again", async () => {
    const { records, chain, service, clock } = setup();
    let finish!: (value: ChainObservation) => void;
    const read = vi.spyOn(chain, "observe").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = service.fresh(identity);
    const concurrent = service.fresh(identity);
    expect(read).toHaveBeenCalledTimes(1);
    expect(records.ownership(identity)).toBeNull();
    finish({
      owner: alice,
      changed: false,
      pendingTransfer: false,
      checkedAt: clock.now,
      block: block(101),
    });
    expect(await concurrent).toEqual(await first);
    await service.fresh(identity);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("bounds a hung provider and never commits its late observation", async () => {
    vi.useFakeTimers();
    try {
      const { records, chain, service, clock } = setup();
      let finish!: (value: ChainObservation) => void;
      vi.spyOn(chain, "observe").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const failure = expect(service.fresh(identity)).rejects.toThrow(
        /timed out/,
      );
      await vi.advanceTimersByTimeAsync(OWNERSHIP_REQUEST_MS);
      await failure;
      finish({
        owner: bob,
        changed: true,
        pendingTransfer: false,
        checkedAt: clock.now,
        block: block(102),
      });
      await Promise.resolve();
      expect(records.ownership(identity)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps one generation while the owner is unchanged and advances the block", async () => {
    const { records, service, clock } = setup();
    const first = await service.fresh(identity);
    clock.now += 1000;
    const second = await service.fresh(identity);
    expect(second.owner).toBe(alice);
    expect(second.generation).toBe(first.generation);
    expect(second.block.number).not.toBe(first.block.number);
    expect(records.ownership(identity)?.block.number).toBe(second.block.number);
    service.assertFresh(second);
  });

  it("mints a new generation and revokes sessions when the owner changes", async () => {
    const { records, chain, service } = setup();
    const before = await service.fresh(identity);
    records.saveSession("hash", {
      privyUserId: null,
      actor: randomUUID(),
      wallet: alice,
      identity,
      generation: before.generation,
      expires: Date.now() + 60_000,
      revoked: false,
    });
    chain.owner = bob;
    chain.changed = true;
    const after = await service.fresh(identity);
    expect(after.generation).not.toBe(before.generation);
    expect(records.session("hash").revoked).toBe(true);
  });

  it("does not restore an old generation after transfer away and back", async () => {
    const { chain, service } = setup();
    const original = await service.fresh(identity);
    chain.owner = bob;
    chain.changed = true;
    const away = await service.fresh(identity);
    chain.owner = alice;
    chain.changed = true;
    const back = await service.fresh(identity);
    expect(away.generation).not.toBe(original.generation);
    expect(back.generation).not.toBe(original.generation);
    expect(back.generation).not.toBe(away.generation);
  });

  it("commits revocation, then fails fresh checks while a transfer is pending", async () => {
    const { records, chain, service } = setup();
    const settled = await service.fresh(identity);
    records.saveSession("hash", {
      privyUserId: null,
      actor: randomUUID(),
      wallet: alice,
      identity,
      generation: settled.generation,
      expires: Date.now() + 60_000,
      revoked: false,
    });
    chain.owner = bob;
    chain.changed = true;
    chain.pendingTransfer = true;
    const observed = await service.fresh(identity);
    expect(observed.checkedAt).toBe(0);
    expect(records.ownership(identity)?.owner).toBe(bob);
    expect(records.session("hash").revoked).toBe(true);
    expect(() => service.assertFresh(observed)).toThrow(ServiceError);
  });

  it("refuses to save over a concurrent ownership write", async () => {
    const { records, chain, service } = setup();
    const original = await service.fresh(identity);
    chain.onObserve = () =>
      records.saveOwnership({
        identity,
        owner: bob,
        generation: randomUUID(),
        block: block(999),
        checkedAt: original.checkedAt,
      });
    await expect(service.fresh(identity)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("fails closed on expired, future or superseded evidence", async () => {
    const { records, chain, service } = setup();
    const record = await service.fresh(identity);
    const expired = new OwnershipService(
      records,
      chain,
      () => 9_999_999_999_999,
    );
    expect(() => expired.assertFresh(record)).toThrow(ServiceError);
    const rolledBack = new OwnershipService(records, chain, () => 0);
    expect(() => rolledBack.assertFresh(record)).toThrow(ServiceError);
    records.saveOwnership({
      identity,
      owner: record.owner,
      generation: randomUUID(),
      block: block(500),
      checkedAt: record.checkedAt,
    });
    expect(() => service.assertFresh(record)).toThrow(ServiceError);
  });

  it("stores nothing when the chain read fails", async () => {
    const { records, chain, service } = setup();
    chain.failure = new ServiceError(503, "Fixture RPC unavailable.");
    await expect(service.fresh(identity)).rejects.toMatchObject({
      status: 503,
    });
    expect(records.ownership(identity)).toBeNull();
  });
});
