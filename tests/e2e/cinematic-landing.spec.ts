import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { characters } from "../../src/domain/characters/definitions";
import { fighter } from "../../src/domain/combat/definitions";
import { arenas, arenaIds } from "../../src/domain/combat/arenas";
import { companions } from "../../src/components/combat/rendered/catalogue";
const evidence = "docs/evidence/game-rebrand/after";
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));

test("immediate readable entry, arena-only hero, guest and holder routes", async ({
  page,
  browser,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Soryn",
  );
  await expect(
    page
      .locator(".gateway-hero .gateway-actions")
      .getByRole("link", { name: "Play now", exact: true }),
  ).toBeVisible();
  expect(
    requests.some((p) => /\/api\/|privy|\/combat\/audio\/|\/blender\//.test(p)),
  ).toBe(false);
  expect(
    requests.filter((p) => /\/combat\/crisp\/|\/landing\//.test(p)),
  ).toEqual([]);
  await expect(
    page.locator(
      ".gateway-duel, .gateway-stone, .gateway-scroll, .roster-arrows",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".cinematic-landing")).not.toContainText(/[←-⇿▷]/);
  expect(
    requests
      .filter((p) => /arenas\/.+-(desktop|portrait)/.test(p))
      .every((p) => p.includes("sanctuary")),
  ).toBe(true);
  await page
    .locator(".gateway-hero .gateway-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await page.locator('.play-mode[href="/arena"]').click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
  await page.goBack();
  await expect(page).toHaveURL(/\/start$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/arena$/);
  await page.goBack();
  await page.getByRole("link", { name: "My Chog", exact: true }).click();
  await expect(page).toHaveURL(/\/character$/);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const readable = await context.newPage();
  await readable.goto("/");
  await expect(
    readable
      .locator(".gateway-hero .gateway-actions")
      .getByRole("link", { name: "Play now", exact: true }),
  ).toBeVisible();
  await expect(
    readable.getByRole("button", { name: "Pip Starter", exact: true }),
  ).toBeAttached();
  await expect(
    readable.getByRole("heading", {
      name: "Your first battle is one move away.",
    }),
  ).toBeAttached();
  await context.close();
});

test("all twelve dossiers use actual abilities, keyboard selection, preview replay and cancellation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "chog-combat-audio/1",
      JSON.stringify({ enabled: false, volume: 0.17 }),
    ),
  );
  const audio: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/combat/audio/")) audio.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("link", { name: /Meet the fighters/ }).click();
  test.setTimeout(90000);
  for (const c of characters) {
    await page
      .getByRole("button", {
        name: `${c.name} ${c.access === "starter" ? "Starter" : "Holder"}`,
        exact: true,
      })
      .click();
    await expect(page.locator(".dossier-title h3")).toHaveText(c.name);
    await expect(page.locator(".special-dossier h4")).toHaveText(
      fighter(c.id).moves.special.name,
    );
    await expect(page.locator(".special-dossier")).toContainText(
      fighter(c.id).moves.special.rule,
    );
    await expect(page.locator(".companion-name")).toContainText(
      companions[c.id],
    );
    await page.getByRole("button", { name: /Preview special/ }).click();
    await expect(page.locator(".dossier-stage")).toHaveAttribute(
      "data-preview-status",
      "complete",
      { timeout: 15000 },
    );
  }
  await page
    .getByRole("button", { name: "Mneme Holder", exact: true })
    .press("Home");
  await expect(
    page.getByRole("button", { name: "Pip Starter", exact: true }),
  ).toBeFocused();
  for (let i = 1; i < characters.length; i++) {
    await page
      .getByRole("button", {
        name: `${characters[i - 1].name} ${characters[i - 1].access === "starter" ? "Starter" : "Holder"}`,
        exact: true,
      })
      .press("ArrowRight");
    await expect(page.locator(".dossier-title h3")).toHaveText(
      characters[i].name,
    );
    await expect(
      page.getByRole("button", {
        name: `${characters[i].name} ${characters[i].access === "starter" ? "Starter" : "Holder"}`,
        exact: true,
      }),
    ).toBeFocused();
  }
  await page
    .getByRole("button", { name: "Mneme Holder", exact: true })
    .press("Home");
  await page
    .getByRole("button", { name: "Pip Starter", exact: true })
    .press("ArrowRight");
  await expect(page.locator(".dossier-title h3")).toHaveText("Bolt");
  await page.getByRole("button", { name: /Preview special/ }).click();
  await expect(
    page.getByRole("button", { name: /Preparing preview|Preview playing/ }),
  ).toBeDisabled();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: /Replay special/ }).click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
  );
  await page.getByRole("button", { name: /Replay special/ }).click();
  await page
    .getByRole("button", { name: "Patch Starter", exact: true })
    .click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "idle",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /Preview special/ }).click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
  );
  expect(audio).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem("chog-combat-audio/1")),
  ).toBe('{"enabled":false,"volume":0.17}');
});

