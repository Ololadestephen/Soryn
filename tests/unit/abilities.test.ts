import { describe, it, expect } from "vitest";
import {
  initialState,
  observe,
  replay,
  transition,
} from "../../src/domain/game/engine";
import {
  scenarioFor,
  tacticalScenarioFor,
  type Action,
} from "../../src/domain/game/contracts";
import { deriveProfile, raceGhost } from "../../src/domain/ghosts/policy";

describe("first tactical character slice", () => {
  it("Pip reveals a current-room clue for a charge, without advancing time or exposing the next room", () => {
    const start = initialState(tacticalScenarioFor(0, "pip"));
    const peek = transition(start, "skill-peek");
    expect(peek.turns).toBe(10);
    expect(peek.inspected).toBe(true);
    expect(peek.tactics?.charges).toBe(0);
    expect(observe(peek).clue).toContain("brushstrokes");
    expect(observe(peek).clue).not.toContain("pressure plate");
    expect(() => transition(peek, "skill-peek")).toThrow();
    expect(start.inspected).toBe(false);
    const actions: Action[] = [
      "skill-peek",
      "arch",
      "gadget",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ];
    const frames = replay(tacticalScenarioFor(0, "pip"), actions);
    expect(frames.at(-1)?.outcome).toBe("escaped");
    expect(frames.at(-1)?.turns).toBe(4);
    expect(replay(tacticalScenarioFor(0, "pip"), actions)).toEqual(frames);
  });
  it("Patch restores only a consumed gadget, capped at one, and can spend it at extraction", () => {
    const scenario = tacticalScenarioFor(0, "patch");
    expect(() => transition(initialState(scenario), "skill-spare")).toThrow();
    const frames = replay(scenario, [
      "arch",
      "gadget",
      "skill-spare",
      "sneak",
      "gadget",
      "exit",
    ]);
    expect(frames[3].gadgets).toBe(1);
    expect(frames[3].turns).toBe(8);
    expect(frames.at(-1)?.outcome).toBe("escaped");
    expect(frames.at(-1)?.tactics?.charges).toBe(0);
    expect(() => transition(frames[3], "skill-spare")).toThrow();
  });
  it("Aegis absorbs a recoverable painted impact but grants no passage or terminal resurrection", () => {
    const scenario = tacticalScenarioFor(0, "aegis");
    const frames = replay(scenario, ["skill-bubble", "door"]);
    expect(frames.at(-1)).toMatchObject({
      room: 0,
      outcome: null,
      turns: 9,
      alarm: 0,
    });
    expect(frames.at(-1)?.tactics).toMatchObject({
      charges: 1,
      effects: { bubble: false },
    });
    const failed = replay(scenario, ["door"]).at(-1)!;
    expect(failed.outcome).toBe("trapped");
    expect(() => transition(failed, "skill-bubble")).toThrow();
  });
  it("Echo's trail changes the patrol response, expires after two spent guard turns and never consumes the basic decoy", () => {
    const scenario = tacticalScenarioFor(0, "echo");
    const started = replay(scenario, ["arch", "skill-trail"]).at(-1)!;
    expect(started.gadgets).toBe(1);
    expect(started.turns).toBe(9);
    expect(observe(started).distracted).toBe(true);
    const wait = transition(started, "wait");
    expect(wait.tactics?.effects.trail).toBe(1);
    const expired = transition(wait, "wait");
    expect(observe(expired).distracted).toBe(false);
    expect(expired.tactics?.effects.trail).toBe(0);
    const crossed = transition(started, "sneak");
    expect(crossed.room).toBe(2);
    expect(crossed.alarm).toBe(0);
    expect(crossed.tactics?.effects.trail).toBe(0);
    expect(() => transition(initialState(scenario), "skill-trail")).toThrow();
  });
  it("ability ghosts use their own bounded loadout and leave player resources unchanged", () => {
    const scenario = tacticalScenarioFor(0, "patch");
    const actions: Action[] = [
      "arch",
      "gadget",
      "skill-spare",
      "sneak",
      "gadget",
      "exit",
    ];
    const profile = deriveProfile([{ scenario, actions }]);
    const player = initialState(scenario);
    const before = structuredClone(player);
    const ghost = raceGhost(profile, scenario);
    expect(ghost.actions).toContain("skill-spare");
    expect(ghost.result.outcome).toBe("escaped");
    expect(player).toEqual(before);
    let current = initialState(scenario);
    for (const action of ghost.actions) {
      expect(observe(current).choices.map((choice) => choice.action)).toContain(
        action,
      );
      current = transition(current, action);
    }
    expect(() => raceGhost(profile, tacticalScenarioFor(0, "pip"))).toThrow(
      "mismatch",
    );
  });
  it("legacy chapters keep their exact original rules, observations and ghost policy", () => {
    const scenario = scenarioFor(0);
    const actions: Action[] = ["door"];
    const frames = replay(scenario, actions);
    expect(frames.at(-1)?.outcome).toBe("trapped");
    expect(frames[0]).not.toHaveProperty("tactics");
    expect(deriveProfile([{ scenario, actions }]).policy).toBe(
      "habit-ranking/1",
    );
    expect(() => replay(scenario, ["skill-peek"])).toThrow();
  });
});
