import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RaceReplay } from "../../src/components/adventure/RaceReplay";
import { Stage } from "../../src/components/adventure/Stage";
import { observe, replay } from "../../src/domain/game/engine";
import { scenarioFor } from "../../src/domain/game/contracts";

describe("race render boundaries", () => {
  const player = replay(scenarioFor(0), [
    "arch",
    "gadget",
    "sneak",
    "inspect",
    "swap",
    "exit",
  ]).map(observe);
  const ghost = replay(scenarioFor(0), ["door"]).map(observe);
  const props = { player, ghost, reasons: ["A recorded door habit."] };
  it("keeps labels and SVG paint references unique across concurrent replays", () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(Stage, { room: 0, sandwich: false, trapped: false }),
        createElement(RaceReplay, props),
        createElement(RaceReplay, props),
      ),
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const references = [...html.matchAll(/fill="url\(#([^\)]+)\)"/g)].map(
      (match) => match[1],
    );
    expect(references).toHaveLength(5);
    for (const reference of references) expect(ids).toContain(reference);
    const labels = [...html.matchAll(/<label for="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(labels).toHaveLength(2);
    for (const label of labels)
      expect(html).toContain(`id="${label}" type="range"`);
  });
  it("starts both lanes at the beginning instead of presenting terminal states as live progress", () => {
    const html = renderToStaticMarkup(createElement(RaceReplay, props));
    expect(html).toContain("Turn 0 of 6");
    expect(html).not.toContain("face-print");
    expect(html).not.toContain("History tastes like mustard");
    expect(html).not.toContain("A recorded door habit.");
    expect(html).toContain('min="0" max="6" step="1"');
  });
});