test("all four arena handoffs validate setup and preserve active match", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/battle") && r.method() === "POST")
      mutations.push(r.postData() ?? "");
  });
  for (const id of arenaIds) {
    await page.goto("/#arenas");
    await page
      .getByRole("button", { name: arenas[id].name, exact: true })
      .click();
    await expect(page.locator(".arena-description h3")).toHaveText(
      arenas[id].name,
    );
    await page.getByRole("link", { name: /Battle here/ }).click();
    await expect(page).toHaveURL(new RegExp(`/arena\\?arena=${id}$`));
    await expect(
      page.getByRole("radio", { name: arenas[id].name, exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Enter guest arena" }),
    ).toBeEnabled();
  }
  expect(mutations).toEqual([]);
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.locator(".battle-stage")).toBeVisible();
  const before = await (await page.request.get("/api/battle")).json();
  await page.goto("/arena?arena=grove");
  await expect(
    page.getByRole("radio", { name: "Moonlit Grove", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeDisabled();
  const after = await (await page.request.get("/api/battle")).json();
  expect(after.battle).toEqual(before.battle);
  await page.getByRole("button", { name: "Resume saved battle" }).click();
  expect(
    (await (await page.request.get("/api/battle")).json()).battle.arena,
  ).toBe("sky");
  await page.goto("/arena?arena=random");
  await expect(page.locator(".battle-stage")).toBeVisible();
  expect(mutations).toHaveLength(1);
});

test("asset failure stays navigable and preview can retry without overlapping", async ({
  page,
}) => {
  await page.route("**/combat/arenas/sanctuary-*.webp", (r) => r.abort());
  await page.route("**/combat/crisp/pip.webp", (r) => r.abort());
  await page.route("**/combat/crisp/aegis-idle.webp", (r) => r.abort());
  await page.goto("/");
  await expect(
    page.locator(".gateway-world .environment-fallback"),
  ).toBeVisible();
  await page.getByRole("link", { name: /Meet the fighters/ }).click();
  await page.getByRole("button", { name: /Preview special/ }).click();
  await expect(page.locator(".preview-status")).toContainText("unavailable");
  await expect(
    page.getByRole("button", { name: /Replay special/ }),
  ).toBeEnabled();
  await page.unroute("**/combat/crisp/pip.webp");
  await page.getByRole("button", { name: /Replay special/ }).click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
  );
  await page
    .locator(".gateway-hero .gateway-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await page.locator('.play-mode[href="/arena"]').click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
});

test("desktop and enlarged responsive layouts, reduced motion, contrast and focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForFunction(() =>
    document
      .querySelector(".gateway-world")!
      .getAnimations()
      .every((a) => a.playState === "finished"),
  );
  await page.screenshot({ path: `${evidence}/desktop-hero.png` });
  await page.getByRole("link", { name: /Meet the fighters/ }).click();
  await page.getByRole("button", { name: "Aegis Holder", exact: true }).click();
  await page.locator("#fighters").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/desktop-roster.png` });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .locator(".gateway-hero .gateway-actions")
        .getByRole("link", { name: "Play now", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".gateway-hero .gateway-actions")
        .getByRole("link", { name: "Play now", exact: true }),
    ).toBeInViewport();
    expect(
      await page
        .locator(".gateway-hero")
        .evaluate(
          (e) => getComputedStyle(e.querySelector(".gateway-world")!).transform,
        ),
    ).toBe("none");
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({
    content: "body{font-size:200%}p,a,button,summary{font-size:1em!important}",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const link of await page
    .locator(".gateway-actions a, .landing-nav a")
    .all()) {
    if (!(await link.isVisible())) continue;
    const rect = await link.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(321);
  }
  const mobileAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(mobileAudit.violations).toEqual([]);
});

test.describe("high-density portrait", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  test("touch selection and mobile evidence", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() =>
      document
        .querySelector(".gateway-world")!
        .getAnimations()
        .every((a) => a.playState === "finished"),
    );
    await page.screenshot({ path: `${evidence}/mobile-hero.png` });
    await page.getByRole("link", { name: /Meet the fighters/ }).tap();
    await page.getByRole("button", { name: "Ember Holder", exact: true }).tap();
    await expect(page.locator(".dossier-title h3")).toHaveText("Ember");
    await page.locator(".roster-body").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/mobile-roster.png` });
    await page.getByRole("button", { name: "Mneme Holder", exact: true }).tap();
    await expect(page.locator(".dossier-title h3")).toHaveText("Mneme");
    await page.getByRole("button", { name: "Sky Temple", exact: true }).tap();
    await page.locator("#arenas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/mobile-arena.png` });
    await page.getByRole("link", { name: /Battle here/ }).tap();
    await expect(
      page.getByRole("radio", { name: "Sky Temple", exact: true }),
    ).toBeChecked();
  });
  test("cold landing profile and genuinely usable selection", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(90000);
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
    await page.addInitScript(() => {
      const metrics: { lcp: number; cls: number } = { lcp: 0, cls: 0 };
      Object.assign(window, { landingMetrics: metrics });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) metrics.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (
            !(e as PerformanceEntry & { hadRecentInput: boolean })
              .hadRecentInput
          )
            metrics.cls += (e as PerformanceEntry & { value: number }).value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const start = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    await expect(
      page
        .locator(".gateway-hero .gateway-actions")
        .getByRole("link", { name: "Play now", exact: true }),
    ).toBeVisible({
      timeout: 30000,
    });
    const contentMs = Date.now() - start;
    await expect(page.locator("#fighters")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 45000 },
    );
    const controlsMs = Date.now() - start;
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLImageElement>(".gateway-hero img"),
        ).every((img) => img.complete && img.naturalWidth > 0),
      { timeout: 45000 },
    );
    const heroReadyMs = Date.now() - start;
    const metrics = await page.evaluate(() => ({
      paint: performance
        .getEntriesByType("paint")
        .map((e) => ({ name: e.name, ms: e.startTime })),
      ...(window as unknown as { landingMetrics: { lcp: number; cls: number } })
        .landingMetrics,
      resources: performance.getEntriesByType("resource").map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          path: new URL(e.name).pathname,
          transferBytes: r.transferSize,
          bodyBytes: r.encodedBodySize,
          ms: r.duration,
        };
      }),
      navigationBytes: (
        performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming
      ).transferSize,
    }));
    await page
      .getByRole("button", { name: "Bolt Starter", exact: true })
      .click();
    await expect(page.locator(".dossier-title h3")).toHaveText("Bolt");
    const selectionConfirmedMs = Date.now() - start;
    const images = metrics.resources.filter((r) => /\.webp$/.test(r.path));
    expect(
      metrics.resources.some((r) =>
        /\/api\/|\/combat\/audio\/|\/blender\//.test(r.path),
      ),
    ).toBe(false);
    expect(
      images
        .filter(
          (r) =>
            r.path.includes("-idle") ||
            r.path.includes("-companion") ||
            r.path.includes("-portrait"),
        )
        .reduce((sum, r) => sum + r.bodyBytes, 0),
    ).toBeLessThan(200 * 1024);
    expect(images).toHaveLength(1);
    expect(
      metrics.resources.some((r) =>
        /\/combat\/crisp\/|\/landing\//.test(r.path),
      ),
    ).toBe(false);
    writeFileSync(
      `${evidence}/mobile-profile.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          host: "Apple M3, 8 GiB; Chrome emulation, not physical phone",
          viewport: { width: 390, height: 844 },
          density: 3,
          cpuSlowdown: 6,
          downloadBitsPerSecond: 1600000,
          uploadBitsPerSecond: 750000,
          latencyMs: 150,
          coldCache: true,
          contentMs,
          controlsMs,
          heroReadyMs,
          selectionConfirmedMs,
          ...metrics,
          totalTransferredBytes:
            metrics.navigationBytes +
            metrics.resources.reduce((s, r) => s + r.transferBytes, 0),
        },
        null,
        2,
      ),
    );
  });
});

test("Play works while hero artwork is stalled, and the scene never moves text or buttons", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/combat/arenas/sanctuary-desktop.webp", async (route) => {
    await stalled;
    await route.abort();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const play = page
      .locator(".gateway-hero .gateway-actions")
      .getByRole("link", { name: "Play now", exact: true });
    await expect(play).toBeVisible();
    const before = await play.boundingBox();
    await page.mouse.move(1000, 400);
    expect(await play.boundingBox()).toEqual(before);
    await play.click();
    await expect(page).toHaveURL(/\/start$/);
    await page.locator('.play-mode[href="/arena"]').click();
    await expect(page).toHaveURL(/\/arena$/);
    await expect(
      page.getByRole("button", { name: "Enter guest arena" }),
    ).toBeEnabled();
  } finally {
    release?.();
  }
});
