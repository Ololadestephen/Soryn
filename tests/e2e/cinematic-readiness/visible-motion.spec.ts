import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { expect, test } from "@playwright/test";

const evidence = "docs/evidence/world-hero-motion";
for (const portrait of [false, true]) {
  test(`visible environmental motion: ${portrait ? "portrait 3x" : "desktop"}`, async ({
    browser,
    baseURL,
  }) => {
    const label = portrait ? "portrait" : "desktop";
    const viewport = portrait
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 };
    mkdirSync(evidence, { recursive: true });
    const context = await browser.newContext({
      baseURL,
      viewport,
      deviceScaleFactor: portrait ? 3 : 1,
      recordVideo: { dir: `${evidence}/recordings`, size: viewport },
    });
    const page = await context.newPage();
    const video = page.video();
    try {
      await page.goto("/");
      const film = page.locator(".hero-film");
      await expect(film).toHaveAttribute("data-ready", "true", {
        timeout: 20000,
      });
      await expect(film).toHaveAttribute("src", /sanctuary-motion-v4-/);
      // Wait out the poster crossfade; compare fully visible, naturally playing frames.
      await page.waitForTimeout(900);
      const copyBox = await page.locator(".gateway-copy").boundingBox();
      const first = await page.screenshot({
        path: `${evidence}/${label}-a.png`,
      });
      await page.waitForTimeout(3000);
      const second = await page.screenshot({
        path: `${evidence}/${label}-b.png`,
      });
      expect(await page.locator(".gateway-copy").boundingBox()).toEqual(
        copyBox,
      );
      const a = await sharp(first).removeAlpha().raw().toBuffer();
      const b = await sharp(second).removeAlpha().raw().toBuffer();
      expect(a.length).toBe(b.length);
      let changed = 0;
      let delta = 0;
      for (let i = 0; i < a.length; i++) {
        const difference = Math.abs(a[i] - b[i]);
        delta += difference;
        if (difference > 8) changed++;
      }
      const measurement = {
        viewport,
        deviceScaleFactor: portrait ? 3 : 1,
        meanChannelDelta: delta / a.length,
        changedChannelPercent: (changed / a.length) * 100,
        intervalMs: 3000,
      };
      writeFileSync(
        `${evidence}/${label}-visible-motion.json`,
        JSON.stringify(measurement, null, 2),
      );
      // The full world should travel behind the fixed copy, beyond sparse particles.
      expect(measurement.meanChannelDelta).toBeGreaterThan(1);
      expect(measurement.changedChannelPercent).toBeGreaterThan(5);
      expect(await film.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
        false,
      );
      await expect(page.locator(".hero-film-control")).toHaveCount(0);
      await page.waitForTimeout(11000);
      await page.reload();
      await expect(film).toHaveAttribute("data-ready", "true", {
        timeout: 15000,
      });
      await page
        .locator(".gateway-hero .gateway-actions")
        .getByRole("link", { name: "Play now", exact: true })
        .click();
      await page.locator('.play-mode[href="/arena"]').click();
      await expect(
        page.getByRole("button", { name: "Enter guest arena" }),
      ).toBeEnabled();
    } finally {
      await context.close();
      if (video) await video.saveAs(`${evidence}/${label}-actual-page.webm`);
    }
  });
}
