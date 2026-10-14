import { expect, test } from "@playwright/test";
test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: "on", size: { width: 1280, height: 800 } },
});
test("actual browser tour · fighter, companion special and four arenas", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Play now/ })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByRole("link", { name: /Meet the fighters/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Aegis Holder", exact: true }).click();
  await page.locator(".roster-body").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Preview special/ }).click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
  );
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Ember Holder", exact: true }).click();
  await page.locator(".roster-body").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Preview special/ }).click();
  await expect(page.locator(".dossier-stage")).toHaveAttribute(
    "data-preview-status",
    "complete",
  );
  for (const name of [
    "Ruined Sanctuary",
    "Moonlit Grove",
    "Ember Foundry",
    "Sky Temple",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.locator("#arenas").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
  }
  await page.getByRole("link", { name: /Battle here/ }).click();
  await expect(
    page.getByRole("radio", { name: "Sky Temple", exact: true }),
  ).toBeChecked();
  await page.waitForTimeout(1400);
  const video = page.video();
  await page.close();
  await video?.saveAs("docs/evidence/game-rebrand/after/roster-tour.webm");
});
