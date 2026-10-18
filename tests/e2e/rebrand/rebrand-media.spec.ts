import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("gameplay loads only on request, plays the real clip, pauses offscreen and closes", async ({
  page,
}) => {
  const videoRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/gameplay\/.+\.(mp4|webm)/.test(r.url())) videoRequests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Soryn",
  );
  expect(videoRequests).toEqual([]);
  await expect(page.locator("#gameplay video")).toHaveCount(0);
  await page.getByRole("link", { name: "Watch gameplay", exact: true }).click();
  await expect(page.locator(".gameplay-frame img")).toBeVisible();
  expect(videoRequests).toEqual([]);
  const play = page.getByRole("button", { name: "Play gameplay", exact: true });
  await play.focus();
  await page.keyboard.press("Enter");
  const video = page.locator("#gameplay video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((e: HTMLVideoElement) => e.currentTime))
    .toBeGreaterThan(0.1);
  expect(videoRequests.length).toBeGreaterThan(0);
  await page.locator("#gameplay").screenshot({
    path: `${process.env.CHOG_EVIDENCE_DIR ?? "docs/evidence/game-rebrand/after"}/gameplay-showcase.png`,
  });
  expect(
    await video.evaluate((e: HTMLVideoElement) => ({
      muted: e.muted,
      controls: e.controls,
      width: e.videoWidth,
      height: e.videoHeight,
    })),
  ).toEqual({ muted: true, controls: true, width: 1280, height: 800 });
  await page.getByRole("button", { name: "Mneme Holder", exact: true }).click();
  await expect
    .poll(() => video.evaluate((e: HTMLVideoElement) => e.paused))
    .toBe(true);
  await page
    .getByRole("button", { name: "Close gameplay", exact: true })
    .click();
  await expect(video).toHaveCount(0);
  await expect(play).toBeVisible();
  await expect(play).toBeFocused();
});

test("failed gameplay retains explicit retry and a working battle link", async ({
  page,
}) => {
  await page.route("**/gameplay/*.mp4", (r) => r.abort());
  await page.goto("/#gameplay");
  await page
    .getByRole("button", { name: "Play gameplay", exact: true })
    .click();
  await expect(page.locator(".media-error")).toContainText("unavailable");
  await page.locator("#gameplay").screenshot({
    path: `${process.env.CHOG_EVIDENCE_DIR ?? "docs/evidence/game-rebrand/after"}/gameplay-unavailable.png`,
  });
  await page.getByRole("button", { name: "Try video again" }).click();
  await expect(page.locator("#gameplay video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play gameplay", exact: true })
    .click();
  await expect(page.locator(".media-error")).toBeVisible();
  await page
    .locator(".media-error")
    .getByRole("link", { name: "Practice" })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
});

test("a missing route retains the game identity and recovery destinations", async ({
  page,
}) => {
  const response = await page.goto("/missing-page-for-rebrand");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This path has faded." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Soryn",
  );
});

test("nested routes reflow in landscape and with enlarged portrait text", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of [
      "/arena",
      "/character",
      "/journal",
      "/museum",
      "/play",
    ]) {
      await page.goto(route);
      if (viewport.width === 320)
        await page.addStyleTag({
          content:
            "body{font-size:200%}p,a,button,summary{font-size:1em!important}",
        });
      const overflow = await page.evaluate(() =>
        Array.from(document.querySelectorAll("body *"))
          .filter((e) => {
            const rect = e.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.right > innerWidth + 1 &&
              getComputedStyle(e).position !== "absolute"
            );
          })
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            right: e.getBoundingClientRect().right,
          })),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} ${viewport.width}px: ${JSON.stringify(overflow)}`,
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  }
});
