import { describe, expect, it } from "vitest";
import { requestedSeatMode } from "../../src/server/pvp/seatMode";
describe("explicit seat intent and legacy inference", () => {
  it.each([
    [null, undefined, false, "guest"],
    [null, undefined, true, "official"],
    [null, "guest", true, "guest"],
    [null, "official", false, "official"],
    ["guest", undefined, true, "guest"],
    ["guest", "guest", true, "guest"],
  ] as const)(
    "resolves stored=%s explicit=%s wallet=%s to %s",
    (stored, explicit, wallet, expected) => {
      expect(requestedSeatMode(stored, explicit, wallet)).toBe(expected);
    },
  );
  it("rejects an attempt to upgrade a known guest seat", () => {
    expect(() => requestedSeatMode("guest", "official", true)).toThrow(
      /keeps the access/,
    );
  });
});
