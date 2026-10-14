import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  RenderedArt,
  CompanionArt,
} from "../../src/components/combat/rendered/RenderedArt";
import { fighters, combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import { fighterPose } from "../../src/components/combat/rendered/pose";
import type { BattleView } from "../../src/domain/combat/contracts";

describe("restored rendered artwork", () => {
  it("all twelve pairs isolate their own atlas cells, including repeated identities", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        ...fighters.flatMap((f) => [
          createElement(RenderedArt, { id: f.id, key: f.id }),
          createElement(CompanionArt, { id: f.id, key: `${f.id}-pet` }),
        ]),
        createElement(RenderedArt, { id: "aegis" }),
      ),
    );
    const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
    for (const id of ids) expect(markup).toContain(`clip-path="url(#${id})"`);
    expect(markup).not.toContain("/combat/blender/");
  });
  it("holds executed attack contact, reacts only to real damage and preserves terminal poses", () => {
    const snapshot = combatSnapshot("aegis", "ember"),
      state = initialCombat(snapshot);
    const round = resolveRound(snapshot, state, "special", "special");
    const battle: BattleView = {
      id: "restored",
      mode: "guest",
      tokenId: null,
      snapshot,
      state: round.state,
      rounds: [round.round],
      legal: [],
    };
    const frames = presentationFrames(battle, { ...battle, state, rounds: [] });
    const contact = frames.find(
      (f) =>
        f.event.side === "player" &&
        f.phase === "impact" &&
        f.event.kind === "impact",
    );
    if (!contact) throw new Error("No actual Shield Bash contact");
    expect(fighterPose(contact.event.state, contact, "player")).toBe("strike");
    expect(fighterPose(contact.event.state, contact, "opponent")).toBe("hit");
    const terminal = {
      ...battle.state,
      player: { ...battle.state.player, health: 0 },
    };
    expect(fighterPose(terminal, contact, "player")).toBe("defeated");
    expect(fighterPose(terminal, null, "player")).toBe("defeated");
    const settled = renderToStaticMarkup(
      createElement(CompanionArt, { id: "aegis", settled: true }),
    );
    expect(settled).toContain('data-pose="settled"');
    expect(settled).toContain('data-settled="true"');
  });
});
