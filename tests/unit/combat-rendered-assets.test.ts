import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { fighters } from "../../src/domain/combat/definitions";
import {
  atlases,
  renderedFighters,
  poseCells,
  companions,
} from "../../src/components/combat/rendered/assets";

describe("production rendered atlas boundaries", () => {
  it("every fighter and animal has complete real local pose regions; runtime files retain source alpha and dimensions", async () => {
    for (const atlas of Object.values(atlases)) {
      const master = await sharp(`public${atlas.path}`)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const runtime = await sharp(`public${atlas.path}`).metadata();
      expect(runtime.hasAlpha).toBe(true);
      expect([runtime.width, runtime.height]).toEqual([
        atlas.width,
        atlas.height,
      ]);
      expect(master.info.channels).toBe(4);
      expect(atlas.canvas.every((value) => value > 0)).toBe(true);
      expect(atlas.baseline / atlas.canvas[1]).toBeCloseTo(0.94, 2);
      for (const [x, y, w, h] of atlas.cells) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(atlas.width);
        expect(y + h).toBeLessThanOrEqual(atlas.height);
        let opaque = 0;
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            if (master.data[(py * atlas.width + px) * 4 + 3] > 128) opaque++;
        expect(opaque).toBeGreaterThan(3000);
        expect(opaque).toBeLessThan(w * h * 0.9);
      }
      // Generated antialiasing can leave 1/255 alpha; reject a visible backdrop.
      for (const index of [
        0,
        atlas.width - 1,
        atlas.width * (atlas.height - 1),
        atlas.width * atlas.height - 1,
      ])
        expect(master.data[index * 4 + 3]).toBeLessThanOrEqual(2);
    }
  });
  it("all twelve kits have six fighter poses and three separate companion poses with no vector fallback", () => {
    expect(Object.keys(renderedFighters)).toHaveLength(12);
    expect(new Set(Object.values(companions)).size).toBe(12);
    for (const fighter of fighters) {
      const family = renderedFighters[fighter.id];
      for (const cell of Object.values(poseCells))
        expect(atlases[family.fighter].cells[cell]).toHaveLength(4);
      for (let pose = 0; pose < 3; pose++)
        expect(
          atlases[family.companion].cells[family.companionStart + pose],
        ).toHaveLength(4);
    }
  });
});
