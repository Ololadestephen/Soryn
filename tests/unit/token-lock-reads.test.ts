import { expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { TokenLocks } from "../../src/server/pvp/locks";

it("reads treat expired reservations as absent without mutating unrelated rows", () => {
  const store = new Store(":memory:");
  try {
    const locks = new TokenLocks(store);
    const first = {
      token: "143:fixture:1",
      encounter: "old",
      kind: "story" as const,
      owner: "owner",
      generation: "generation",
      openedAt: 10,
      expiresAt: 20,
    };
    locks.acquire(first);
    expect(locks.get(first.token, 20)).toBeNull();
    expect(locks.get("missing", 21)).toBeNull();
    expect(
      store.db.prepare("SELECT count(*) AS count FROM token_locks").get()
        ?.count,
    ).toBe(1);
    expect(locks.purge(20)).toBe(1);
    locks.acquire({ ...first, encounter: "next", openedAt: 20, expiresAt: 30 });
    expect(locks.release(first.token, "old")).toBe(false);
    expect(locks.get(first.token, 20)?.encounter).toBe("next");
  } finally {
    store.close();
  }
});
