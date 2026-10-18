import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const directory = "docs/evidence/hero-playback-fix";
for (const portrait of [false, true]) {
  test(`hero keeps advancing after home links and resumes after scrolling: ${portrait ? "portrait" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      portrait ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    await page.goto("/");
    const film = page.locator(".hero-film");
    await expect(film).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    const samples: { label: string; time: number; paused: boolean }[] = [];
    const advancing = async (label: string) => {
      const start = await film.evaluate(
        (v) => (v as HTMLVideoElement).currentTime,
      );
      await expect
        .poll(() => film.evaluate((v) => (v as HTMLVideoElement).currentTime))
        .not.toBe(start);
      const state = await film.evaluate((v) => ({
        time: (v as HTMLVideoElement).currentTime,
        paused: (v as HTMLVideoElement).paused,
      }));
      expect(state.paused).toBe(false);
      samples.push({ label, ...state });
    };
    await advancing("initial automatic playback");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("link", { name: "Soryn home", exact: true }).click();
      await expect(film).toHaveAttribute("data-ready", "true");
      await advancing(`home click ${i + 1}`);
    }
    await page
      .getByRole("link", { name: "Watch gameplay", exact: true })
      .click();
    await expect
      .poll(() => film.evaluate((v) => (v as HTMLVideoElement).paused))
      .toBe(true);
    await page.locator(".gateway-hero").scrollIntoViewIfNeeded();
    await advancing("returned into view");
    await expect(page.locator(".hero-film-control")).toHaveCount(0);
    mkdirSync(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/${portrait ? "portrait" : "desktop"}.png`,
    });
    writeFileSync(
      `${directory}/${portrait ? "portrait" : "desktop"}-playback.json`,
      JSON.stringify(samples, null, 2),
    );
    await page
      .locator(".gateway-hero .gateway-actions")
      .getByRole("link", { name: "Play now", exact: true })
      .click();
    await page.locator('.play-mode[href="/arena"]').click();
    await expect(
      page.getByRole("button", { name: "Enter guest arena" }),
    ).toBeEnabled();
    await expect(film).toHaveCount(0);
  });
}
