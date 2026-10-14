import { describe, expect, it } from "vitest";
import {
  initialState,
  observe,
  transition,
} from "../../src/domain/game/engine";
import { scenarioFor } from "../../src/domain/game/contracts";
import {
  decide,
  deriveProfile,
  raceGhost,
} from "../../src/domain/ghosts/policy";
import { compareResults } from "../../src/domain/exhibits/comparison";

describe("explainable habit-ranking/1", () => {
  it("different supported histories yield different legal decisions", () => {
    const reckless = deriveProfile([
      { scenario: scenarioFor(0), actions: ["door"] },
    ]);
    const careful = deriveProfile([
      {
        scenario: scenarioFor(0),
        actions: ["inspect", "arch", "inspect", "vent", "gadget", "exit"],
      },
    ]);
    const observation = observe(initialState(scenarioFor(99)));
    expect(decide(reckless, observation)).toMatchObject({ action: "door" });
    expect(decide(careful, observation)).toMatchObject({ action: "inspect" });
    expect(reckless.rooms[0]).toMatchObject({
      entries: 1,
      inspections: 0,
      door: 1,
    });
    expect(careful.rooms[1]).toMatchObject({ entries: 1, inspections: 1 });
    expect(raceGhost(careful, scenarioFor(99)).result.outcome).toBe("escaped");
  });
  it("unseen rooms use only permitted observations", () => {
    const profile = deriveProfile([
      { scenario: scenarioFor(0), actions: ["door"] },
    ]);
    const guard = observe(transition(initialState(scenarioFor(0)), "arch"));
    expect(decide(profile, guard)).toMatchObject({
      action: "wait",
      reason: expect.stringContaining("Unseen room"),
    });
    expect(decide(profile, { ...guard, patrol: "reading" }).action).toBe(
      "sneak",
    );
    expect(guard.clue).toBe("");
  });
  it("never selects unavailable gadgets or acts after terminal", () => {
    const profile = deriveProfile([
      {
        scenario: scenarioFor(0),
        actions: ["arch", "gadget", "sneak", "inspect", "swap", "exit"],
      },
    ]);
    expect(raceGhost(profile, scenarioFor(0)).result.outcome).toBe("escaped");
    expect(() =>
      decide(
        profile,
        observe(transition(initialState(scenarioFor(0)), "door")),
      ),
    ).toThrow();
    expect(() =>
      deriveProfile([{ scenario: scenarioFor(0), actions: ["arch"] }]),
    ).toThrow();
    expect(() =>
      raceGhost({ ...profile, policy: "missing" } as never, scenarioFor(0)),
    ).toThrow();
  });
  it("does not mutate independent starting states or profiles", () => {
    const profile = deriveProfile([]);
    const before = JSON.stringify(profile);
    const first = raceGhost(profile, scenarioFor(0));
    expect(first).toEqual(raceGhost(profile, scenarioFor(0)));
    expect(JSON.stringify(profile)).toBe(before);
    expect(initialState(scenarioFor(0))).toMatchObject({
      turns: 10,
      gadgets: 1,
      alarm: 0,
    });
    expect(compareResults(first.result, first.result)).toBe("tied");
    expect(
      compareResults(
        first.result,
        transition(initialState(scenarioFor(0)), "door"),
      ),
    ).toBe("better");
    expect(() =>
      compareResults(initialState(scenarioFor(0)), first.result),
    ).toThrow();
  });
});
