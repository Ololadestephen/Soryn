import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { combatSnapshot, fighters } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import { moveTreatments } from "../../src/domain/combat/presentation/moves";
import { anatomy } from "../../src/components/combat/art/anatomy";
import { Arena } from "../../src/components/combat/Arena";
import type { BattleView, Move } from "../../src/domain/combat/contracts";
function battle(
  player: BattleView["snapshot"]["player"]["id"],
  foe: BattleView["snapshot"]["player"]["id"],
  move: Move,
  opponent: Move,
) {
  const snapshot = combatSnapshot(player, foe),
    initial = initialCombat(snapshot);
  const result = resolveRound(snapshot, initial, move, opponent);
  const view: BattleView = {
    id: "presentation-v2-fixture",
    mode: "guest",
    tokenId: null,
    snapshot,
    state: result.state,
    rounds: [result.round],
    legal: [],
  };
  return { view, frames: presentationFrames(view, null), result };
}
describe("distinct authoritative presentation/2", () => {
  it("Pip basic and special have different treatments and unchanged server impact frames", () => {
    for (const move of ["basic", "special"] as const) {
      const { view, frames, result } = battle("pip", "bolt", move, "basic");
      expect(
        frames.find(
          (frame) => frame.event.side === "player" && frame.phase === "action",
        )?.treatment?.shape,
      ).toBe(move === "basic" ? "stone" : "lens");
      expect(
        frames
          .filter((frame) => frame.phase === "impact")
          .map((frame) => frame.event.state),
      ).toEqual(
        result.round.events
          .filter((event) => ["impact", "counter", "heal"].includes(event.kind))
          .map((event) => event.state),
      );
      expect(frames.at(-1)?.event.state).toEqual(view.state);
      expect(new Set(frames.map((frame) => frame.id)).size).toBe(frames.length);
      expect(presentationFrames(view, view)).toEqual([]);
    }
  });
  it("24 attacks have typed distinct keys/shapes and twelve bodies differ without costume", () => {
    expect(
      new Set(
        fighters.flatMap((f) => [
          moveTreatments[f.id].basic.key,
          moveTreatments[f.id].special.key,
        ]),
      ).size,
    ).toBe(24);
    for (const f of fighters)
      expect(moveTreatments[f.id].basic.shape).not.toBe(
        moveTreatments[f.id].special.shape,
      );
    for (const part of [
      "torso",
      "legs",
      "frontArm",
      "backArm",
      "head",
    ] as const)
      expect(
        new Set(Object.values(anatomy).map((body) => body[part])).size,
      ).toBe(12);
  });
  it("multi-hit deliveries and impacts have separate identities and no duplicate health delta", () => {
    const { frames } = battle("echo", "pip", "special", "guard");
    const hits = frames.filter(
      (f) => f.event.side === "player" && f.phase === "impact",
    );
    expect(hits).toHaveLength(2);
    expect(hits.map((f) => f.hit)).toEqual([1, 2]);
    expect(hits[0].cue?.amount).toBe(0);
    expect(hits[1].cue?.amount).toBe(8);
    expect(
      frames.filter((f) => f.phase === "action" && f.event.side === "player"),
    ).toHaveLength(2);
    expect(
      frames
        .filter((f) => f.phase !== "impact" && f.event.side === "player")
        .every(
          (f) => f.event.state.opponent.health === f.previous.opponent.health,
        ),
    ).toBe(true);
  });
  it("dodge, block, decoy and counter cues match real mitigation and counter has responding motion", () => {
    expect(
      battle("pip", "nyx", "basic", "guard").frames.find(
        (f) => f.cue?.type === "dodge",
      )?.cue?.amount,
    ).toBe(0);
    expect(
      battle("pip", "pip", "basic", "guard").frames.some(
        (f) => f.cue?.shield === 10,
      ),
    ).toBe(true);
    expect(
      battle("pip", "echo", "basic", "guard").frames.some(
        (f) => f.cue?.decoy === 6,
      ),
    ).toBe(true);
    const { view, frames } = battle("atlas", "aegis", "special", "guard");
    const response = frames.find(
      (f) => f.phase === "action" && f.event.kind === "counter",
    );
    expect(response?.approach).toBe("opponent");
    const impact = frames.find(
      (f) => f.phase === "impact" && f.event.kind === "counter",
    )!;
    expect(impact.cue?.amount).toBe(1);
    expect(
      renderToStaticMarkup(
        createElement(Arena, {
          battle: view,
          state: impact.event.state,
          presentation: impact,
        }),
      ),
    ).toContain("Counter −1 HP");
  });
  it("healing, recoil and burn use numeric state deltas; a cancelled action never delivers", () => {
    const { frames } = battle("ember", "patch", "special", "special");
    expect(
      frames.find((f) => f.cue?.type === "recoil" && f.phase === "impact")?.cue
        ?.amount,
    ).toBe(7);
    expect(
      frames.find((f) => f.cue?.type === "burn" && f.phase === "impact")?.cue
        ?.amount,
    ).toBe(3);
    const heals = frames.filter((f) => f.event.kind === "heal");
    expect(heals[0].phase).toBe("anticipation");
    expect(heals.at(-1)?.phase).toBe("impact");
    expect(heals.at(-1)?.cue?.amount).toBe(14);
  });
});
