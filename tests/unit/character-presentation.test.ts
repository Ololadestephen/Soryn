import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { characters } from "../../src/domain/characters/definitions";
import { Portrait } from "../../src/components/characters/Portrait";
import { CharacterSelection } from "../../src/components/characters/Selection";
import { AbilityStatus } from "../../src/components/characters/AbilityStatus";
import {
  initialState,
  observe,
  transition,
} from "../../src/domain/game/engine";
import { tacticalScenarioFor } from "../../src/domain/game/contracts";

describe("character presentation contracts", () => {
  it("gives all twelve original portraits distinct geometry rather than just distinct colours or names", () => {
    const silhouettes = characters.map((entry) => {
      const html = renderToStaticMarkup(
        createElement(Portrait, { id: entry.id }),
      );
      expect(html).toContain(`aria-label="${entry.name}, original`);
      return [...html.matchAll(/<(?:path|rect|circle|ellipse|g)\b[^>]*>/g)]
        .map(([tag]) =>
          tag.replace(
            /\s(?:fill|stroke|opacity|class|stroke-width|stroke-linejoin)="[^"]*"/g,
            "",
          ),
        )
        .join("");
    });
    expect(new Set(silhouettes).size).toBe(12);
  });
  it("keeps eight guest classes locked, exposes four native radios, and retains starter budgets in the holder roster", () => {
    const guest = renderToStaticMarkup(
      createElement(CharacterSelection, {
        selected: "pip",
        onSelect: () => {},
      }),
    );
    expect(guest.match(/type="radio"/g) ?? []).toHaveLength(4);
    expect(guest.match(/Locked · verify current/g) ?? []).toHaveLength(8);
    const holder = renderToStaticMarkup(
      createElement(CharacterSelection, {
        selected: "pip",
        onSelect: () => {},
        holder: true,
      }),
    );
    expect(holder.match(/type="radio"/g) ?? []).toHaveLength(12);
    expect(holder).toContain("Starter · 1 charge");
    expect(holder).toContain("before every official action");
  });
  it("shows actual pending commitments and exhausted resources rather than decorative skill state", () => {
    const mneme = transition(
      initialState(tacticalScenarioFor(0, "mneme")),
      "commit-door",
    );
    expect(
      renderToStaticMarkup(
        createElement(AbilityStatus, { observation: observe(mneme) }),
      ),
    ).toContain("Committed door; outcome unresolved");
    const pip = transition(
      initialState(tacticalScenarioFor(0, "pip")),
      "skill-peek",
    );
    const rendered = renderToStaticMarkup(
      createElement(AbilityStatus, { observation: observe(pip) }),
    );
    expect(rendered).toContain("0 / 1 charges left");
    expect(rendered).toContain("exhausted");
  });
});
