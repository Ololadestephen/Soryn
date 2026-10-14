import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
for (const mobile of [false, true])
  test(`separate initial and deferred ${mobile ? "mobile" : "desktop"} transfer`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const requests = new Map<string, string>();
    const wire: { path: string; bytes: number }[] = [];
    cdp.on("Network.requestWillBeSent", (e) =>
      requests.set(e.requestId, new URL(e.request.url).pathname),
    );
    cdp.on("Network.loadingFinished", (e) =>
      wire.push({
        path: requests.get(e.requestId) ?? "unknown",
        bytes: e.encodedDataLength,
      }),
    );
    await page.goto("/");
    await expect(page.locator("#fighters")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const initial = wire.slice();
    expect(initial.some((r) => r.path.includes("/hero/"))).toBe(false);
    await expect(page.locator(".hero-film")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 20000 },
    );
    await page.waitForTimeout(1500);
    const media = wire.filter((r) => r.path.includes("/hero/"));
    expect(media.length).toBeGreaterThan(0);
    expect(
      media.every((r) => r.path.includes(mobile ? "mobile" : "desktop")),
    ).toBe(true);
    writeFileSync(
      `docs/evidence/cinematic-readiness/after/transfer-${mobile ? "mobile" : "desktop"}.json`,
      JSON.stringify(
        {
          initialBytes: initial.reduce((n, r) => n + r.bytes, 0),
          deferredVideoBytes: media.reduce((n, r) => n + r.bytes, 0),
          initial,
          media,
          conditions:
            "Chrome CDP loadingFinished wire bytes; cold disabled cache; unthrottled; no scrolling",
        },
        null,
        2,
      ),
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({
      path: `docs/evidence/cinematic-readiness/after/hero-landscape-${mobile}.png`,
    });
  });
