import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureHolder } from "../../browser-support/holder";
import { attachSignedHeaders } from "./support";
const evidence = ".cache/pvp-lifecycle-20261018/after";
async function create(page: Page) {
  await page.goto("/challenge");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
  return page.url();
}
async function pick(page: Page, name = "Pip / Scout") {
  const radio = page.getByRole("radio", { name });
  await radio.click();
  await expect(radio).toBeChecked();
}

test("fighter selection separates preview, roster and ready action across mobile, landscape, desktop and enlarged text", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150000);
  mkdirSync(evidence, { recursive: true });
  const url = await create(page);
  const other = await browser.newContext({ baseURL });
  const friend = await other.newPage();
  try {
    await friend.goto(url);
    await friend.getByRole("button", { name: "Take the open seat" }).click();
    await page.route("**/api/pvp*", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.seated && json.opponent)
        json.opponent.name = "Keeper With A Very Long Creature Name";
      await route.fulfill({ response, json });
    });
    await pick(page);
    await expect(
      page.getByText("Keeper With A Very Long Creature Name", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Aegis / Guardian" }),
    ).toBeDisabled();
    const points = [
      [1280, 900, "desktop"],
      [320, 740, "320"],
      [375, 812, "375"],
      [390, 844, "mobile"],
      [430, 932, "430"],
      [844, 390, "landscape"],
    ] as const;
    for (const [width, height, label] of points) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator(".pvp-preview-art > svg")).toHaveCount(1);
      await expect(page.locator(".pvp-preview-companion > svg")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      const box = await page
        .getByRole("button", { name: "Ready up", exact: true })
        .boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
      const pane = page.locator(".pvp-room-content");
      const actions = page.locator(".pvp-ready-bar");
      const contentBox = await pane.boundingBox();
      const actionBox = await actions.boundingBox();
      expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(
        actionBox!.y + 1,
      );
      await pick(page, "Moss / Caretaker");
      if (label === "mobile")
        await page.screenshot({
          path: `${evidence}/private-mobile-roster.png`,
          fullPage: true,
        });
      await pick(page);
      await pane.evaluate((e) => {
        e.scrollTop = 0;
      });
      await page.screenshot({
        path: `${evidence}/private-${label}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({
      content:
        ".pvp-lobby{font-size:200%}.pvp-lobby p,.pvp-lobby small,.pvp-lobby strong,.pvp-lobby button,.pvp-lobby input,.pvp-lobby summary{font-size:1em!important}",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/private-enlarged-text.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Ready up", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Not ready", exact: true }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    const dense = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      reducedMotion: "reduce",
    });
    try {
      const mobile = await dense.newPage();
      await create(mobile);
      await pick(mobile);
      expect(await mobile.evaluate(() => devicePixelRatio)).toBe(3);
      expect(
        await mobile.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
      await mobile.screenshot({
        path: `${evidence}/private-mobile-dpr3-reduced.png`,
        fullPage: true,
      });
      await mobile
        .getByRole("button", { name: "Ready up", exact: true })
        .click();
      await expect(
        mobile.getByRole("button", { name: "Not ready", exact: true }),
      ).toBeVisible();
    } finally {
      await dense.close();
    }
  } finally {
    await other.close();
  }
});

test("selection errors remain visible and locked guest fighters cannot be selected", async ({
  page,
}) => {
  await create(page);
  let failed = false;
  await page.route("**/api/pvp", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.operation === "select" &&
      !failed
    ) {
      failed = true;
      await route.fulfill({
        status: 503,
        json: { error: "Selection temporarily unavailable." },
      });
    } else await route.continue();
  });
  await page.getByRole("radio", { name: "Pip / Scout" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Selection temporarily unavailable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ready up", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: "Aegis / Guardian" }),
  ).toBeDisabled();
  await pick(page);
  await expect(
    page.getByRole("button", { name: "Ready up", exact: true }),
  ).toBeEnabled();
  await page.getByRole("radio", { name: "Pip / Scout" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Bolt / Courier" }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "Bolt / Courier" }).focus();
  expect(
    await page
      .getByRole("radio", { name: "Bolt / Courier" })
      .evaluate((e) => e.matches(":focus-visible")),
  ).toBe(true);
});

test("active-series exit requires confirmation and refresh or reconnect does not surrender", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  const url = await create(page);
  const token = new URL(url).pathname.split("/").at(-1)!;
  const other = await browser.newContext({ baseURL });
  const friend = await other.newPage();
  try {
    await friend.goto(url);
    await friend.getByRole("button", { name: "Take the open seat" }).click();
    await pick(page);
    await pick(friend, "Bolt / Courier");
    await page.getByRole("button", { name: "Ready up", exact: true }).click();
    await friend.getByRole("button", { name: "Ready up", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
    const before = await (
      await page.request.get(`/api/pvp?invite=${token}`)
    ).json();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 15000 });
    const refreshed = await (
      await page.request.get(`/api/pvp?invite=${token}`)
    ).json();
    expect(refreshed.battle.id).toBe(before.battle.id);
    expect(refreshed.series.outcome).toBeNull();
    await page
      .getByRole("button", { name: "Battle settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Surrender series", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Surrender this series?",
      exact: true,
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep playing" }).click();
    expect(
      (await (await page.request.get(`/api/pvp?invite=${token}`)).json()).series
        .outcome,
    ).toBeNull();
    await page
      .getByRole("button", { name: "Battle settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Surrender series", exact: true })
      .click();
    await confirm
      .getByRole("button", { name: "Surrender series", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Defeat", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Defeat", exact: true }),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/pvp?mode=guest")).json())
        .activeInvite,
    ).toBeNull();
    await expect(
      page.getByRole("link", { name: "Challenge a friend", exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("simultaneous pregame withdrawals release the pair without deleting a subsequent queue entry", async ({
  page,
  browser,
  baseURL,
}) => {
  const other = await browser.newContext({ baseURL });
  const friend = await other.newPage();
  try {
    const url = await create(page);
    const token = new URL(url).pathname.split("/").at(-1)!;
    await friend.goto(url);
    await friend.getByRole("button", { name: "Take the open seat" }).click();
    const post = (who: Page) =>
      who.request.post("/api/pvp", {
        headers: { Origin: baseURL! },
        data: { operation: "leave", invite: token, mode: "guest" },
      });
    const replies = await Promise.all([post(page), post(friend), post(page)]);
    expect(replies.every((r) => r.ok())).toBe(true);
    expect(
      (await (await page.request.get("/api/pvp?mode=guest")).json())
        .activeInvite,
    ).toBeNull();
    const joined = await page.request.post("/api/match", {
      headers: { Origin: baseURL! },
      data: { operation: "join", mode: "guest" },
    });
    expect(joined.ok()).toBe(true);
    expect((await post(page)).ok()).toBe(true);
    expect(
      (await (await page.request.get("/api/match?mode=guest")).json()).status,
    ).toMatch(/waiting|offered/);
    await page.request.post("/api/match", {
      headers: { Origin: baseURL! },
      data: { operation: "cancel", mode: "guest" },
    });
  } finally {
    await other.close();
  }
});

test("fixture holder selection uses the same layout with eligible Aegis and its armadillo", async ({
  page,
}) => {
  test.setTimeout(90000);
  const signed = await fixtureHolder(page.request, 0);
  await attachSignedHeaders(page, ["**/api/pvp*"], signed.headers);
  await page.goto("/challenge?as=chog");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await page.waitForURL(/\/challenge\/.+/);
  await page.setViewportSize({ width: 390, height: 844 });
  await pick(page, "Aegis / Guardian");
  await expect(
    page.getByRole("img", { name: "Aegis rendered fighter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Armadillo companion" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ready up", exact: true }),
  ).toBeEnabled();
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({
    path: `${evidence}/fixture-holder-mobile.png`,
    fullPage: true,
  });
  const token = new URL(page.url()).pathname.split("/").at(-1)!;
  const closed = await page.request.post("/api/pvp", {
    headers: signed.headers,
    data: { operation: "close", invite: token, mode: "official" },
  });
  expect(closed.ok()).toBe(true);
});
