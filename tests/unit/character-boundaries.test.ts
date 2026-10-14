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
import { loadoutFor } from "../../src/domain/characters/definitions";
import { decide, deriveProfile } from "../../src/domain/ghosts/policy";
import { frameAtTurn } from "../../src/domain/ghosts/timeline";
import {
  challengeProgress,
  type JournalChapter,
} from "../../src/domain/journal";
import { Store, runSchema } from "../../src/server/persistence";
import { RunService } from "../../src/server/runs";
import { randomUUID } from "node:crypto";

describe("versioned character boundaries", () => {
  it("ability policy ignores unrelated history detail and never receives hidden future patrol or scenario seed", () => {
    const scenario = tacticalScenarioFor(0, "echo"),
      actions: Action[] = ["arch", "skill-trail", "sneak", "gadget", "exit"];
    const profile = deriveProfile([{ scenario, actions }]);
    const observation = observe(initialState(scenario));
    expect(observation.patrol).toBeNull();
    expect(observation).not.toHaveProperty("seed");
    const same = structuredClone(observation);
    same.message = "Unrelated presentation copy";
    expect(decide(profile, same)).toEqual(decide(profile, observation));
    expect(() =>
      deriveProfile([
        { scenario, actions },
        { scenario: tacticalScenarioFor(0, "pip"), actions: ["door"] },
      ]),
    ).toThrow("different loadout");
  });
  it("recorded ability timing produces different legal decisions from the same permitted initial observation", () => {
    const scenario = tacticalScenarioFor(0, "pip");
    const early = deriveProfile([
      {
        scenario,
        actions: [
          "skill-peek",
          "arch",
          "gadget",
          "sneak",
          "inspect",
          "swap",
          "exit",
        ],
      },
    ]);
    const later = deriveProfile([
      { scenario, actions: ["arch", "skill-peek", "vent", "gadget", "exit"] },
    ]);
    const view = observe(initialState(scenario));
    expect(decide(early, view).action).toBe("skill-peek");
    expect(decide(later, view).action).toBe("arch");
  });
  it("spent-turn race coalesces free skills while exact replay retains both before/after frames", () => {
    const frames = replay(tacticalScenarioFor(0, "pip"), [
      "skill-peek",
      "arch",
    ]).map(observe);
    expect(frames[0].tactics?.charges).toBe(1);
    expect(frames[1].tactics?.charges).toBe(0);
    expect(frames[0].turns).toBe(frames[1].turns);
    expect(frameAtTurn(frames, 0).actionIndex).toBe(1);
    expect(frameAtTurn(frames, 1).frame.room).toBe(1);
  });
  it("normalizes remaining budgets and shield duration without letting a bubble resurrect closing time", () => {
    let state = initialState(tacticalScenarioFor(0, "aegis"));
    state = transition(state, "skill-bubble");
    state = transition(state, "arch");
    expect(state.tactics?.effects.bubble).toBe(false);
    state = transition(state, "skill-bubble");
    while (!state.outcome) state = transition(state, "wait");
    expect(state.outcome).toBe("trapped");
    expect(state.turns).toBe(0);
    expect(() => transition(state, "skill-bubble")).toThrow();
  });
  it("legacy persisted records hydrate with null ability state and reject invented v2 loadouts or resources", () => {
    const legacy = {
      id: randomUUID(),
      actor: randomUUID(),
      scenario: scenarioFor(0),
      actions: ["door"],
      mode: "guest",
      exhibitId: null,
      retryOf: null,
      cohort: "first-recorded",
      ghost: null,
    };
    expect(runSchema.parse(legacy).tactics).toBeNull();
    expect(() =>
      runSchema.parse({
        ...legacy,
        tactics: initialState(tacticalScenarioFor(0, "pip")).tactics,
      }),
    ).toThrow();
    expect(() =>
      runSchema.parse({ ...legacy, scenario: tacticalScenarioFor(0, "pip") }),
    ).toThrow();
    expect(replay(scenarioFor(0), ["door"]).at(-1)?.message).toContain(
      "The Door Was Painted",
    );
  });
  it("familiarity follows the authored adventure across old/new versions while profile budgets remain separate", () => {
    const store = new Store(":memory:"),
      runs = new RunService(store),
      actor = randomUUID();
    try {
      const old = runs.start(actor, randomUUID(), null);
      runs.step(actor, old.id, 0, "door");
      const pip = runs.start(actor, randomUUID(), null, null, null, "pip");
      expect(pip.cohort).toBe("informed-retry");
      expect(pip.rival).toBeNull();
      runs.step(actor, pip.id, 0, "door");
      const patch = runs.start(actor, randomUUID(), null, null, null, "patch");
      expect(patch.rival).toBeNull();
      const otherPip = runs.start(actor, randomUUID(), null, null, null, "pip");
      expect(otherPip.rival?.version).toBe(
        runs.view(store.getRun(pip.id, actor)).ghost?.version,
      );
    } finally {
      store.close();
    }
  });
  it("challenge progress never ranks two different loadouts as equivalent", () => {
    const base: JournalChapter = {
      id: "a",
      outcome: "trapped",
      turnsUsed: 2,
      alarm: 0,
      cohort: "informed-retry",
      ghostVersion: null,
      trainingRuns: 1,
      challenge: { id: "same-exhibit", title: "Fixture", available: true },
      comparison: null,
    };
    const groups = challengeProgress([
      { ...base, id: "b", loadout: loadoutFor("patch") },
      { ...base, loadout: loadoutFor("pip") },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.cohorts[0].attempts)).toEqual([1, 1]);
  });
});
