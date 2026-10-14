import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { visualHolder } from "../../browser-support/visual-holder";
for (const mobile of [false, true]) {
  test.describe(mobile ? "portrait quality" : "desktop quality", () => {
    test.use({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      deviceScaleFactor: mobile ? 3 : 2,
    });
    test(`matched original/delivery artwork at ${mobile ? "DPR3 portrait" : "DPR2 desktop"}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(120000);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      const official = await visualHolder(page, 1300);
      expect(
        (
          await official({
            operation: "start",
            mode: "official",
            id: randomUUID(),
            characterId: "aegis",
            opponent: "ember",
            difficulty: "easy",
            arena: "sanctuary",
          })
        ).ok(),
      ).toBe(true);
      const dir = "docs/evidence/cinematic-readiness/after";
      mkdirSync(dir, { recursive: true });
      const pattern = "**/combat/delivery/*.webp";
      await page.route(pattern, (route) =>
        route.fulfill({
          path: `public${new URL(route.request().url()).pathname.replace("/delivery/", "/crisp/")}`,
          contentType: "image/webp",
        }),
      );
      for (const source of ["original", "delivery"]) {
        if (source === "delivery") await page.unroute(pattern);
        await page.goto("/arena");
        await expect(
          page.getByRole("button", { name: /^Basic attack/ }),
        ).toBeEnabled();
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important}",
        });
        const pixels = await page.screenshot({
          path: `${dir}/quality-${mobile ? "portrait" : "desktop"}-${source}.png`,
        });
        const density = mobile ? 3 : 2;
        const viewport = page.viewportSize()!;
        for (const side of ["player", "opponent"]) {
          const box = await page
            .locator(`.fighter-${side} > .fighter-facing`)
            .boundingBox();
          if (!box) throw new Error("Missing fighter bounds");
          const left = Math.max(0, Math.floor(box.x * density));
          const top = Math.max(0, Math.floor(box.y * density));
          const right = Math.min(
            viewport.width * density,
            Math.ceil((box.x + box.width) * density),
          );
          const bottom = Math.min(
            viewport.height * density,
            Math.ceil((box.y + box.height) * density),
          );
          await sharp(pixels)
            .extract({ left, top, width: right - left, height: bottom - top })
            .png()
            .toFile(
              `${dir}/quality-${mobile ? "portrait" : "desktop"}-${source}-${side}.png`,
            );
        }
      }
      await official.finish();
    });
  });
}
