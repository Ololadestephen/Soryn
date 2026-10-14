import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a real failure, replay, consent and cross-browser challenge", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await expect(page.getByRole("region", { name: "Run result" })).toBeVisible();
  const resultAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(resultAudit.violations).toEqual([]);
  await expect(
    page.getByText("The Door Was Painted.", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish my failure" }).click();
  await expect(page.getByRole("checkbox")).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Open shareable challenge" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next turn" }).click();
  await expect(
    page.getByText("Exact recorded replay · 1 / 1 actions"),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Public author alias").fill("<script>bad()</script>");
  await page.getByRole("button", { name: "Publish my failure" }).click();
  const link = page.getByRole("link", { name: "Open shareable challenge" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await page.goto("/museum");
  await expect(
    page.getByText("By <script>bad()</script>", { exact: false }),
  ).toBeVisible();
  const exhibitCard = page
    .getByRole("article")
    .filter({ has: page.locator(`a[href="${href}"]`) });
  await exhibitCard.getByRole("button", { name: "View replay" }).click();
  const museumReplay = page.locator(".museum > .panel");
  await expect(
    museumReplay.getByRole("heading", { name: "Original recorded failure" }),
  ).toBeVisible();
  await museumReplay.getByRole("button", { name: "Show finish" }).click();
  for (const lane of await museumReplay.locator(".race-lane").all())
    await expect(lane).toContainText("trapped · 1 turn used · 0 alarm");
  await museumReplay.getByRole("button", { name: "Close replay" }).click();
  const second = await browser.newContext();
  const challenger = await second.newPage();
  await challenger.goto(new URL(href!, page.url()).toString());
  await challenger
    .getByRole("button", { name: "Take the modest archway" })
    .click();
  await challenger
    .getByRole("button", { name: "Deploy paperwork decoy" })
    .click();
  await challenger
    .getByRole("button", { name: "Sneak past the guard" })
    .click();
  await challenger.getByRole("button", { name: "Inspect the room" }).click();
  await challenger
    .getByRole("button", { name: "Swap in the brass paperweight" })
    .click();
  await challenger
    .getByRole("button", { name: "Take the emergency exit" })
    .click();
  await expect(
    challenger.getByRole("heading", { name: "Lunch. Against all odds." }),
  ).toBeVisible();
  await expect(
    challenger.getByText("You finished ahead of the original failure", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    challenger.getByRole("heading", { name: "You beat the frozen ghost." }),
  ).toBeVisible();
  const race = challenger.getByRole("region", { name: "Frozen ghost race" });
  await expect(race.getByRole("slider", { name: "Race timeline" })).toHaveValue(
    "0",
  );
  await race.getByRole("button", { name: "Show finish" }).click();
  await expect(race.locator(".race-lane").first()).toContainText(
    "escaped · 6 turns used · 0 alarm",
  );
  await expect(race.locator(".race-lane").last()).toContainText(
    "trapped · 1 turn used · 0 alarm",
  );
  await challenger.reload();
  await expect(
    challenger.getByRole("heading", { name: "Lunch. Against all odds." }),
  ).toBeVisible();
  await challenger.getByRole("button", { name: "Retry this scenario" }).click();
  await expect(
    challenger.getByText("Informed retry", { exact: true }),
  ).toBeVisible();
  await page.goto("/play");
  await page.getByRole("button", { name: "Withdraw exhibit" }).click();
  await expect(
    page.getByRole("link", { name: "Open shareable challenge" }),
  ).toHaveCount(0);
  const third = await browser.newContext();
  const removed = await third.newPage();
  await removed.goto(new URL(href!, page.url()).toString());
  await expect(
    removed.getByRole("alert").filter({ hasText: "withdrawn" }),
  ).toBeVisible();
  await third.close();
  await second.close();
  expect(errors).toEqual([]);
});

test("mobile layout, keyboard play and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play");
  const start = page.getByRole("button", { name: "Start guest adventure" });
  await expect(start).toBeEnabled();
  await start.focus();
  await page.keyboard.press("Enter");
  const arch = page.getByRole("button", { name: "Take the modest archway" });
  await arch.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Inspect the room" }).click();
  await page
    .getByRole("button", { name: "Crawl through the service vent" })
    .click();
  await page
    .getByRole("button", { name: "Replace it with your decoy" })
    .click();
  await page.getByRole("button", { name: "Take the emergency exit" }).click();
  await expect(
    page.getByRole("heading", { name: "Lunch. Against all odds." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("design stays accessible at narrow widths and enlarged text", async ({
  page,
}) => {
  await page.goto("/play");
  await expect(
    page.getByRole("button", { name: "Start guest adventure" }),
  ).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the adventure" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "The Great Sandwich Incident" }),
  ).toBeFocused();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/design-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  const start = page.getByRole("button", { name: "Start guest adventure" });
  const bounds = await start.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await page.addStyleTag({
    content:
      "body { font-size: 200%; } p, a, button, small, label { font-size: 1em !important; }",
  });
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter(
        (element) => element.getBoundingClientRect().right > innerWidth + 1,
      )
      .map((element) => `${element.tagName}.${element.className}`),
  );
  expect(overflow).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await start.click();
  await expect(
    page.getByRole("button", { name: "Take the modest archway" }),
  ).toBeVisible();
  const gameAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(gameAudit.violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  const inspect = page.getByRole("button", { name: "Inspect the room" });
  await inspect.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(inspect).toBeFocused();
  expect(
    await inspect.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("solid");
  expect(
    await inspect.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("3px");
});

test("a lost response retries the persisted turn without double spending", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  let lostResponse = false;
  await page.route("**/api/game", async (route) => {
    const request = route.request();
    if (
      !lostResponse &&
      request.method() === "POST" &&
      request.postDataJSON().operation === "step"
    ) {
      lostResponse = true;
      await route.fetch(); // Commit to the real local service, then discard only the reply.
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Inspect the room" }).click();
  await expect(
    page.getByRole("button", { name: "Retry saved request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry saved request" }).click();
  await expect(page.locator(".stats")).toContainText("9");
  await expect(page.locator(".clue")).toContainText("no hinges");
  await page.reload();
  await expect(page.locator(".stats")).toContainText("9");
});

test("a guest rematch races the previous version with a keyboard-controlled clock", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await expect(
    page.getByRole("heading", { name: "Your first ghost starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await page.getByRole("button", { name: "Race my new ghost" }).click();
  await expect(
    page.getByRole("heading", { name: "Your opponent is ready." }),
  ).toBeVisible();
  const frozen = await page.locator(".race-opponent small").textContent();
  await page.reload();
  await expect(page.locator(".race-opponent small")).toHaveText(frozen ?? "");
  await page.getByRole("button", { name: "Take the modest archway" }).click();
  await page.getByRole("button", { name: "Inspect the room" }).click();
  await page
    .getByRole("button", { name: "Crawl through the service vent" })
    .click();
  await page
    .getByRole("button", { name: "Replace it with your decoy" })
    .click();
  await page.getByRole("button", { name: "Take the emergency exit" }).click();
  const race = page.getByRole("region", { name: "Frozen ghost race" });
  await expect(
    race.getByRole("heading", { name: "You beat the frozen ghost." }),
  ).toBeVisible();
  const clock = race.getByRole("slider", { name: "Race timeline" });
  await clock.focus();
  for (let tick = 0; tick < 3; tick++) await page.keyboard.press("ArrowRight");
  await expect(clock).toHaveValue("3");
  await expect(race.locator(".race-lane").first()).toContainText(
    "Still in the service vent",
  );
  await expect(race.locator(".race-lane").last()).toContainText(
    "trapped · 1 turn used",
  );
  await page.keyboard.press("ArrowRight");
  await expect(race.locator(".race-lane").first()).toContainText(
    "Room 3 · 4 turns used",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({
    content:
      "body { font-size: 200%; } p, a, button, small, label { font-size: 1em !important; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await race.getByRole("button", { name: "Show finish" }).click();
  await expect(race.locator(".race-lane").first()).toContainText(
    "escaped · 6 turns used · 0 alarm",
  );
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.reload();
  await expect(race.getByRole("slider", { name: "Race timeline" })).toHaveValue(
    "0",
  );
  await expect(race.getByText(frozen ?? "", { exact: false })).toBeAttached();
});
