import { afterEach, describe, expect, it, vi } from "vitest";
import { Store } from "../../src/server/persistence";
import { Entitlements } from "../../src/server/access/service";
import {
  MonadHoldings,
  type HoldingReader,
} from "../../src/server/access/reader";
import { CHOG_MINIMUM, PUBLIC_FIGHTERS } from "../../src/domain/access/policy";
import { COLLECTION } from "../../src/domain/identity";
import { readFileSync } from "node:fs";
const actor = "11111111-1111-4111-8111-111111111111";
const wallet = `0x${"11".repeat(20)}`;
const player = { actor, wallet, userId: "did:privy:fixture" };
const now = 1700000000000;
const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;
const code = readFileSync("tests/fixtures/chog-bytecode.txt", "utf8").trim();
function chain(balance: bigint, nft = 0n, chainId = "0x8f", decimals = 18n) {
  return vi.fn(async (method: string, params: unknown[]) => {
    if (method === "eth_chainId") return chainId;
    if (method === "eth_getBlockByNumber")
      return {
        number: "0x100",
        timestamp: `0x${(BigInt(now) / 1000n).toString(16)}`,
      };
    if (method === "eth_getCode")
      return params[0] === COLLECTION ? code : "0x6000";
    if (method === "eth_call") {
      const call = params[0] as { to: string; data: string };
      return word(
        call.data === "0x313ce567"
          ? decimals
          : call.to === COLLECTION
            ? nft
            : balance,
      );
    }
    throw Error("Fixture forbids unknown calls and transactions");
  });
}
afterEach(() => vi.restoreAllMocks());
describe("read-only exact integer CHOG eligibility", () => {
  it.each([
    [CHOG_MINIMUM, true],
    [CHOG_MINIMUM - 1n, false],
    [0n, false],
  ] as const)("uses base units at %s", async (balance, qualifies) => {
    const rpc = chain(balance);
    const reader = new MonadHoldings(rpc, () => now);
    expect((await reader.token(wallet)).qualifies).toBe(qualifies);
    expect(
      rpc.mock.calls.every(
        ([method]) => !method.includes("send") && !method.includes("sign"),
      ),
    ).toBe(true);
  });
  it("rejects wrong chain, wrong decimals, missing code and stale evidence", async () => {
    await expect(
      new MonadHoldings(chain(CHOG_MINIMUM, 0n, "0x1"), () => now).token(
        wallet,
      ),
    ).rejects.toThrow();
    await expect(
      new MonadHoldings(chain(CHOG_MINIMUM, 0n, "0x8f", 6n), () => now).token(
        wallet,
      ),
    ).rejects.toThrow();
    await expect(
      new MonadHoldings(chain(CHOG_MINIMUM), () => now + 60_000).token(wallet),
    ).rejects.toThrow(/stale/);
  });
});
describe("shared entitlement resolver", () => {
  it.each([
    [true, false, "token", 6],
    [false, true, "nft", 12],
    [true, true, "both", 12],
  ] as const)(
    "resolves independent routes %s / %s",
    async (token, nft, kind, size) => {
      const store = new Store(":memory:");
      try {
        const service = new Entitlements(
          store,
          {
            token: async () => ({
              qualifies: token,
              block: "0x1",
              checkedAt: now,
            }),
            nft: async () => ({ qualifies: nft, block: "0x1", checkedAt: now }),
          },
          () => now,
          () => true,
        );
        const grant = await service.resolve(player, true);
        expect(grant.kind).toBe(kind);
        expect(grant.fighters).toHaveLength(size);
        if (kind === "token") expect(grant.fighters).toEqual(PUBLIC_FIGHTERS);
        expect(JSON.stringify(grant)).not.toContain(wallet);
      } finally {
        store.close();
      }
    },
  );
  it("either valid route survives the other RPC failure, while neither is denied and outage is retryable", async () => {
    const store = new Store(":memory:");
    try {
      const ok = async () => ({
        qualifies: true,
        block: "0x1",
        checkedAt: now,
      });
      const no = async () => ({
        qualifies: false,
        block: "0x1",
        checkedAt: now,
      });
      const failed = async () => {
        throw Error("Fixture RPC down");
      };
      for (const reader of [
        { token: ok, nft: failed },
        { token: failed, nft: ok },
      ])
        await expect(
          new Entitlements(
            store,
            reader,
            () => now,
            () => true,
          ).resolve(player, true),
        ).resolves.toHaveProperty("actor", actor);
      await expect(
        new Entitlements(
          store,
          { token: no, nft: no },
          () => now,
          () => true,
        ).resolve(player, true),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        new Entitlements(
          store,
          { token: failed, nft: no },
          () => now,
          () => true,
        ).resolve(player, true),
      ).rejects.toMatchObject({ status: 503 });
      await expect(
        new Entitlements(
          store,
          { token: ok, nft: ok },
          () => now,
          () => false,
        ).resolve(player),
      ).rejects.toMatchObject({ status: 503 });
    } finally {
      store.close();
    }
  });
  it("deduplicates in flight, caches reads briefly, refreshes admission and persists evidence after service restart", async () => {
    const store = new Store(":memory:");
    let clock = now;
    let eligible = true;
    const observe = vi.fn(async () => ({
      qualifies: eligible,
      checkedAt: clock,
      block: "0x1",
    }));
    const reader: HoldingReader = {
      token: observe,
      nft: async () => ({ qualifies: false, checkedAt: clock, block: "0x1" }),
    };
    try {
      const service = new Entitlements(
        store,
        reader,
        () => clock,
        () => true,
      );
      const [one, two] = await Promise.all([
        service.resolve(player, true),
        service.resolve(player, true),
      ]);
      expect(one.id).toBe(two.id);
      expect(observe).toHaveBeenCalledTimes(1);
      eligible = false;
      expect(
        (
          await new Entitlements(
            store,
            reader,
            () => clock,
            () => true,
          ).resolve(player)
        ).id,
      ).toBe(one.id);
      await expect(service.resolve(player, true)).rejects.toMatchObject({
        status: 403,
      });
      clock += 30_001;
      await expect(service.resolve(player)).rejects.toMatchObject({
        status: 403,
      });
      expect(service.stored(actor)?.id).toBe(one.id); // Frozen encounters can retain their original grant.
    } finally {
      store.close();
    }
  });
});
it("does not continue RPC steps or retry after the shared timeout", async () => {
  vi.useFakeTimers();
  let release!: (value: unknown) => void;
  const rpc = vi.fn(
    () =>
      new Promise<unknown>((resolve) => {
        release = resolve;
      }),
  );
  try {
    const result = new MonadHoldings(rpc).token(wallet);
    const rejected = expect(result).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(8001);
    await rejected;
    release("0x8f");
    await Promise.resolve();
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
it("cosmetic equip is opt-in, rechecks current eligibility and never publishes a profile", async () => {
  const store = new Store(":memory:");
  let eligible = true;
  const reader: HoldingReader = {
    token: async () => ({ qualifies: eligible, block: "0x1", checkedAt: now }),
    nft: async () => ({ qualifies: false, block: "0x1", checkedAt: now }),
  };
  const service = new Entitlements(
    store,
    reader,
    () => now,
    () => true,
  );
  try {
    expect((await service.view(player)).equipped).toBe(false);
    expect((await service.equip(player, true)).equipped).toBe(true);
    eligible = false;
    await expect(service.equip(player, true)).rejects.toMatchObject({
      status: 403,
    });
    expect((await service.equip(player, false)).equipped).toBe(false);
    expect(
      store.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%profile%'",
        )
        .all(),
    ).toEqual([]);
  } finally {
    store.close();
  }
});
it("does not mint a fresh grant from a block that aged out during RPC reads", async () => {
  let clock = now;
  const base = chain(CHOG_MINIMUM);
  const rpc = async (method: string, params: unknown[]) => {
    const result = await base(method, params);
    if (method === "eth_call") clock = now + 30001;
    return result;
  };
  await expect(
    new MonadHoldings(rpc, () => clock).token(wallet),
  ).rejects.toThrow(/stale|expired/);
});
