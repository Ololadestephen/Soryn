import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { FighterArt } from "../../src/components/combat/FighterArt";
import { Arena } from "../../src/components/combat/Arena";
import { fighters, combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { type BattleView } from "../../src/domain/combat/contracts";
import { presentationFrames } from "../../src/components/combat/playback";

describe("authoritative full-body combat presentation", () => {
  it("has twelve distinct tall vector models beyond names and colours", () => {
    const geometries = fighters.map((fighter) => {
      const markup = renderToStaticMarkup(
        createElement(FighterArt, { id: fighter.id }),
      );
      expect(markup).toContain('viewBox="0 0 180 300"');
      expect(markup).toContain("combat-arm arm-front");
      expect(markup).toContain("combat-arm arm-back");
      return markup
        .replace(/#[0-9a-f]{6}/gi, "colour")
        .replace(/aria-label="[^"]*"/g, "")
        .replace(/art-[a-z]+/g, "art");
    });
    expect(new Set(geometries).size).toBe(12);
  });
  it("health updates at returned impact frames and a cancelled attack has no projectile", () => {
    const snapshot = combatSnapshot("bolt", "pip"),
      start = initialCombat(snapshot);
    start.opponent.health = 5;
    const resolved = resolveRound(snapshot, start, "basic", "special");
    const battle: BattleView = {
      id: "presentation-fixture",
      mode: "guest",
      tokenId: null,
      snapshot,
      state: resolved.state,
      rounds: [resolved.round],
      legal: [],
    };
    const approach = resolved.round.events.find(
      (event) => event.kind === "melee",
    )!;
    const impact = resolved.round.events.find(
      (event) => event.kind === "impact",
    )!;
    expect(approach.state.opponent.health).toBe(5);
    expect(impact.state.opponent.health).toBe(0);
    const frames = presentationFrames(battle, null);
    expect(
      frames.find((frame) => frame.event.kind === "impact")?.approach,
    ).toBe("player");
    expect(
      frames.find((frame) => frame.event.kind === "return")?.approach,
    ).toBeNull();
    expect(
      frames.find((frame) => frame.event.kind === "cancel")?.approach,
    ).toBeNull();
    const cancelled = resolved.round.events.find(
      (event) => event.kind === "cancel",
    )!;
    const markup = renderToStaticMarkup(
      createElement(Arena, {
        battle,
        state: cancelled.state,
        presentation: {
          event: cancelled,
          previous: impact.state,
          approach: null,
          guarding: [],
        },
      }),
    );
    expect(markup).not.toContain('class="combat-projectile');
    expect(markup).not.toContain("combat-melee");
    expect(markup).toContain("knocked out");
    expect(markup).toContain("0 / 84");
  });
  it("a slower prepared defence remains visibly active through the opponent's impact", () => {
    const snapshot = combatSnapshot("moss", "bolt"),
      start = initialCombat(snapshot);
    const resolved = resolveRound(snapshot, start, "guard", "special");
    const battle: BattleView = {
      id: "defence-fixture",
      mode: "guest",
      tokenId: null,
      snapshot,
      state: resolved.state,
      rounds: [resolved.round],
      legal: [],
    };
    const frames = presentationFrames(battle, null);
    expect(
      frames.find((frame) => frame.event.kind === "impact")?.guarding,
    ).toContain("player");
    expect(frames.at(-1)?.guarding).toEqual([]);
  });
});
