import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";
import { observePresentation } from "../browser-support/presentation-observer";

const cleanup = new WeakMap<Page, () => Promise<void>>();
test.afterEach(async ({ page }) => {
  await cleanup.get(page)?.();
});

test("random arena · compact setup, resolved choice, refresh and rematch persistence", async ({
  page,
}) => {
  test.setTimeout(70000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/arena");
  await expect(
    page.getByRole("radio", { name: "Moonlit Grove", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Sound effects on").uncheck();
  await page.getByRole("radio", { name: /Random · chosen once/ }).check();
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  const original = await (await page.request.get("/api/battle")).json();
  expect(["sanctuary", "grove", "foundry", "sky"]).toContain(
    original.battle.arena,
  );
  await page.reload();
  expect(
    (await (await page.request.get("/api/battle")).json()).battle.arena,
  ).toBe(original.battle.arena);
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Battle settings" }).click();
  await expect(page.getByLabel("Sound effects on")).not.toBeChecked();
  await page.getByRole("button", { name: "Return to battle" }).click();
  const basic = page.getByRole("button", { name: /^Basic attack/ });
  const rematch = page.getByRole("button", { name: "Rematch", exact: true });
  for (let round = 0; round < 20 && !(await rematch.isVisible()); round++) {
    const special = page.getByRole("button", { name: /^Special/ });
    await ((await special.isEnabled()) ? special : basic).click();
    await expect
      .poll(
        async () => (await basic.isEnabled()) || (await rematch.isVisible()),
        { timeout: 10000 },
      )
      .toBe(true);
  }
  await rematch.click();
  const next = await (await page.request.get("/api/battle")).json();
  expect(next.battle.arena).toBe(original.battle.arena);
  expect(next.battle.id).not.toBe(original.battle.id);
});

test("missing assets · chosen environment, new/legacy art and sound failures preserve playable state", async ({
  page,
}) => {
  await page.route("**/combat/audio/*", (route) => route.abort());
  await page.route("**/combat/arenas/grove-*.webp", (route) => route.abort());
  await page.route("**/combat/{crisp,delivery}/*", (route) => route.abort());
  await page.goto("/arena");
  await page.getByRole("radio", { name: "Moonlit Grove", exact: true }).check();
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.locator(".arena-art-warning")).toBeVisible();
  await expect(page.locator(".fighter-player .rendered-art")).toHaveAttribute(
    "data-art-source",
    "legacy-fallback",
  );
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 30000 },
  );
  await expect(page.locator(".arena-round")).toContainText("Round 2");
  await page.reload();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  const saved = await (await page.request.get("/api/battle")).json();
  expect(saved.battle.arena).toBe("grove");
});

test.describe("throttled portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  test("mobile profile · 6x CPU, 1.6Mbps/750kbps, 150ms latency and cold cache", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150000);
    const official = await visualHolder(page, 1300);
    cleanup.set(page, official.finish);
    expect(
      (
        await official({
          operation: "start",
          mode: "official",
          id: randomUUID(),
          characterId: "aegis",
          opponent: "ember",
          difficulty: "medium",
          arena: "sanctuary",
        })
      ).ok(),
    ).toBe(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1600000 / 8,
      uploadThroughput: 750000 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const navigationStartedAt = Date.now();
    await page.goto("/arena", { waitUntil: "commit" });
    await expect(page.locator(".arena-preparing")).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeDisabled();
    await expect(page.locator(".battle-stage")).not.toHaveAttribute(
      "data-preparing",
      "true",
      { timeout: 60000 },
    );
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled();
    const readyLatencyMs = Date.now() - navigationStartedAt;
    mkdirSync("docs/evidence/arena-feel", { recursive: true });
    await page.screenshot({
      path: "docs/evidence/arena-feel/portrait-after.png",
    });
    await observePresentation(page);
    await page.getByRole("button", { name: /^Special/ }).click();
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 40000 });
    const resources = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/combat/"))
        .map((entry) => {
          const resource = entry as PerformanceResourceTiming;
          return {
            path: new URL(entry.name).pathname,
            transferBytes: resource.transferSize,
            bodyBytes: resource.encodedBodySize,
            durationMs: resource.duration,
          };
        }),
    );
    const backgrounds = resources.filter((entry) =>
      /arenas\/.+-(desktop|portrait)\.webp/.test(entry.path),
    );
    expect(
      backgrounds.every((entry) =>
        entry.path.endsWith("sanctuary-portrait.webp"),
      ),
    ).toBe(true);
    expect(
      resources.some((entry) => entry.path.includes("/combat/blender/")),
    ).toBe(false);
    const gaps = JSON.parse(
      (await page.locator(".battle-stage").getAttribute("data-frame-trace")) ??
        "[]",
    ) as number[];
    const sorted = gaps.slice(1).sort((a, b) => a - b);
    writeFileSync(
      "docs/evidence/arena-feel/mobile-profile.json",
      JSON.stringify(
        {
          browser: browser.version(),
          host: "Apple M3, 8 GiB RAM; browser throttling is not a physical low-end phone",
          viewport: { width: 390, height: 844 },
          density: 3,
          cpuSlowdown: 6,
          downloadBitsPerSecond: 1600000,
          uploadBitsPerSecond: 750000,
          latencyMs: 150,
          coldCache: true,
          readyLatencyMs,
          resources,
          frameSamples: gaps.length,
          medianGapMs: sorted[Math.floor(sorted.length * 0.5)],
          p95GapMs: sorted[Math.floor(sorted.length * 0.95)],
          maximumGapMs: Math.max(...sorted),
        },
        null,
        2,
      ),
    );
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await official.finish();
  });
});
