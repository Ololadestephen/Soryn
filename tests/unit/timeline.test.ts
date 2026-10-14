import { describe, expect, it } from "vitest";
import { scenarioFor } from "../../src/domain/game/contracts";
import { observe, replay } from "../../src/domain/game/engine";
import { frameAtTurn } from "../../src/domain/ghosts/timeline";

describe("race clock uses spent turns", () => {
  const frames = replay(scenarioFor(0), [
    "arch",
    "inspect",
    "vent",
    "gadget",
    "exit",
  ]).map(observe);
  it("holds the vent entry until the two-turn move finishes", () => {
    expect(frameAtTurn(frames, 0)).toEqual({
      frame: frames[0],
      actionIndex: 0,
      inTransit: false,
    });
    expect(frameAtTurn(frames, 2)).toEqual({
      frame: frames[2],
      actionIndex: 2,
      inTransit: false,
    });
    expect(frameAtTurn(frames, 3)).toEqual({
      frame: frames[2],
      actionIndex: 2,
      inTransit: true,
    });
    expect(frameAtTurn(frames, 4)).toEqual({
      frame: frames[3],
      actionIndex: 3,
      inTransit: false,
    });
    expect(frameAtTurn(frames, 4).frame.room).toBe(2);
  });
  it("holds finished lanes independently and does not mutate frames", () => {
    const snapshot = structuredClone(frames);
    const short = replay(scenarioFor(0), ["door"]).map(observe);
    expect(frameAtTurn(short, 3).frame.outcome).toBe("trapped");
    expect(frameAtTurn(short, 3).inTransit).toBe(false);
    expect(frameAtTurn(frames, 3).frame.outcome).toBeNull();
    expect(frameAtTurn(frames, 10).frame.outcome).toBe("escaped");
    expect(frameAtTurn(frames, 10).inTransit).toBe(false);
    expect(frames).toEqual(snapshot);
  });
  it("rejects absent frames and invalid clock inputs", () => {
    expect(() => frameAtTurn([], 0)).toThrow("replay needs");
    for (const turn of [-1, 0.5, NaN])
      expect(() => frameAtTurn(frames, turn)).toThrow("integer turn");
  });
});
