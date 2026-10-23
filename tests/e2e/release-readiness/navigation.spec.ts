import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { evidence } from "./support";
import { pair, publicPair, room, savePair, choose } from "./support";
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
test("the mode menu resumes an existing public seat without opening another battle", async ({
  browser,
  baseURL,
}) => {
  const players = await pair(browser, baseURL!, "menu-resume");
  const { a, b } = players;
  try {
    const invite = await publicPair(a, b);
    const locked = await choose(a, "basic");
    await a.goto("/start");
    await a.getByRole("link", { name: "Resume match", exact: true }).click();
    await expect(a).toHaveURL(new RegExp(`/challenge/${invite}$`));
    await expect(a.locator(".turn-readiness")).toContainText("Move locked");
    const saved = await room(a, invite);
    expect(saved.battle!.id).toBe(locked.battle!.id);
    expect(saved.deadlineAt).toBe(locked.deadlineAt);
    expect(saved.you.move).toBe("basic");
    expect((await room(b, invite)).opponent?.locked).toBe(true);
  } finally {
    await savePair(players);
  }
});
for (const mobile of [false, true])
  test(`clean landing and explicit mode selection: ${mobile ? "portrait" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/"))
        writes.push(r.url());
    });
    await page.goto("/");
    const actions = page.locator(".gateway-hero .gateway-actions");
    await expect(actions.getByRole("link")).toHaveCount(2);
    await expect(
      actions.getByRole("link", { name: "Play now", exact: true }),
    ).toBeVisible();
    await expect(
      actions.getByRole("link", { name: "Watch gameplay", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "Find a Match", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${evidence}/${mobile ? "mobile" : "desktop"}-landing.png`,
    });
    await actions.getByRole("link", { name: "Play now", exact: true }).click();
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByRole("heading", { name: "Play" })).toBeVisible();
    await expect(page.locator(".play-mode")).toHaveCount(4);
    await expect(
      page
        .locator(".play-modes")
        .getByRole("link", { name: "Story", exact: true }),
    ).toHaveAttribute("href", "/story");
    expect(writes).toEqual([]);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: `${evidence}/${mobile ? "mobile" : "desktop"}-play-menu.png`,
    });
    for (const [href, expected] of [
      ["/match", "Find a Match"],
      ["/challenge", "Challenge a friend"],
      ["/story", "The Fractured Sanctuary"],
      ["/arena", "Choose your fighter."],
    ] as const) {
      await page.goto("/start");
      await page.locator(`.play-mode[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      if (href === "/arena")
        await expect(
          page.getByRole("button", { name: "Enter guest arena" }),
        ).toBeEnabled();
      else
        await expect(
          page.getByRole("heading", { name: expected, exact: true }),
        ).toBeVisible();
    }
    expect(writes).toEqual([]);
  });
test("mobile dialog and desktop secondary navigation support keyboard, Escape and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/start");
  const toggle = page.getByRole("button", { name: "Menu", exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Explore Soryn" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Fighters", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 800 });
  const more = page.locator(".nav-more summary");
  await more.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    page
      .getByRole("navigation", { name: "Secondary navigation", exact: true })
      .getByRole("link", { name: "Battle History" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await more.click();
  await page
    .getByRole("navigation", { name: "Secondary navigation", exact: true })
    .getByRole("link", { name: "Battle History" })
    .click();
  await expect(page).toHaveURL(/\/history$/);
  await page.locator(".nav-more summary").click();
  await page
    .getByRole("navigation", { name: "Secondary navigation", exact: true })
    .getByRole("link", { name: "Archive" })
    .click();
  await expect(page).toHaveURL(/\/archive$/);
});
test("enlarged text and reduced motion retain readable actions and archive links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForTimeout(2000);
  await expect(page.locator(".hero-film")).not.toHaveAttribute("src", /./);
  await page.addStyleTag({
    content:
      "body { font-size: 200%; } p, a, button, small, summary { font-size: 1em !important; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".gateway-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await expect(page.locator(".play-mode")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Archive", exact: true })
    .click();
  await expect(page).toHaveURL(/\/archive$/);
  for (const path of ["/play", "/journal", "/museum"]) {
    await page.goto(path);
    await expect(page.locator(".archived-notice")).toBeVisible();
  }
});
test("the Play menu stays small and defers fighter/media transfers until selection", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
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
    await page.goto("/");
    const requested: string[] = [];
    page.on("request", (r) => requested.push(new URL(r.url()).pathname));
    const start = Date.now();
    await page
      .locator(".gateway-actions")
      .getByRole("link", { name: "Play now", exact: true })
      .click();
    await expect(page.locator(".play-mode")).toHaveCount(4);
    const menuReadyMs = Date.now() - start;
    await expect(
      page
        .locator(".play-modes")
        .getByRole("link", { name: "Story", exact: true }),
    ).toHaveAttribute("href", "/story");
    expect(
      requested.filter((p) =>
        /\/combat\/(crisp|rendered|selection|blender)\//.test(p),
      ),
    ).toEqual([]);
    expect(
      requested.filter((p) => /^\/api\/(match|pvp|battle|story)/.test(p)),
    ).toEqual([]);
    const selection = Date.now();
    await page.locator('.play-mode[href="/arena"]').click();
    await expect(
      page.getByRole("button", { name: "Enter guest arena" }),
    ).toBeEnabled({ timeout: 30000 });
    samples.push({
      menuReadyMs,
      practiceSetupAfterSelectionMs: Date.now() - selection,
      menuRequests: requested,
    });
    await context.close();
  }
  writeFileSync(
    `${evidence}/play-menu-loading.json`,
    JSON.stringify(
      {
        conditions:
          "Three fresh contexts; cold cache; 390×844; 6× CPU, 1.6Mbps down, 750kbps up, 150ms latency. Button/menu readiness, not a battle-start benchmark.",
        samples,
      },
      null,
      2,
    ),
  );
});
