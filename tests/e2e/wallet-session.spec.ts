import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
let directory: string, bundle: string;
test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "soryn-wallet-session-"));
  execFileSync(process.execPath, [
    resolve("tests/browser-support/privy-bridge/build.mjs"),
    directory,
    resolve("tests/browser-support/wallet-session/entry.tsx"),
  ]);
  bundle = readFileSync(join(directory, "bridge.js"), "utf8");
});
test.afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("labelled SDK fixture retains one provider and selected wallet across every wallet mode; server reads recover authentication without another signature", async ({
  page,
}) => {
  const calls: { method: string; wallet: string | undefined }[] = [];
  await page.route("**/__wallet_scope_fixture", (r) =>
    r.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
  );
  await page.route("**/api/access*", async (r) => {
    calls.push({
      method: r.request().method(),
      wallet: r.request().headers()["x-soryn-wallet"],
    });
    expect(r.request().headers()["authorization"]).toBe(
      "Bearer access-fixture",
    );
    await r.fulfill({
      json: {
        status: "paused",
        message: "Labelled fixture: admissions paused",
        authenticated: true,
        fighters: [],
        checkedAt: null,
      },
    });
  });
  await page.route("**/api/story*", (r) => r.fulfill({ json: {} }));
  await page.goto("/__wallet_scope_fixture");
  await page.addScriptTag({ content: bundle });
  await expect(
    page.getByRole("heading", { name: "Guest Practice" }),
  ).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.getByRole("button", { name: "character", exact: true }).click();
  await expect(page.getByTestId("session")).toHaveText("Signed in");
  await page
    .getByRole("button", { name: "Select second fixture wallet" })
    .click();
  await expect(page.getByTestId("selected-wallet")).toHaveText("0xbbbb");
  for (const mode of [
    "challenge",
    "match",
    "story",
    "history",
    "practice",
    "character",
  ]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    if (mode === "practice") {
      await expect(
        page.getByRole("heading", { name: "Guest Practice" }),
      ).toBeVisible();
      continue;
    }
    await expect(page.getByTestId("session")).toHaveText("Signed in");
    await expect(page.getByTestId("selected-wallet")).toHaveText("0xbbbb");
    await expect(page.getByTestId("provider-mounts")).toHaveText("1");
    await expect(page.getByTestId("failure")).toBeEmpty();
  }
  expect(calls.length).toBeGreaterThanOrEqual(7);
  expect(calls.every((c) => c.method === "GET")).toBe(true);
  expect(calls.at(-1)?.wallet).toBe("0xbbbb");
});
