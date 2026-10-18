import { describe, expect, it } from "vitest";
import { isLate, timeoutResult } from "../../src/domain/pvp/deadline";
import type { SeatId } from "../../src/domain/pvp/types";

describe("late rule", () => {
  it("treats the exact deadline as late and one millisecond earlier as early", () => {
    expect(isLate(1000, 1000)).toBe(true);
    expect(isLate(1001, 1000)).toBe(true);
    expect(isLate(999, 1000)).toBe(false);
  });
});

describe("terminal deadline decisions", () => {
  const evidence = {
    missed: ["a", "b"] as SeatId[],
    nextMisses: { a: 1, b: 1 },
    guardAllowed: { a: true, b: true },
    missedTurnLimit: 2,
  };
  it("substitutes Guard on a first legal miss and ignores guard legality of locked seats", () => {
    expect(timeoutResult(evidence)).toBeNull();
    expect(
      timeoutResult({
        ...evidence,
        missed: ["b"],
        guardAllowed: { a: false, b: true },
      }),
    ).toBeNull();
    expect(
      timeoutResult({ ...evidence, missed: [], nextMisses: { a: 2, b: 2 } }),
    ).toBeNull();
  });
  it("prioritizes consecutive misses before illegal Guard", () => {
    expect(
      timeoutResult({
        ...evidence,
        nextMisses: { a: 2, b: 1 },
        guardAllowed: { a: true, b: false },
      }),
    ).toMatchObject({ kind: "forfeit", winner: "b" });
    expect(
      timeoutResult({ ...evidence, nextMisses: { a: 2, b: 2 } }),
    ).toMatchObject({ kind: "abandoned", winner: null });
  });
  it("forfeits an illegal substitution and abandons two illegal substitutions", () => {
    expect(
      timeoutResult({ ...evidence, guardAllowed: { a: true, b: false } }),
    ).toMatchObject({ kind: "forfeit", winner: "a" });
    expect(
      timeoutResult({ ...evidence, guardAllowed: { a: false, b: false } }),
    ).toMatchObject({ kind: "abandoned", winner: null });
  });
});
