import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";
import {
  observePresentation,
  noticeObservations,
} from "../browser-support/presentation-observer";

const maximumNoticeMs = 3000;
const minNoticeDurationMs = 2000;
const maxNoticeDurationMs = 5000;
const oldExpiryBufferMs = 100;

test.use({
  video: { mode: "on", size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
  reducedMotion: "no-preference",
});
test.afterEach(async ({ page, context }, info) => {
  const video = page.video();
  await context.close();
  if (video && info.status === "passed") {
    mkdirSync("docs/evidence/animation-pilot", { recursive: true });
    await video.saveAs(
      `docs/evidence/animation-pilot/${info.title.split(" · ")[0]}.webm`,
    );
  }
});

test("current-notices · latest executed move replaces old notice, resets expiry and clears on result/refresh/rematch", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await observePresentation(page);
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect
    .poll(async () => (await noticeObservations(page)).length)
    .toBe(2);
  const records = await noticeObservations(page),
    first = records[0],
    latest = records[1];
  expect(latest.at - first.at).toBeLessThan(maximumNoticeMs);
  expect(first.removed).toBeLessThan(first.at + maximumNoticeMs);
  await expect(page.locator(".move-notice")).toHaveCount(1);
  const untilOldExpiry = await page.evaluate(
    (at) => Math.max(0, at - performance.now()),
    first.at + maximumNoticeMs + oldExpiryBufferMs,
  );
  await page.waitForTimeout(untilOldExpiry);
  await expect(page.locator(".move-notice")).toHaveAttribute(
    "data-notice-id",
    latest.id,
  );
  await expect(page.locator(".move-notice")).toHaveCount(0, { timeout: 2500 });
  const expired = (await noticeObservations(page)).at(-1);
  if (!expired?.removed) throw new Error("No recorded notice dismissal");
  // Exact 3000ms timer scheduling is covered deterministically in unit tests;
  // browser assertions verify replacement outlived the initial window and dismissed without hanging.
  expect(expired.removed).toBeGreaterThan(first.at + maximumNoticeMs);
  expect(expired.removed - expired.at).toBeGreaterThanOrEqual(
    minNoticeDurationMs,
  );
  expect(expired.removed - expired.at).toBeLessThan(maxNoticeDurationMs);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let n = 0; n < 20; n++) {
    if (
      await page
        .getByRole("button", { name: "Rematch", exact: true })
        .isVisible()
    )
      break;
    const special = page.getByRole("button", { name: /^Special/ });
    await (
      (await special.isEnabled())
        ? special
        : page.getByRole("button", { name: /^Basic attack/ })
    ).click();
    await expect
      .poll(
        async () =>
          (await page.getByRole("button", { name: /^Defence/ }).isEnabled()) ||
          (await page
            .getByRole("button", { name: "Rematch", exact: true })
            .isVisible()),
        { timeout: 15000 },
      )
      .toBe(true);
  }
  await expect(
    page.getByRole("region", { name: "Battle result" }),
  ).toBeVisible();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  const all = await noticeObservations(page);
  expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
  await page.screenshot({ path: "docs/evidence/animation-pilot/result.png" });
  await page.waitForTimeout(3100);
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(page.locator(".move-notice")).toBeVisible();
  expect(all.some((n) => n.id === latest.id)).toBe(true);
  expect(
    await page.locator(".move-notice").getAttribute("data-notice-id"),
  ).not.toBe(latest.id);
});

test("portrait-ground · signed Aegis/Ember share ground, cooldown meaning, HUD bounds and observed playback", async ({
  page,
  browser,
}) => {
  const official = await visualHolder(page);
  expect(
    (
      await official({
        operation: "start",
        mode: "official",
        id: randomUUID(),
        characterId: "aegis",
        opponent: "ember",
        difficulty: "medium",
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/arena");
  await expect(page.locator(".status-player")).toContainText("Cooldown 0");
  await expect(
    page.locator('.fighter-player .art-aegis[data-art-source="rendered"]'),
  ).toBeVisible();
  const player = await page.locator(".fighter-player").boundingBox(),
    opponent = await page.locator(".fighter-opponent").boundingBox();
  if (!player || !opponent) throw new Error("Fighter bounds unavailable");
  expect(
    Math.abs(player.y + player.height - opponent.y - opponent.height),
  ).toBeLessThan(1);
  const hud = await page.locator(".combat-scoreboard").boundingBox(),
    controls = await page.locator(".combat-controls").boundingBox();
  if (!hud || !controls) throw new Error("HUD bounds unavailable");
  expect(player.y).toBeGreaterThan(hud.y + hud.height);
  expect(player.y + player.height).toBeLessThan(controls.y);
  await page.screenshot({
    path: "docs/evidence/animation-pilot/portrait-idle.png",
  });
  await observePresentation(page);
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 15000 },
  );
  await expect(page.locator(".status-player")).toContainText("Cooldown 3");
  await expect(page.locator(".move-notice")).toContainText("Shield Bash");
  await page.screenshot({
    path: "docs/evidence/animation-pilot/portrait-special.png",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /^Defence/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 15000 },
  );
  const values = JSON.parse(
    (await page.locator(".battle-stage").getAttribute("data-frame-trace")) ??
      "[]",
  ) as number[];
  expect(values.length).toBeGreaterThan(20);
  const sorted = values.slice(1).sort((a, b) => a - b);
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(".webp"))
      .map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          name: new URL(r.name).pathname,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          duration: r.duration,
        };
      }),
  );
  writeFileSync(
    "docs/evidence/animation-pilot/browser-observations.json",
    JSON.stringify(
      {
        browser: browser.version(),
        viewport: { width: 390, height: 844 },
        context:
          "approved rendered artwork; Apple M3, 8 GiB RAM, local host; not low-end-device validation",
        frameSamples: values.length,
        medianFrameGapMs: sorted[Math.floor(sorted.length * 0.5)],
        p95FrameGapMs: sorted[Math.floor(sorted.length * 0.95)],
        maxFrameGapMs: Math.max(...sorted),
        resources: entries,
      },
      null,
      2,
    ),
  );
  await page.reload();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await official.finish();
});
