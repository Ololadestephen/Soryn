import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FighterPicker } from "../../src/components/pvp/FighterPicker";

function render(
  holder: boolean,
  startersOnly: boolean,
  selected: "pip" | "aegis" = "pip",
) {
  return renderToStaticMarkup(
    createElement(FighterPicker, {
      selected,
      holder,
      startersOnly,
      disabled: false,
      onSelect: () => {},
    }),
  );
}
it("public selection stays at four starters even for a holder", () => {
  for (const holder of [false, true]) {
    const html = render(holder, true);
    const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(radios).toHaveLength(4);
    expect(radios.filter((r) => r.includes('checked=""'))).toHaveLength(1);
    expect(radios.every((r) => !r.includes('disabled=""'))).toBe(true);
    expect(html).not.toContain('aria-label="Aegis / Guardian"');
  }
});
it("private guest selection identifies eight locked fighters without hiding the selected fighter or companion", () => {
  const html = render(false, false);
  const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(
    (m) => m[0],
  );
  expect(radios).toHaveLength(12);
  expect(radios.filter((r) => r.includes('disabled=""'))).toHaveLength(8);
  expect(html).toContain('aria-label="Pip rendered fighter"');
  expect(html).toContain('aria-label="Owl companion"');
  expect(html).toContain("Chog required");
  expect(html).toContain("Selected fighter");
});
it("eligible private holder previews retain the approved Aegis and armadillo artwork", () => {
  const html = render(true, false, "aegis");
  expect([...html.matchAll(/<input[^>]*disabled=""/g)]).toHaveLength(0);
  expect(html).toContain('aria-label="Aegis rendered fighter"');
  expect(html).toContain('aria-label="Armadillo companion"');
  expect([...html.matchAll(/data-art-source="approved-idle"/g)]).toHaveLength(
    2,
  );
  expect(html).not.toContain("/combat/blender/");
});
