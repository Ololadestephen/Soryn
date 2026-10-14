import { describe, expect, it } from "vitest";
import {
  initialState,
  observe,
  replay,
  transition,
} from "../../src/domain/game/engine";
import { scenarioFor, type Action } from "../../src/domain/game/contracts";

describe("Sandwich rules v1", () => {
  it("replays the same scenario and actions exactly", () => {
    const actions: Action[] = [
      "inspect",
      "arch",
      "gadget",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ];
    const first = replay(scenarioFor(42), actions);
    expect(replay(scenarioFor(42), actions)).toEqual(first);
    expect(first.at(-1)).toMatchObject({
      outcome: "escaped",
      turns: 3,
      alarm: 0,
      gadgets: 0,
    });
  });
  it("supports saving the decoy and using the alternate route", () => {
    expect(
      replay(scenarioFor(42), ["arch", "inspect", "vent", "gadget", "exit"]).at(
        -1,
      ),
    ).toMatchObject({ outcome: "escaped", turns: 4, alarm: 0 });
  });
  it("supports timed patrol passage and a direct grab", () => {
    expect(
      replay(scenarioFor(42), ["arch", "wait", "sneak", "take", "exit"]).at(-1),
    ).toMatchObject({ outcome: "escaped", alarm: 2 });
    expect(
      replay(scenarioFor(43), ["arch", "sneak", "gadget", "exit"]).at(-1)
        ?.outcome,
    ).toBe("escaped");
  });
  it("has rational visible clues and memorable failures", () => {
    expect(observe(initialState(scenarioFor(0))).patrol).toBeNull();
    expect(observe(initialState(scenarioFor(0))).description).toContain(
      "works of art",
    );
    expect(replay(scenarioFor(0), ["door"]).at(-1)?.message).toContain(
      "The Door Was Painted",
    );
    expect(
      replay(scenarioFor(0), ["arch", "sneak", "sneak", "take"]).at(-1)
        ?.outcome,
    ).toBe("trapped");
  });
  it("rejects unknown, unavailable and terminal actions", () => {
    const state = initialState(scenarioFor(0));
    for (const action of [
      "swap",
      "vent",
      "take",
      { action: "arch" },
      "teleport",
    ])
      expect(() => transition(state, action)).toThrow();
    expect(() => transition(transition(state, "door"), "inspect")).toThrow();
    expect(() =>
      replay(scenarioFor(0), ["arch", "gadget", "gadget"]),
    ).toThrow();
    expect(() =>
      initialState({ ...scenarioFor(0), rules: "other" } as never),
    ).toThrow();
    expect(() => scenarioFor(-1)).toThrow();
  });
  it("supports empty escape and turn exhaustion", () => {
    expect(replay(scenarioFor(0), ["leave"]).at(-1)?.outcome).toBe(
      "empty-handed",
    );
    expect(
      replay(scenarioFor(0), ["arch", ...Array<Action>(9).fill("wait")]).at(-1),
    ).toMatchObject({ outcome: "trapped", turns: 0 });
  });
  it("bounds resources over every reachable legal path", () => {
    let escaped = 0;
    function visit(state: ReturnType<typeof initialState>) {
      expect(state.turns).toBeGreaterThanOrEqual(0);
      expect(state.gadgets).toBeGreaterThanOrEqual(0);
      expect(state.alarm).toBeLessThanOrEqual(4);
      if (state.outcome === "escaped") escaped++;
      for (const choice of observe(state).choices)
        visit(transition(state, choice.action));
    }
    visit(initialState(scenarioFor(0)));
    expect(escaped).toBeGreaterThan(1);
  });
});
