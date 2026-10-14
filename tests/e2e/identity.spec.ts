import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Privy configuration state is honest and leaves guest adventures playable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/character");
  await expect(page.locator(".identity-status")).toBeVisible();
  const setupPending = await page
    .getByRole("heading", { name: "Privy setup is pending." })
    .isVisible();
  if (setupPending)
    await expect(
      page.getByRole("button", { name: "Sign in with Privy" }),
    ).toBeDisabled();
  else
    await expect(
      page.getByRole("button", { name: "Sign in with Privy" }),
    ).toBeVisible(); // Provider readiness depends on this test origin and network; guest play must remain usable.
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toHaveCount(0);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await expect(page.locator("#adventure")).toContainText("Guest practice");
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await expect(page.getByRole("region", { name: "Run result" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("public token history requires no Privy login and protected APIs fail closed", async ({
  page,
  request,
}) => {
  await page.goto("/character");
  await page.getByLabel("Public history token ID").fill("276");
  await page.getByRole("button", { name: "Read public chapters" }).click();
  await expect(page.locator(".public-chapters")).toContainText("Token 276");
  const bootstrap = await request.get("/api/identity");
  expect(bootstrap.status()).toBe(200);
  const rejected = await request.post("/api/identity", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      operation: "challenge",
      wallet: `0x${"1".repeat(40)}`,
      identity: {
        chainId: 143,
        collection: "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763",
        tokenId: "276",
      },
    },
  });
  expect([401, 503]).toContain(rejected.status());
  expect(await rejected.json()).toMatchObject({
    error: expect.stringContaining("Privy"),
  });
});
