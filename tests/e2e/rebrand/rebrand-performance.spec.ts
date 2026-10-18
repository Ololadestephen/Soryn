import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const stage = process.env.CHOG_REBRAND_STAGE === "before" ? "before" : "after";
const evidence = `docs/evidence/game-rebrand/${stage}`;
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));

for (const target of ["landing", "arena"] as const) {
  test(`comparable cold mobile ${target}`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120000);
    if (!baseURL)
      throw new Error("The production browser baseURL is required.");
    if (target === "arena") {
      await page.request.get("/api/battle");
      const start = await page.request.post("/api/battle", {
        headers: { Origin: baseURL },
        data: {
          operation: "start",
          mode: "guest",
          id: randomUUID(),
          characterId: "pip",
          opponent: "bolt",
          difficulty: "easy",
          arena: "sanctuary",
        },
      });
      expect(start.ok()).toBe(true);
    }
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
    const started = Date.now();
    await page.goto(target === "landing" ? "/" : "/arena", {
      waitUntil: "commit",
    });
    if (target === "landing") {
      await expect(
        page
          .locator(".gateway-hero .gateway-actions")
          .getByRole("link", { name: "Play now", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(page.locator("#fighters")).toHaveAttribute(
        "data-ready",
        "true",
        { timeout: 45000 },
      );
    } else
      await expect(
        page.getByRole("button", { name: /^Basic attack/ }),
      ).toBeEnabled({ timeout: 90000 });
    const readyMs = Date.now() - started;
    const data = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const resources = performance
        .getEntriesByType("resource")
        .map((entry) => {
          const r = entry as PerformanceResourceTiming;
          return {
            path: new URL(r.name).pathname,
            transferBytes: r.transferSize,
            bodyBytes: r.encodedBodySize,
            ms: r.duration,
          };
        });
      return {
        paint: performance
          .getEntriesByType("paint")
          .map((p) => ({ name: p.name, ms: p.startTime })),
        resources,
        navigationBytes: navigation.transferSize,
        totalTransferredBytes:
          navigation.transferSize +
          resources.reduce((n, r) => n + r.transferBytes, 0),
      };
    });
    writeFileSync(
      `${evidence}/${target}-profile.json`,
      JSON.stringify(
        {
          stage,
          target,
          browser: browser.version(),
          host: "Apple M3 / 8 GiB; emulation, not physical phone",
          viewport: "390×844 / DPR3",
          cpuSlowdown: 6,
          downloadBitsPerSecond: 1600000,
          uploadBitsPerSecond: 750000,
          latencyMs: 150,
          coldCache: true,
          readyMs,
          ...data,
        },
        null,
        2,
      ),
    );
    if (target === "landing") {
      expect(
        data.resources.some((r) =>
          /\.mp4|\.webm|privy|\/combat\/crisp\//.test(r.path),
        ),
      ).toBe(false);
      await page
        .getByRole("button", { name: "Bolt Starter", exact: true })
        .click();
      await expect(page.locator(".dossier-title h3")).toHaveText("Bolt");
    }
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });
}
