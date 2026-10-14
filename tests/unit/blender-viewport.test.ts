import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { PilotFighter } from "../../src/components/combat/blender/PilotArt";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat } from "../../src/domain/combat/engine";
import type { BattleView } from "../../src/domain/combat/contracts";

describe("paired pilot viewports", () => {
  it("gives both Aegis actors independent explicit frame clips so letterboxing cannot reveal neighbours", () => {
    const snapshot = combatSnapshot("aegis", "aegis");
    const battle: BattleView = {
      id: "paired-pilots",
      mode: "guest",
      tokenId: null,
      snapshot,
      state: initialCombat(snapshot),
      rounds: [],
      legal: [],
    };
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(PilotFighter, { battle, frame: null, side: "player" }),
        createElement(PilotFighter, { battle, frame: null, side: "opponent" }),
      ),
    );
    const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    // Two retained pilot frames plus their separately clipped original-art loading fallbacks.
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(markup).toContain(`clip-path="url(#${id})"`);
    expect(markup.match(/<rect width="208" height="391"/g)).toHaveLength(2);
  });
});
