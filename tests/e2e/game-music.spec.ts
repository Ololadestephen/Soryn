import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`music persists across navigation and respects mute · ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const effects: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/combat/audio/")) effects.push(r.url());
    });
    await page.goto("/");
    const music = page.locator("audio[data-game-soundtrack]");
    await expect(music).toHaveCount(1);
    expect(
      await music.evaluate((a: HTMLAudioElement) => ({
        paused: a.paused,
        time: a.currentTime,
        loop: a.loop,
        preload: a.preload,
      })),
    ).toEqual({ paused: true, time: 0, loop: true, preload: "none" });
    await page
      .locator(".gateway-actions")
      .getByRole("link", { name: "Play now", exact: true })
      .click();
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
      .toBeGreaterThan(0.2);
    const time = await music.evaluate((a: HTMLAudioElement) => a.currentTime);
    await page.locator('.play-mode[href="/arena"]').click();
    await expect(music).toHaveCount(1);
    expect(
      await music.evaluate((a: HTMLAudioElement) => a.currentTime),
    ).toBeGreaterThanOrEqual(time);
    const volume = page.getByLabel("Music volume", { exact: true });
    await volume.press("Home");
    for (let i = 0; i < 3; i++) await volume.press("ArrowRight");
    await page.getByLabel("Music on", { exact: true }).uncheck();
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.paused))
      .toBe(true);
    expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(
      0.15,
    );
    await page.reload();
    await expect(
      page.getByLabel("Music on", { exact: true }),
    ).not.toBeChecked();
    expect(await music.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await page.getByLabel("Music on", { exact: true }).check();
    await expect
      .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
      .toBeGreaterThan(0.2);
    expect(effects).toEqual([]);
    await page
      .getByRole("button", { name: "Enter guest arena", exact: true })
      .click();
    await expect(page.locator(".arena-fighter")).toHaveCount(2);
    expect(effects).toEqual([]);
  });
}
test("missing music does not block navigation or Practice", async ({
  page,
}) => {
  await page.route("**/music/legionnaire.m4a", (route) => route.abort());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/start");
  await page.locator('.play-mode[href="/arena"]').click();
  await page
    .getByRole("button", { name: "Enter guest arena", exact: true })
    .click();
  await expect(page.locator(".arena-fighter")).toHaveCount(2);
  expect(errors).toEqual([]);
});
