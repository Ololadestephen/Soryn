import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
let directory: string, bundle: string;
test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "soryn-access-ui-"));
  execFileSync(process.execPath, [
    resolve("tests/browser-support/privy-bridge/build.mjs"),
    directory,
    resolve("tests/browser-support/access-gate/entry.tsx"),
  ]);
  bundle = readFileSync(join(directory, "bridge.js"), "utf8");
});
test.afterAll(() => rmSync(directory, { recursive: true, force: true }));

/** UI-only adapter; real signatures/authorization are exercised separately by integration tests. */
async function fixture(
  page: Page,
  options: {
    initial?: "token" | "paused";
    holdInitial?: boolean;
    logoutFailure?: boolean;
  } = {},
) {
  let signedIn = options.initial === "token",
    reads = 0,
    releaseInitial = () => {},
    releaseHoldings = () => {},
    holdHoldings = false;
  const initial = new Promise<void>((r) => {
      releaseInitial = r;
    }),
    holdings = new Promise<void>((r) => {
      releaseHoldings = r;
    });
  await page.route("**/__access_fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body><div id="root"></div></body></html>',
    }),
  );
  await page.route("**/api/access", async (route) => {
    const data =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : null;
    let body: unknown;
    if (data?.operation === "challenge")
      body = {
        nonce: "a".repeat(48),
        message: "Labelled UI fixture only; never a real wallet request",
      };
    else if (data?.operation === "verify") {
      signedIn = true;
      body = { signedIn: true };
    } else if (data?.operation === "logout") {
      await page.evaluate(() =>
        window.accessFixture.events.push("server-logout"),
      );
      if (options.logoutFailure) {
        await route.fulfill({
          status: 503,
          json: { error: "Fixture session revocation unavailable" },
        });
        return;
      }
      signedIn = false;
      body = { signedOut: true };
    } else {
      const read = ++reads;
      if (read === 1 && options.holdInitial) await initial;
      else if (signedIn && holdHoldings) await holdings;
      body =
        read === 1 && options.holdInitial
          ? { status: "signed-out", authenticated: false }
          : signedIn
            ? { status: "token", authenticated: true }
            : options.initial === "paused"
              ? {
                  status: "paused",
                  authenticated: false,
                  message:
                    "Holder access is paused. Practice and existing records remain available.",
                }
              : { status: "signed-out", authenticated: false };
      body = {
        message: "Connect wallet",
        fighters: signedIn
          ? ["pip", "bolt", "patch", "moss", "aegis", "nyx"]
          : [],
        checkedAt: signedIn ? Date.now() : null,
        ...(body as object),
      };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/__access_fixture");
  await page.addScriptTag({ content: bundle });
  return {
    releaseInitial,
    holdHoldings: () => {
      holdHoldings = true;
    },
    releaseHoldings,
    reads: () => reads,
  };
}

test("labelled UI separates wallet signing from holdings verification and signs out server-first", async ({
  page,
}) => {
  const f = await fixture(page);
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Signing in to your wallet…",
  );
  f.holdHoldings();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.accessFixture.events.includes("signature-request"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.accessFixture.releaseSignature());
  await expect(page.getByRole("status")).toHaveText("Verifying holdings…");
  await expect(page.getByTestId("private-progress")).toHaveCount(0);
  f.releaseHoldings();
  await expect(page.getByTestId("private-progress")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByTestId("private-progress")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  const events = await page.evaluate(() => window.accessFixture.events);
  expect(events.indexOf("server-logout")).toBeLessThan(
    events.indexOf("provider-logout"),
  );
});
test("a delayed anonymous read cannot overwrite a freshly signed-in entitlement", async ({
  page,
}) => {
  const f = await fixture(page, { holdInitial: true });
  await expect.poll(f.reads).toBe(1);
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.accessFixture.events.includes("signature-request"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.accessFixture.releaseSignature());
  await expect(page.getByTestId("private-progress")).toBeVisible();
  const stale = page.waitForResponse((response) =>
    response.url().endsWith("/api/access"),
  );
  f.releaseInitial();
  await (await stale).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByTestId("private-progress")).toBeVisible();
});
test("paused state is visible before sign-in and failed revocation does not pretend to sign out", async ({
  page,
}) => {
  await fixture(page, { initial: "paused" });
  await expect(
    page.getByText(
      "Holder access is paused. Practice and existing records remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByTestId("private-progress")).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await fixture(page, { initial: "token", logoutFailure: true });
  await expect(page.getByTestId("private-progress")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Fixture session revocation unavailable",
  );
  expect(await page.evaluate(() => window.accessFixture.events)).not.toContain(
    "provider-logout",
  );
});
