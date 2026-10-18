import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { visualHolder } from "../../browser-support/visual-holder";
const stage =
  process.env.CHOG_READINESS_STAGE === "before" ? "before" : "after";
const evidence = `docs/evidence/cinematic-readiness/${stage}`;
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
for (const target of ["landing", "journey", "guest", "heavy"] as const) {
  for (let sample = 1; sample <= 3; sample++) {
    test(`${target} sample ${sample}`, async ({
      page,
      context,
      baseURL,
      browser,
    }) => {
      test.setTimeout(180000);
      mkdirSync(evidence, { recursive: true });
      if (!baseURL) throw new Error("Missing production origin");
      await page.addInitScript(() => {
        localStorage.setItem(
          "chog-combat-audio/1",
          JSON.stringify({ enabled: false, volume: 0.5 }),
        );
        const decode = HTMLImageElement.prototype.decode;
        const spans: { path: string; start: number; end?: number }[] = [];
        Object.assign(window, { __decodeSpans: spans });
        HTMLImageElement.prototype.decode = async function () {
          const span = {
            path: this.src,
            start: performance.now(),
            end: undefined as number | undefined,
          };
          spans.push(span);
          try {
            return await decode.call(this);
          } finally {
            span.end = performance.now();
          }
        };
        new PerformanceObserver((list) => {
          const w = window as unknown as { __longTasks: number[] };
          (w.__longTasks ??= []).push(
            ...list.getEntries().map((e) => e.duration),
          );
        }).observe({ type: "longtask", buffered: true });
      });
      let holder: Awaited<ReturnType<typeof visualHolder>> | undefined;
      const startData = {
        operation: "start",
        mode: target === "heavy" ? "official" : "guest",
        id: randomUUID(),
        characterId: target === "heavy" ? "aegis" : "pip",
        opponent: target === "heavy" ? "ember" : "bolt",
        difficulty: "easy",
        arena: "sanctuary",
      };
      if (target === "heavy") {
        holder = await visualHolder(page, 1400 + sample);
        expect((await holder(startData)).ok()).toBe(true);
      }
      if (target === "guest") {
        await page.request.get("/api/battle");
        expect(
          (
            await page.request.post("/api/battle", {
              headers: { Origin: baseURL },
              data: startData,
            })
          ).ok(),
        ).toBe(true);
      }
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      const marks: Record<string, number> = {};
      const started = Date.now();
      const mark = (key: string) => (marks[key] = Date.now() - started);
      await page.goto(
        target === "landing" || target === "journey" ? "/" : "/arena",
        { waitUntil: "commit" },
      );
      if (target === "landing" || target === "journey") {
        await expect(page.locator("#fighters")).toHaveAttribute(
          "data-ready",
          "true",
          { timeout: 60000 },
        );
        mark("landingUsable");
      }
      if (target === "journey") {
        mark("playClick");
        await page
          .locator(".gateway-hero .gateway-actions")
          .getByRole("link", { name: "Play now", exact: true })
          .click();
        await page.locator('.play-mode[href="/arena"]').click();
        await expect(
          page.getByRole("button", { name: "Enter guest arena" }),
        ).toBeEnabled({ timeout: 60000 });
        mark("setupUsable");
        await page.getByLabel("Computer opponent").selectOption("bolt");
        mark("selection");
        mark("startClick");
        await page.getByRole("button", { name: "Enter guest arena" }).click();
      }
      if (target !== "landing") {
        await expect(
          page.getByRole("button", { name: /^Basic attack/ }),
        ).toBeEnabled({ timeout: 100000 });
        mark("battleUsable");
        await page.screenshot({ path: `${evidence}/${target}-${sample}.png` });
        mark("moveClick");
        await page.getByRole("button", { name: /^Basic attack/ }).click();
        await expect(
          page.getByRole("button", { name: /^Basic attack/ }),
        ).toBeEnabled({ timeout: 30000 });
        mark("animationComplete");
      }
      const data = await page.evaluate(() => {
        const n = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType("resource").map((e) => {
          const r = e as PerformanceResourceTiming;
          return {
            path: new URL(r.name).pathname,
            start: r.startTime,
            end: r.responseEnd,
            duration: r.duration,
            ttfb: r.responseStart - r.requestStart,
            transfer: r.transferSize,
            body: r.encodedBodySize,
          };
        });
        return {
          navigationBytes: n.transferSize,
          resources,
          paint: performance
            .getEntriesByType("paint")
            .map((e) => ({ name: e.name, ms: e.startTime })),
        };
      });
      // Read only instrumented spans; avoid serializing unrelated Window properties.
      const spans = await page.evaluate(() => ({
        decode: (window as unknown as { __decodeSpans: unknown }).__decodeSpans,
        longTasks: (window as unknown as { __longTasks: unknown }).__longTasks,
      }));
      writeFileSync(
        `${evidence}/${target}-${sample}.json`,
        JSON.stringify(
          {
            stage,
            target,
            sample,
            browser: browser.version(),
            conditions:
              "M3/8GiB;390×844 DPR3;6xCPU;1.6Mbps down/750kbps up;150ms;cache disabled;warm Node",
            marks,
            navigationBytes: data.navigationBytes,
            resources: data.resources,
            paint: data.paint,
            ...spans,
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
      await holder?.finish();
    });
  }
}
