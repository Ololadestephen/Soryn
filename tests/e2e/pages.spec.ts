import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing introduces the loop without opening a guest session or wallet", async ({
  page,
  browser,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/") ||
      request.url().includes("auth.privy.io")
    )
      privateRequests.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Déjà Vu",
    }),
  ).toBeVisible();
  await page
    .getByText("Do I need a wallet to battle a friend?", { exact: true })
    .click();
  await expect(
    page.getByText("No. Four starter fighters can challenge a friend", {
      exact: false,
    }),
  ).toBeVisible();
  expect(privateRequests).toEqual([]);
  expect(
    (await page.context().cookies()).filter(
      (cookie) => cookie.name === "chog_guest",
    ),
  ).toEqual([]);
  const desktopAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(desktopAudit.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content:
      "body { font-size: 200%; } p, a, button, small, summary { font-size: 1em !important; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const challenge = page
    .getByRole("link", { name: "Challenge a friend" })
    .first();
  expect(
    await challenge.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBeGreaterThanOrEqual(44);
  const mobileAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(mobileAudit.violations).toEqual([]);
  await challenge.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/challenge$/);
  await expect(
    page.getByRole("button", { name: "Create invitation" }),
  ).toBeEnabled();
  await expect(page.locator("#museum, #journal, #character")).toHaveCount(0);
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const readable = await noScript.newPage();
  await readable.goto("/");
  await expect(
    readable.getByRole("link", { name: "Challenge a friend" }).first(),
  ).toBeVisible();
  await expect(
    readable.getByRole("heading", { name: "Four starters. No wallet required." }),
  ).toBeVisible();
  await noScript.close();
});

test("dedicated pages preserve active play through navigation, back, refresh and home", async ({
  page,
}) => {
  const errors: string[] = [];
  const mutations: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().endsWith("/api/game") && request.method() === "POST")
      mutations.push(request.postData() ?? "");
  });
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Inspect the room" }).click();
  const saved = await page.request.get("/api/game");
  const original = (await saved.json()).run;
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Adventure", exact: true })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "My Chog" }).click();
  await expect(page.getByRole("heading", { name: "My Chog" })).toBeFocused();
  await page.goto("/journal");
  await expect(
    page.getByRole("heading", { name: "Adventure journal" }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "Battle history" })).toBeVisible();
  await expect(
    page.getByText("Your current adventure is still in progress.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator("#adventure, #museum, #character")).toHaveCount(0);
  await page.goto("/museum");
  await expect(page).toHaveTitle("The museum · Chog Déjà Vu");
  await expect(page.locator("#museum")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/journal$/);
  await page.reload();
  await expect(
    page.getByText("Your current adventure is still in progress.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/play");
  await expect(page.locator(".stats")).toContainText("9");
  await expect(page.locator(".clue")).toContainText("no hinges");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Chog Déjà Vu home" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/archive");
  await page.getByRole("link", { name: "Play the archived adventure" }).click();
  await expect(page.locator(".stats")).toContainText("9");
  const resumed = await page.request.get("/api/game");
  expect((await resumed.json()).run).toEqual(original);
  expect(mutations).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("legacy bookmarks and challenge links resolve to the new pages", async ({
  page,
  browser,
}) => {
  for (const [hash, path] of [
    ["journal", "journal"],
    ["museum", "museum"],
    ["character", "character"],
    ["adventure", "play"],
  ]) {
    await page.goto(`/#${hash}`);
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
  }
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Publish my failure" }).click();
  const href = await page
    .getByRole("link", { name: "Open shareable challenge" })
    .getAttribute("href");
  expect(href).toMatch(/^\/play\?challenge=/);
  const exhibitId = new URL(href ?? "/", page.url()).searchParams.get(
    "challenge",
  );
  const other = await browser.newContext();
  const challenger = await other.newPage();
  await challenger.goto(`/?challenge=${exhibitId}`);
  await expect(challenger).toHaveURL(/\/play\?challenge=/);
  await expect(
    challenger.getByRole("button", { name: "Rush the heroic door" }),
  ).toBeEnabled();
  const before = await challenger.request.get("/api/game");
  const run = (await before.json()).run;
  expect(run.exhibitId).toBe(exhibitId);
  await challenger.reload();
  await expect(
    challenger.getByRole("button", { name: "Rush the heroic door" }),
  ).toBeEnabled();
  const after = await challenger.request.get("/api/game");
  expect((await after.json()).run.id).toBe(run.id);
  await other.close();
  await page.goto("/play?challenge=invalid");
  await expect(page.locator(".error[role=alert]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry saved request" }),
  ).toBeVisible();
});

test("a lost turn response remains recoverable on another app page", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  let lost = false;
  await page.route("**/api/game", async (route) => {
    if (
      !lost &&
      route.request().method() === "POST" &&
      route.request().postDataJSON().operation === "step"
    ) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Inspect the room" }).click();
  await expect(
    page.getByRole("button", { name: "Retry saved request" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open the journal" }).click();
  await page.getByRole("button", { name: "Retry saved request" }).click();
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
  await page.goto("/play");
  await expect(page.locator(".stats")).toContainText("9");
  const session = await page.request.get("/api/game");
  expect((await session.json()).run.step).toBe(1);
});
