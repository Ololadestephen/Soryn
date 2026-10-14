import { describe, it, expect } from "vitest";
import {
  tacticalScenarioFor,
  type Action,
} from "../../src/domain/game/contracts";
import {
  characters,
  loadoutFor,
  loadoutSchema,
} from "../../src/domain/characters/definitions";
import {
  initialState,
  observe,
  replay,
  transition,
} from "../../src/domain/game/engine";
import { deriveProfile, raceGhost } from "../../src/domain/ghosts/policy";
const winningPaths: Record<string, Action[]> = {
  pip: ["skill-peek", "arch", "gadget", "sneak", "inspect", "swap", "exit"],
  patch: ["arch", "gadget", "skill-spare", "sneak", "gadget", "exit"],
  bolt: ["arch", "inspect", "skill-shortcut", "gadget", "exit"],
  moss: ["arch", "sneak", "skill-calm", "sneak", "inspect", "swap", "exit"],
  aegis: [
    "skill-bubble",
    "door",
    "arch",
    "gadget",
    "sneak",
    "inspect",
    "swap",
    "exit",
  ],
  echo: ["arch", "skill-trail", "sneak", "gadget", "exit"],
  nyx: ["arch", "skill-shadow", "gadget", "exit"],
  prism: ["arch", "skill-lens", "vent", "skill-lens", "swap", "exit"],
  atlas: ["arch", "gadget", "sneak", "skill-steady", "take", "exit"],
  flux: [
    "arch",
    "inspect-mechanism",
    "wait",
    "skill-reroute",
    "sneak",
    "inspect-mechanism",
    "skill-reroute",
    "take",
    "exit",
  ],
  ember: ["arch", "inspect-mechanism", "skill-breakthrough", "gadget", "exit"],
  mneme: [
    "arch",
    "inspect",
    "vent",
    "commit-take",
    "skill-second-thought",
    "inspect",
    "swap",
    "exit",
  ],
};
describe("complete twelve-class tactical rules", () => {
  it.each(characters)(
    "$name has a validated winning path, working ability, deterministic replay and a legal ability-using ghost",
    (entry) => {
      const scenario = tacticalScenarioFor(0, entry.id),
        actions = winningPaths[entry.id];
      const frames = replay(scenario, actions);
      expect(frames.at(-1)?.outcome).toBe("escaped");
      expect(frames.at(-1)?.tactics?.charges).toBeLessThan(
        scenario.loadout.charges,
      );
      expect(
        frames.at(-1)?.tactics?.events.map((event) => event.action),
      ).toEqual(actions);
      expect(
        frames.every(
          (frame) =>
            frame.turns >= 0 &&
            frame.alarm >= 0 &&
            frame.alarm <= 3 &&
            frame.gadgets >= 0 &&
            frame.gadgets <= 1,
        ),
      ).toBe(true);
      expect(replay(scenario, actions)).toEqual(frames);
      const ghost = raceGhost(deriveProfile([{ scenario, actions }]), scenario);
      expect(ghost.actions).toContain(entry.skill);
      let state = initialState(scenario);
      for (const action of ghost.actions) {
        expect(observe(state).choices.map((choice) => choice.action)).toContain(
          action,
        );
        state = transition(state, action);
      }
      expect(ghost.result).toEqual(state);
      expect(() => transition(frames.at(-1)!, entry.skill)).toThrow();
    },
  );
  it.each([0, 1])(
    "every starter completes patrol seed %s using the preserved non-ability solution",
    (seed) => {
      for (const id of ["pip", "bolt", "patch", "moss"] as const)
        expect(
          replay(tacticalScenarioFor(seed, id), [
            "arch",
            "inspect",
            "vent",
            "gadget",
            "exit",
          ]).at(-1)?.outcome,
        ).toBe("escaped");
    },
  );
  it("Bolt must discover the vent and saves exactly one turn over ordinary passage", () => {
    const scenario = tacticalScenarioFor(0, "bolt");
    expect(() =>
      transition(initialState(scenario), "skill-shortcut"),
    ).toThrow();
    const found = replay(scenario, ["arch", "inspect"]).at(-1)!;
    expect(
      transition(found, "skill-shortcut").turns -
        transition(found, "vent").turns,
    ).toBe(1);
  });
  it("Moss cannot reduce zero alarm and reduces exactly one existing level without advancing patrol", () => {
    const scenario = tacticalScenarioFor(0, "moss");
    expect(() => transition(initialState(scenario), "skill-calm")).toThrow();
    const caught = replay(scenario, ["arch", "sneak"]).at(-1)!;
    const calm = transition(caught, "skill-calm");
    expect(calm.alarm).toBe(caught.alarm - 1);
    expect(calm.patrol).toBe(caught.patrol);
    expect(calm.turns).toBe(caught.turns);
  });
  it("Prism reveals current-room mechanisms as well as route clues and never grants objective/future knowledge", () => {
    const first = transition(
      initialState(tacticalScenarioFor(0, "prism")),
      "skill-lens",
    );
    expect(first.tactics?.mechanismKnown).toBe(true);
    expect(first.inspected).toBe(true);
    expect(observe(first).clue).not.toContain("pressure plate");
    expect(() => transition(first, "skill-lens")).toThrow();
    const second = transition(transition(first, "arch"), "skill-lens");
    expect(observe(second).clue).toContain("delivery hatch");
    expect(second.tactics?.charges).toBe(0);
    expect(second.sandwich).toBe(false);
  });
  it("Atlas prepares a safe separate Grab and cannot activate outside the objective step", () => {
    const scenario = tacticalScenarioFor(0, "atlas");
    expect(() => transition(initialState(scenario), "skill-steady")).toThrow();
    const found = replay(scenario, ["arch", "gadget", "sneak"]).at(-1)!;
    const ready = transition(found, "skill-steady");
    expect(ready.sandwich).toBe(false);
    expect(ready.turns).toBe(found.turns);
    const taken = transition(ready, "take");
    expect(taken.sandwich).toBe(true);
    expect(taken.alarm).toBe(0);
    expect(taken.turns).toBe(ready.turns - 1);
    expect(taken.tactics?.effects.steady).toBe(false);
  });
  it("Flux reroutes only a discovered compatible obstacle, expires on unrelated actions and cannot force the painted door", () => {
    const scenario = tacticalScenarioFor(0, "flux");
    expect(() => transition(initialState(scenario), "skill-reroute")).toThrow();
    const known = replay(scenario, ["arch", "inspect-mechanism", "wait"]).at(
      -1,
    )!;
    expect(known.patrol).toBe("watching");
    const ready = transition(known, "skill-reroute");
    expect(transition(ready, "sneak")).toMatchObject({ room: 2, alarm: 0 });
    const wasted = transition(ready, "wait");
    expect(wasted.tactics?.effects.reroute).toBe(false);
    expect(() =>
      transition(initialState(scenario), "skill-breakthrough"),
    ).toThrow();
  });
  it("Ember must discover the hatch, spends a turn and raises alarm without awarding lunch or immunity", () => {
    const scenario = tacticalScenarioFor(0, "ember");
    expect(() =>
      transition(initialState(scenario), "skill-breakthrough"),
    ).toThrow();
    const known = replay(scenario, ["arch", "inspect-mechanism"]).at(-1)!;
    const forced = transition(known, "skill-breakthrough");
    expect(forced).toMatchObject({
      room: 2,
      alarm: 1,
      sandwich: false,
      turns: known.turns - 1,
    });
    const captured = replay(scenario, [
      "arch",
      "sneak",
      "inspect-mechanism",
      "skill-breakthrough",
    ]).at(-1)!;
    expect(captured.outcome).toBe("trapped");
    expect(captured.alarm).toBe(3);
  });
  it("Mneme commits and cancels before resolution, preserves history and cannot undo or exceed two charges", () => {
    const scenario = tacticalScenarioFor(0, "mneme");
    const plan = transition(initialState(scenario), "commit-door");
    expect(plan).toMatchObject({ outcome: null, turns: 10 });
    expect(plan.tactics?.pending).toBe("door");
    expect(observe(plan).message).not.toContain("Was Painted");
    expect(() => transition(plan, "inspect")).toThrow();
    const cancelled = transition(plan, "skill-second-thought");
    expect(cancelled.tactics?.events.map((event) => event.kind)).toEqual([
      "commit",
      "cancel",
    ]);
    expect(cancelled.tactics?.charges).toBe(1);
    expect(cancelled.turns).toBe(10);
    const twice = replay(scenario, [
      "commit-door",
      "skill-second-thought",
      "commit-door",
      "skill-second-thought",
      "commit-door",
    ]).at(-1)!;
    expect(() => transition(twice, "skill-second-thought")).toThrow();
    const resolved = transition(twice, "resolve-choice");
    expect(resolved.outcome).toBe("trapped");
    expect(resolved.turns).toBe(9);
    expect(() => transition(resolved, "skill-second-thought")).toThrow();
  });
  it("budgets are tied to class, never ownership count or an arbitrary submitted charge number", () => {
    expect(loadoutFor("pip").charges).toBe(1);
    expect(loadoutFor("nyx").charges).toBe(2);
    expect(() =>
      loadoutSchema.parse({ ...loadoutFor("pip"), charges: 2 }),
    ).toThrow();
    const scenario = tacticalScenarioFor(0, "pip");
    expect(() => transition(initialState(scenario), "skill-shadow")).toThrow();
  });
});
