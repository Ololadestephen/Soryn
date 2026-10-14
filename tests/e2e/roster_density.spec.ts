import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";
import { fighters } from "../../src/domain/combat/definitions";
const atlases: Record<string, { canvas: number[]; baseline: number }> =
  JSON.parse(
    readFileSync("src/components/combat/rendered/atlas-data.json", "utf8"),
  );

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  reducedMotion: "reduce",
});
test("whole roster · high-density portrait ground and rendered source bounds", async ({
  page,
}) => {
  test.setTimeout(240000);
  const directory = process.env.CHOG_EVIDENCE_DIR
    ? `${process.env.CHOG_EVIDENCE_DIR}/portrait-roster`
    : "docs/evidence/art-restoration/portrait-roster";
  mkdirSync(directory, { recursive: true });
  const official = await visualHolder(page, 1300);
  const results = [];
  for (const fighter of fighters) {
    expect(
      (
        await official({
          operation: "start",
          mode: "official",
          id: randomUUID(),
          characterId: fighter.id,
          opponent: "bolt",
          difficulty: "easy",
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/arena");
    const hero = page.locator(
      `.fighter-player > .fighter-facing .art-${fighter.id}`,
    );
    await expect(hero).toHaveAttribute("data-art-source", "rendered");
    await expect(hero.locator("clipPath rect")).toHaveCount(1);
    const box = await hero.boundingBox(),
      enemy = await page
        .locator(".fighter-opponent > .fighter-facing .rendered-art")
        .boundingBox(),
      controls = await page.locator(".combat-controls").boundingBox();
    if (!box || !enemy || !controls) throw new Error("Missing portrait bounds");
    const own = atlases[fighter.id],
      foe = atlases.bolt;
    const ground =
      box.y +
      box.height -
      (own.canvas[1] - own.baseline) *
        Math.min(box.width / own.canvas[0], box.height / own.canvas[1]);
    const enemyGround =
      enemy.y +
      enemy.height -
      (foe.canvas[1] - foe.baseline) *
        Math.min(enemy.width / foe.canvas[0], enemy.height / foe.canvas[1]);
    expect(Math.abs(ground - enemyGround)).toBeLessThan(2);
    expect(ground).toBeLessThan(controls.y);
    expect(box.width).toBeLessThanOrEqual(Math.max(...own.canvas));
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll<SVGImageElement>(
          ".fighter-facing .rendered-art image, .companion image",
        ),
      ].every((el) => {
        const image = new Image();
        image.src = el.getAttribute("href") ?? "";
        return image.complete && image.naturalWidth > 0;
      }),
    );
    await page.screenshot({ path: `${directory}/${fighter.id}.png` });
    results.push({
      fighter: fighter.id,
      viewport: { width: 390, height: 844 },
      density: 3,
      bounds: box,
      ground,
      enemyGround,
      canvas: own.canvas,
    });
    await official.finish();
  }
  writeFileSync(
    `${directory}/measurements.json`,
    JSON.stringify(results, null, 2),
  );
});
