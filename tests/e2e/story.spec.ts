import { expect, test } from "@playwright/test";

test("the opening story fight can be resumed", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/story");
  await expect(page.getByText(/Soryn fiction/)).toBeVisible();
  await page.getByRole("button", { name: "Pip", exact: true }).click();
  await expect(page.getByText(/Attack when the line is open/)).toBeVisible();
  await page.getByRole("button", { name: "Start battle" }).click();
  await expect(page.getByRole("button", { name: /Basic attack/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: /Basic attack/ })
      .or(page.getByRole("button", { name: "Resume battle" })),
  ).toBeVisible({ timeout: 20_000 });
});
