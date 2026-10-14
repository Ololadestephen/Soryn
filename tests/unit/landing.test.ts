import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { arenaIds, arenaSuggestion } from "../../src/domain/combat/arenas";
import { characters } from "../../src/domain/characters/definitions";
import { companions } from "../../src/components/combat/rendered/catalogue";
import assets from "../../src/components/site/landing/assets.json";

describe("landing setup suggestions", () => {
  it("accepts catalogue arenas and rejects ambiguous, random and malformed input", () => {
    for (const id of arenaIds) expect(arenaSuggestion(id)).toBe(id);
    for (const value of [
      undefined,
      null,
      [],
      ["sky"],
      ["sky", "grove"],
      "random",
      "Sky",
      "",
      "../sky",
      { arena: "sky" },
    ])
      expect(arenaSuggestion(value)).toBeUndefined();
  });
  it("keeps the complete approved roster and lightweight hero within its image budget", () => {
    expect(Object.keys(assets).sort()).toEqual(
      characters.map((c) => c.id).sort(),
    );
    for (const c of characters) {
      expect(companions[c.id]).toBeTruthy();
      for (const a of [assets[c.id].fighter, assets[c.id].companion]) {
        expect(statSync(`public${a.path}`).size).toBeGreaterThan(0);
        expect(a.width * a.height).toBeLessThan(1000 * 1000);
        expect(a.path).not.toMatch(/\/blender\//);
      }
    }
    expect(
      statSync("public/combat/arenas/sanctuary-portrait.webp").size,
    ).toBeLessThan(200 * 1024);
    expect(
      statSync("public/combat/arenas/sanctuary-desktop.webp").size,
    ).toBeLessThan(512 * 1024);
  });
});
