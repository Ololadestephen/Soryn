import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
let directory: string;
let bundle: string;
test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "soryn-privy-bridge-"));
  execFileSync(process.execPath, [
    resolve("tests/browser-support/privy-bridge/build.mjs"),
    directory,
  ]);
  bundle = readFileSync(join(directory, "bridge.js"), "utf8");
});
test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle });
});
test("mocked Privy bridge filters linked Ethereum wallets, selects their provider, and clears descendant state on wallet/user changes", async ({
  page,
}) => {
  const wallets = page.getByTestId("wallets"),
    draft = page.getByLabel("Private draft");
  await expect(wallets).toContainText("First");
  await expect(wallets).toContainText("Second");
  await expect(wallets).not.toContainText("Unlinked");
  await expect(wallets).not.toContainText("Solana");
  await draft.fill("private draft");
  await page.getByLabel("Wallet", { exact: true }).selectOption("0xbbbb");
  await expect(page.getByTestId("address")).toHaveText("0xbbbb");
  await expect(draft).toHaveValue("");
  await page.getByRole("button", { name: "Get provider" }).click();
  await expect(page.getByTestId("result")).toContainText('"fixture":"second"');
  await draft.fill("another private draft");
  await page.getByRole("button", { name: "Change user" }).click();
  await expect(draft).toHaveValue("");
  await expect(page.getByTestId("result")).toHaveText("");
  await page.getByRole("button", { name: "Toggle sign-in" }).click();
  await expect(page.getByTestId("address")).toHaveText("");
  await page.getByRole("button", { name: "Get provider" }).click();
  await expect(page.getByTestId("result")).toContainText("Sign in with Privy");
});
test("mocked Privy bridge requires both proof tokens", async ({ page }) => {
  await page.getByRole("button", { name: "Get headers" }).click();
  await expect(page.getByTestId("result")).toContainText(
    "Bearer access-fixture",
  );
  await expect(page.getByTestId("result")).toContainText("identity-fixture");
  await page.getByRole("button", { name: "Remove access token" }).click();
  await page.getByRole("button", { name: "Get headers" }).click();
  await expect(page.getByTestId("result")).toContainText("token unavailable");
});
test("mocked Privy bridge rejects missing identity token even with an access token", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Remove identity token" }).click();
  await page.getByRole("button", { name: "Get headers" }).click();
  await expect(page.getByTestId("result")).toContainText("token unavailable");
});

test("cached SDK identity proof survives a users/me refresh limit without requesting another refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Limit identity refresh" }).click();
  await page.getByRole("button", { name: "Get headers" }).click();
  await expect(page.getByTestId("result")).toContainText(
    "Bearer access-fixture",
  );
  await expect(page.getByTestId("identity-refreshes")).toHaveText("0");
});
