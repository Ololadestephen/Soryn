import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function winLunch(page: Page) {
  for (const name of [
    "Take the modest archway",
    "Deploy paperwork decoy",
    "Sneak past the guard",
    "Inspect the room",
    "Swap in the brass paperweight",
    "Take the emergency exit",
  ])
    await page.getByRole("button", { name }).click();
}

test("private journal reopens older chapters and recovers a selected ghost race after a lost reply", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/journal");
  const journal = page.getByRole("region", {
    name: "Your past has unfinished business.",
  });
  await expect(
    journal.getByRole("heading", { name: "A clean record. Suspicious." }),
  ).toBeVisible();
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await page.goto("/journal");
  const firstSession = await (await page.request.get("/api/game")).json();
  const firstVersion = firstSession.journal.chapters[0].ghostVersion as string;
  expect(firstVersion).toBeTruthy();
  await page.goto("/play");
  await page.getByRole("button", { name: "Start a new adventure" }).click();
  await winLunch(page);
  await page.goto("/journal");
  await expect(journal.locator(".chapter-row")).toHaveCount(2);
  const laterSession = await (await page.request.get("/api/game")).json();
  expect(laterSession.journal.chapters[0].ghostVersion).not.toBe(firstVersion);
  const oldChapter = journal.locator(".chapter-row").last();
  await oldChapter.getByRole("button", { name: "Open chapter" }).click();
  const review = journal.getByRole("region", { name: "Saved guest chapter" });
  await expect(
    review.getByRole("heading", { name: "Saved chapter replay" }),
  ).toBeFocused();
  await review.getByRole("button", { name: "Next turn" }).click();
  await expect(
    review.getByText("Exact recorded replay · 1 / 1 actions"),
  ).toBeVisible();
  const savedActive = await page.request.get("/api/game");
  expect((await savedActive.json()).run.observation.outcome).toBe("escaped");
  await page.goto("/museum");
  await page.goto("/journal");
  await expect(
    review.getByRole("heading", { name: "Saved chapter replay" }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Close chapter" }).click();
  await expect(
    oldChapter.getByRole("button", { name: "Open chapter" }),
  ).toBeFocused();
  let lost = false;
  await page.route("**/api/game", async (route) => {
    if (
      !lost &&
      route.request().method() === "POST" &&
      route.request().postDataJSON().operation === "race"
    ) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await oldChapter.getByRole("button", { name: "Race this ghost" }).click();
  await page.getByRole("button", { name: "Retry saved request" }).click();
  await expect(page.locator(".race-opponent")).toContainText(
    firstVersion.slice(0, 12),
  );
  await page.goto("/journal");
  await expect(
    oldChapter.getByRole("button", { name: "Race this ghost" }),
  ).toBeDisabled();
  await expect(
    oldChapter.getByRole("button", { name: "Open chapter" }),
  ).toBeEnabled();
  await page.reload();
  const recovered = await page.request.get("/api/game");
  expect((await recovered.json()).run.rival.version).toBe(firstVersion);
  await oldChapter.getByRole("button", { name: "Open chapter" }).click();
  const unchanged = await page.request.get("/api/game");
  expect((await unchanged.json()).run.observation.turns).toBe(10);
  await review.getByRole("button", { name: "Close chapter" }).click();
  await page.goto("/play");
  await winLunch(page);
  await page.goto("/journal");
  await expect(journal.locator(".chapter-row")).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content:
      "body { font-size: 200%; } p, a, button, small, label { font-size: 1em !important; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  const isolated = await browser.newContext();
  const stranger = await isolated.newPage();
  await stranger.goto("/journal");
  await expect(
    stranger.getByRole("heading", { name: "A clean record. Suspicious." }),
  ).toBeVisible();
  await isolated.close();
  expect(errors).toEqual([]);
});

test("museum progress keeps cohorts separate and removes withdrawn opponents", async ({
  page,
  browser,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Exhibit title").fill("A journal QA disaster");
  await page.getByRole("button", { name: "Publish my failure" }).click();
  const href = await page
    .getByRole("link", { name: "Open shareable challenge" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const context = await browser.newContext();
  const challenger = await context.newPage();
  await challenger.goto(new URL(href ?? "/", page.url()).toString());
  await challenger
    .getByRole("button", { name: "Rush the heroic door" })
    .click();
  await challenger.getByRole("button", { name: "Retry this scenario" }).click();
  await challenger
    .getByRole("button", { name: "Rush the heroic door" })
    .click();
  await challenger.goto("/journal");
  const progress = challenger.getByRole("region", {
    name: "Guest challenge progress",
  });
  await progress.getByRole("button", { name: "Rematch challenge" }).click();
  await winLunch(challenger);
  await challenger.goto("/journal");
  const cohorts = progress.locator(".cohort-entry");
  await expect(cohorts).toHaveCount(2);
  await expect(cohorts.first()).toContainText("1 saved attempt");
  await expect(cohorts.first()).toContainText(
    "Best result unchanged within this cohort",
  );
  await expect(cohorts.last()).toContainText("2 saved attempts");
  await expect(cohorts.last()).toContainText("Improved within this cohort");
  await expect(cohorts.last()).toContainText("ahead of the original");
  await page.getByRole("button", { name: "Withdraw exhibit" }).click();
  await challenger.reload();
  await expect(
    progress.getByRole("heading", { name: "Withdrawn exhibit" }),
  ).toBeVisible();
  await expect(
    progress.getByRole("button", { name: "Rematch challenge" }),
  ).toHaveCount(0);
  await expect(
    progress.getByText("ahead of the original", { exact: false }),
  ).toHaveCount(0);
  const journal = challenger.getByRole("region", {
    name: "Your past has unfinished business.",
  });
  let failedRead = false;
  await challenger.route("**/api/game?chapter=*", async (route) => {
    if (!failedRead) {
      failedRead = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await journal
    .locator(".chapter-row")
    .first()
    .getByRole("button", { name: "Open chapter" })
    .click();
  await journal.getByRole("button", { name: "Retry chapter request" }).click();
  const review = journal.getByRole("region", { name: "Saved guest chapter" });
  await expect(
    review.getByRole("heading", { name: "Saved chapter replay" }),
  ).toBeFocused();
  await expect(
    review.getByText("Revisit the frozen opponent race"),
  ).toHaveCount(0);
  const audit = await new AxeBuilder({ page: challenger })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await context.close();
});
