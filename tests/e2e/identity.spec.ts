import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Privy configuration state is honest and leaves guest adventures playable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/character");
  await expect(
    page.getByRole("heading", { name: "My Chog", exact: true }),
  ).toHaveCount(1);
  const connect = page.getByRole("button", {
    name: "Connect wallet",
    exact: true,
  });
  await expect(connect).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore Chogs", exact: true }),
  ).toHaveAttribute("href", "/explore");
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
  await page.goto("/explore");
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
