import { describe, it, expect } from "vitest";
import { stageLayout } from "../../src/domain/combat/presentation/layout";
import {
  frameSounds,
  impactFeel,
  feelDuration,
} from "../../src/domain/combat/presentation/feel";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import type { BattleView } from "../../src/domain/combat/contracts";

function encounter(weak = false) {
  const snapshot = combatSnapshot("aegis", "ember"),
    initial = initialCombat(snapshot);
  if (weak) initial.player.health = 1;
  const resolved = resolveRound(snapshot, initial, "special", "special");
  const battle: BattleView = {
    id: "feel-fixture",
    snapshot,
    mode: "guest",
    tokenId: null,
    state: resolved.state,
    rounds: [resolved.round],
    legal: [],
  };
  return {
    battle,
    frames: presentationFrames(battle, {
      ...battle,
      state: initial,
      rounds: [],
    }),
  };
}
describe("authoritative combat feel", () => {
  it("audio and hit-stop require real contact, never anticipation or cancelled attacks", () => {
    const { battle, frames } = encounter();
    const contact = frames.find(
      (f) =>
        f.phase === "impact" &&
        f.event.side === "player" &&
        f.event.kind === "impact",
    );
    if (!contact) throw new Error("Missing actual Shield Bash contact");
    expect(frameSounds(battle, contact)).toContain("special-aegis");
    expect(impactFeel(contact)).toMatchObject({
      contact: true,
      strong: true,
      stopMs: 65,
    });
    for (const frame of frames.filter(
      (f) => f.phase === "anticipation" || f.phase === "action",
    )) {
      expect(frameSounds(battle, frame)).toEqual([]);
      expect(impactFeel(frame).contact).toBe(false);
    }
    const cancelled = encounter(true).frames.filter(
      (f) => f.event.kind === "cancel",
    );
    expect(cancelled.length).toBeGreaterThan(0);
    for (const frame of cancelled) {
      expect(frameSounds(battle, frame)).toEqual([]);
      expect(impactFeel(frame).contact).toBe(false);
    }
    expect(feelDuration(contact, true)).toBe(200);
    expect(battle.rounds.flatMap((round) => round.events)).toContain(
      contact.event,
    );
  });
  it("portrait stage uses more of its compact field without enlarging pixels or crossing HUD/controls", () => {
    for (const [width, height, hud, controls] of [
      [320, 640, 220, 520],
      [390, 844, 210, 710],
      [430, 932, 210, 790],
      [844, 390, 160, 298],
      [1280, 800, 190, 680],
      [320, 640, 290, 440],
    ]) {
      const layout = stageLayout(width, height, hud, controls, 418);
      expect(layout.fighterSize).toBeLessThanOrEqual(418);
      expect(layout.fighterSize).toBeLessThanOrEqual(layout.fieldHeight);
      expect(layout.fieldTop).toBeGreaterThan(hud);
      expect(layout.fieldTop + layout.fieldHeight).toBeLessThan(controls);
      if (width <= 700 && height > 500)
        expect(layout.fighterSize / layout.fieldHeight).toBeGreaterThan(0.58);
    }
  });
});
