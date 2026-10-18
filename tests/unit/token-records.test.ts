import { describe, expect, it } from "vitest";
import { identityFor, tokenKey } from "../../src/domain/identity";
import { Store } from "../../src/server/persistence";
import {
  publicRecord,
  TokenRecords,
  type TokenRecord,
} from "../../src/server/records/tokenRecords";

const TOKEN = identityFor("276");
const OTHER = identityFor("277");

function entry(overrides: Partial<TokenRecord> = {}) {
  return {
    token: tokenKey(TOKEN),
    kind: "series" as const,
    source: "series-1",
    headline: "Victory",
    explanation: "Won the series 2–0.",
    fighter: "Pip",
    opponent: "Guest 7",
    opponentFighter: "Bolt",
    arena: "Ruined Sanctuary",
    rounds: null,
    score: "2–0",
    route: null,
    owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recordedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function withStore(run: (records: TokenRecords, store: Store) => void) {
  const store = new Store(":memory:");
  try {
    run(new TokenRecords(store), store);
  } finally {
    store.close();
  }
}

describe("token record store", () => {
  it("writes once and ignores a retried result", () =>
    withStore((records) => {
      expect(records.write(entry())).toBe(true);
      expect(records.write(entry())).toBe(false);
      expect(records.write(entry({ headline: "Defeat" }))).toBe(false);
      expect(records.list(TOKEN)).toHaveLength(1);
    }));

  it("keeps battle detail under the same series without duplication", () =>
    withStore((records) => {
      records.write(entry());
      records.write(
        entry({ kind: "battle", source: "match-1", rounds: 9, score: null }),
      );
      records.write(
        entry({
          kind: "battle",
          source: "match-2",
          headline: "Defeat",
          rounds: 12,
          score: null,
        }),
      );
      const list = records.list(TOKEN);
      expect(list).toHaveLength(3);
      expect(records.summary(TOKEN)).toEqual({
        series: 1,
        battles: 2,
        story: 0,
        noContest: 0,
        wins: 1,
        losses: 0,
        draws: 0,
      });
    }));

  it("counts series outcomes only, never battle rows", () =>
    withStore((records) => {
      records.write(entry({ source: "s1", headline: "Victory" }));
      records.write(entry({ source: "s2", headline: "Defeat" }));
      records.write(entry({ source: "s3", headline: "Draw", score: "1–1" }));
      records.write(
        entry({
          source: "s4",
          kind: "no-contest",
          headline: "No contest",
          explanation: "Ownership changed before the series ended.",
        }),
      );
      records.write(
        entry({ source: "m1", kind: "battle", headline: "Victory" }),
      );
      records.write(
        entry({ source: "m2", kind: "battle", headline: "Defeat" }),
      );
      expect(records.summary(TOKEN)).toMatchObject({
        series: 3,
        battles: 2,
        noContest: 1,
        wins: 1,
        losses: 1,
        draws: 1,
      });
    }));

  it("scopes rows to the exact token key", () =>
    withStore((records) => {
      records.write(entry());
      records.write(entry({ token: tokenKey(OTHER) }));
      expect(records.list(TOKEN)).toHaveLength(1);
      expect(records.list(OTHER)).toHaveLength(1);
      expect(records.summary(TOKEN).series).toBe(1);
    }));

  it("orders newest first and strips wallet attribution publicly", () =>
    withStore((records) => {
      records.write(entry({ source: "older", recordedAt: 1 }));
      records.write(
        entry({
          source: "newer",
          recordedAt: 2,
          rules: "series/1",
          eligibleForPublication: true,
          publication: {
            policy: "soryn-record-consent/1",
            alias: "Fixture Keeper",
            at: 3,
            status: "published",
          },
        }),
      );
      const [first, second] = records.list(TOKEN);
      expect(first.recordedAt).toBe(2);
      expect(second.recordedAt).toBe(1);
      const shown = publicRecord(first);
      expect(shown).not.toHaveProperty("owner");
      expect(shown).not.toHaveProperty("generation");
      expect(shown).not.toHaveProperty("source");
      expect(shown.headline).toBe("Victory");
    }));

  it("rejects malformed rows at the boundary", () =>
    withStore((records) => {
      expect(() => records.write(entry({ rounds: 1000 }))).toThrow();
      expect(() =>
        records.write(entry({ kind: "scrimmage" as TokenRecord["kind"] })),
      ).toThrow();
      expect(records.list(TOKEN)).toHaveLength(0);
    }));
});
