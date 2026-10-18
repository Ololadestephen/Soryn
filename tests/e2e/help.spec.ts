import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("help is reachable through navigation and keeps the Play now return path", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".nav-more summary").click();
  await page
    .getByRole("navigation", { name: "Secondary navigation" })
    .getByRole("link", { name: "Help & FAQ" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(
    page.getByRole("heading", { name: "Help & FAQ", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".nav-more a[href='/help']")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page
    .locator(".help-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await expect(page).toHaveURL(/\/start$/);
});

for (const width of [320, 390, 1440]) {
  test(`readable keyboard-accessible help at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/help#access-wallets");
    const section = page.getByRole("region", { name: "Access & wallets" });
    const question = section.locator("details").first();
    await question.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(question).toHaveAttribute("open", "");
    await expect(question.locator("p")).toContainText("not spent");
    await expect(question.locator("p")).toContainText("paused");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await question.locator("summary").press("Enter");
    await expect(question).not.toHaveAttribute("open", "");
  });
}

test("FAQ works without JavaScript and protects the saved-progress recovery paths", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("/help");
  const question = page.locator("details").filter({
    has: page.locator("summary", {
      hasText: "Where is my guest progress saved?",
    }),
  });
  await question.locator("summary").click();
  await expect(question.locator("p")).toBeVisible();
  await expect(question.locator("p")).toContainText("do not clear");
  const recovery = page.getByRole("navigation", {
    name: "Saved progress help",
  });
  await expect(
    recovery.getByRole("link", { name: "Wallet history" }),
  ).toHaveAttribute("href", "/history?as=holder");
  await recovery.getByRole("link", { name: "Guest battle history" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await context.close();
});

test("mobile menu and footer expose help without blocking page controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/start");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Help & FAQ" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("footer").getByRole("link", { name: "Help & FAQ" }),
  ).toHaveAttribute("href", "/help");
});
