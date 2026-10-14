import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";

const phase = process.env.CHOG_ART_PHASE === "before" ? "before" : "after";
for (const screen of [
  { name: "desktop", width: 1280, height: 800, density: 2 },
  { name: "portrait", width: 390, height: 844, density: 3 },
]) {
  test.describe(screen.name, () => {
    test.use({
      viewport: { width: screen.width, height: screen.height },
      deviceScaleFactor: screen.density,
      reducedMotion: "reduce",
    });
    test(`art comparison · ${screen.name} same framing and density`, async ({
      page,
    }) => {
      test.setTimeout(150000);
      const directory =
        process.env.CHOG_EVIDENCE_DIR ??
        `docs/evidence/art-restoration/${phase}`;
      mkdirSync(directory, { recursive: true });
      const official = await visualHolder(page, 1300);
      for (const [fighter, opponent] of [
        ["aegis", "ember"],
        ["pip", "prism"],
      ]) {
        expect(
          (
            await official({
              operation: "start",
              mode: "official",
              id: randomUUID(),
              characterId: fighter,
              opponent,
              difficulty: "easy",
            })
          ).ok(),
        ).toBe(true);
        await page.goto("/arena");
        await expect(page.locator(".battle-stage")).toBeVisible();
        if (phase === "before" && fighter === "aegis") {
          await expect(
            page.locator('[data-blender-pilot="aegis"]'),
          ).toBeVisible();
          await page.screenshot({
            path: `${directory}/${screen.name}-pilot.png`,
          });
          // Show the approved legacy renderer at identical framing, using its actual loading fallback.
          await page.route("**/combat/blender/*", (route) => route.abort());
          await page.reload();
        }
        const actors = page.locator(
          ".fighter-player > .fighter-facing .rendered-art, .fighter-opponent > .fighter-facing .rendered-art",
        );
        await expect(actors).toHaveCount(2);
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
        await page.screenshot({
          path: `${directory}/${screen.name}-${fighter}-${opponent}.png`,
        });
        for (const side of ["player", "opponent"]) {
          await page.locator(`.fighter-${side} > .fighter-facing`).screenshot({
            path: `${directory}/${screen.name}-${fighter}-${opponent}-${side}.png`,
          });
        }
        const metrics = await actors.evaluateAll((elements) =>
          elements.map((el) => {
            const box = el.getBoundingClientRect(),
              style = getComputedStyle(el);
            const image = el.querySelector("image"),
              facing = el.closest(".fighter-facing");
            return {
              label: el.getAttribute("aria-label"),
              viewBox: el.getAttribute("viewBox"),
              image: image?.getAttribute("href"),
              width: box.width,
              height: box.height,
              x: box.x,
              y: box.y,
              density: devicePixelRatio,
              filter: style.filter,
              opacity: style.opacity,
              transform: style.transform,
              facingTransform: facing
                ? getComputedStyle(facing).transform
                : null,
            };
          }),
        );
        writeFileSync(
          `${directory}/${screen.name}-${fighter}-${opponent}.json`,
          JSON.stringify(metrics, null, 2),
        );
        if (phase === "after") {
          const legacyDirectory =
            "docs/evidence/art-restoration/matched-legacy";
          mkdirSync(legacyDirectory, { recursive: true });
          await page.route("**/combat/{crisp,delivery}/*", (route) =>
            route.abort(),
          );
          await page.reload();
          await expect(actors.first()).toHaveAttribute(
            "data-art-source",
            "legacy-fallback",
          );
          await expect(actors.last()).toHaveAttribute(
            "data-art-source",
            "legacy-fallback",
          );
          await page.screenshot({
            path: `${legacyDirectory}/${screen.name}-${fighter}-${opponent}.png`,
          });
          const legacyMetrics = await actors.evaluateAll((elements) =>
            elements.map((el) => {
              const box = el.getBoundingClientRect();
              return {
                width: box.width,
                height: box.height,
                density: devicePixelRatio,
              };
            }),
          );
          expect(legacyMetrics).toEqual(
            metrics.map(({ width, height, density }) => ({
              width,
              height,
              density,
            })),
          );
          await page.unroute("**/combat/{crisp,delivery}/*");
        }
        await official.finish();
      }
    });
  });
}
