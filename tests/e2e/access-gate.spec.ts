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
    profile?: boolean;
    controller?: boolean;
    pausedAfter?: boolean;
    lostVerify?: boolean;
    limitedVerify?: boolean;
    rejectedVerify?: boolean;
    limitedHoldings?: boolean;
    holdVerification?: boolean;
    expiredRefresh?: boolean;
  } = {},
) {
  let signedIn = options.initial === "token",
    reads = 0,
    challenges = 0,
    verifies = 0,
    limitedOnce = !!options.limitedVerify,
    holdingsLimited = !!options.limitedHoldings,
    releaseInitial = () => {},
    releaseHoldings = () => {},
    releaseVerification = () => {},
    holdHoldings = false;
  const initial = new Promise<void>((r) => {
      releaseInitial = r;
    }),
    holdings = new Promise<void>((r) => {
      releaseHoldings = r;
    });
  const verification = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });
  await page.route("**/__access_fixture*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body><div id="root"></div></body></html>',
    }),
  );
  await page.route("**/api/access*", async (route) => {
    const data =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : null;
    let body: unknown;
    if (data?.operation === "refresh" && options.expiredRefresh) {
      signedIn = false;
      await route.fulfill({
        status: 401,
        json: { error: "Wallet session expired. Sign in again." },
      });
      return;
    }
    if (data?.operation === "challenge") {
      challenges++;
      body = {
        nonce: "a".repeat(48),
        message: "Labelled UI fixture only; never a real wallet request",
      };
    } else if (data?.operation === "verify") {
      verifies++;
      if (options.holdVerification) await verification;
      if (limitedOnce) {
        limitedOnce = false;
        await route.fulfill({
          status: 429,
          headers: { "Retry-After": "2" },
          json: { error: "Fixture rate limit" },
        });
        return;
      }
      if (options.rejectedVerify) {
        await route.fulfill({
          status: 401,
          json: { error: "Wallet signature invalid." },
        });
        return;
      }
      signedIn = true;
      if (options.lostVerify) {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: "Synthetic lost response body",
        });
        return;
      }
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
      if (
        signedIn &&
        holdingsLimited &&
        !route.request().url().includes("records=1")
      ) {
        holdingsLimited = false;
        await route.fulfill({
          status: 429,
          headers: { "Retry-After": "2" },
          json: { error: "Fixture holdings read limited" },
        });
        return;
      }
      if (read === 1 && options.holdInitial) await initial;
      else if (
        signedIn &&
        holdHoldings &&
        !route.request().url().includes("records=1")
      )
        await holdings;
      body =
        read === 1 && options.holdInitial
          ? { status: "signed-out", authenticated: false }
          : signedIn
            ? {
                status: options.pausedAfter ? "paused" : "token",
                authenticated: true,
              }
            : options.initial === "paused"
              ? {
                  status: "paused",
                  authenticated: false,
                  message:
                    "Holder access is paused. Practice and existing records remain available.",
                }
              : { status: "signed-out", authenticated: false };
      body = {
        message:
          signedIn && options.pausedAfter
            ? "Holder access is paused. Practice and existing records remain available."
            : "Connect wallet",
        fighters: signedIn
          ? ["pip", "bolt", "patch", "moss", "aegis", "nyx"]
          : [],
        checkedAt: signedIn ? Date.now() : null,
        ...(body as object),
      };
    }
    if (route.request().url().includes("records=1") && signedIn)
      body = {
        status: "practice-only",
        authenticated: true,
        message: "Private wallet records",
        fighters: [],
        checkedAt: null,
      };
    await route.fulfill({ json: body });
  });
  await page.goto(
    "/__access_fixture" +
      (options.controller
        ? "?controller=1"
        : options.profile
          ? "?profile=1"
          : ""),
  );
  await page.addScriptTag({ content: bundle });
  return {
    releaseInitial,
    releaseVerification,
    holdHoldings: () => {
      holdHoldings = true;
    },
    releaseHoldings,
    reads: () => reads,
    challenges: () => challenges,
    verifies: () => verifies,
    remount: async () => {
      await page.reload();
      await page.addScriptTag({ content: bundle });
    },
  };
}

test("labelled UI separates wallet signing from holdings verification and signs out server-first", async ({
  page,
}) => {
  const f = await fixture(page);
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Waiting for signature…");
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
  await page.locator(".wallet-menu > summary").click();
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
  await page.locator(".wallet-menu > summary").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Fixture session revocation unavailable",
  );
  expect(await page.evaluate(() => window.accessFixture.events)).not.toContain(
    "provider-logout",
  );
});

async function finishSignIn(page: Page) {
  const before = await page.evaluate(
    () =>
      window.accessFixture.events.filter(
        (event) => event === "signature-request",
      ).length,
  );
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.accessFixture.events.filter(
            (event) => event === "signature-request",
          ).length,
      ),
    )
    .toBe(before + 1);
  await page.evaluate(() => window.accessFixture.releaseSignature());
}
test("labelled My Chog authenticates separately from paused admissions, survives refresh, signs out and reconnects", async ({
  page,
}) => {
  const f = await fixture(page, { profile: true, pausedAfter: true });
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access is paused/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toHaveCount(0);
  await f.remount();
  await expect(
    page.getByText(/Signed in.*Holder access is paused/),
  ).toBeVisible();
  expect(f.challenges()).toBe(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access is paused/),
  ).toBeVisible();
  expect(f.challenges()).toBe(2);
});
test("same-turn double submission sends one challenge and one signature/verification", async ({
  page,
}) => {
  const f = await fixture(page, { profile: true, holdVerification: true });
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  await expect.poll(() => f.challenges()).toBe(1);
  await expect(
    page.getByText("Waiting for signature…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.accessFixture.releaseSignature());
  await expect(
    page.getByText("Completing sign-in…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeDisabled();
  f.releaseVerification();
  await expect(
    page.getByText(/Signed in.*Holder access unlocked/),
  ).toBeVisible();
  expect(f.verifies()).toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.accessFixture.events.filter((x) => x === "signature-request")
          .length,
    ),
  ).toBe(1);
});
test("lost successful verification response recovers authenticated UI without another signature", async ({
  page,
}) => {
  const f = await fixture(page, {
    profile: true,
    lostVerify: true,
    pausedAfter: true,
  });
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access is paused/),
  ).toBeVisible();
  expect(f.challenges()).toBe(1);
  expect(f.verifies()).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("signature rejection and verification rejection stop without automatic retries", async ({
  page,
}) => {
  let f = await fixture(page, { profile: true });
  await page
    .getByRole("button", { name: "Sign in to wallet play", exact: true })
    .click();
  await expect.poll(f.challenges).toBe(1);
  await expect(
    page.getByText("Waiting for signature…", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.accessFixture.rejectSignature());
  await expect(page.getByRole("alert")).toContainText("Signature rejected");
  expect(f.verifies()).toBe(0);
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeEnabled();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  f = await fixture(page, { profile: true, rejectedVerify: true });
  await finishSignIn(page);
  await expect(page.getByRole("alert")).toContainText(
    "Wallet signature invalid",
  );
  expect(f.verifies()).toBe(1);
  expect(f.challenges()).toBe(1);
});
test("429 honors Retry-After, disables repeats, and recovers only after a manual retry", async ({
  page,
}) => {
  await page.clock.install();
  const f = await fixture(page, { profile: true, limitedVerify: true });
  await finishSignIn(page);
  await expect(
    page.getByText("Too many requests. Try again in 2 seconds.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(2100);
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeEnabled();
  expect(f.verifies()).toBe(1);
  expect(f.challenges()).toBe(1);
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access unlocked/),
  ).toBeVisible();
  expect(f.verifies()).toBe(2);
});

test("a rate limit after session confirmation keeps My Chog authenticated rather than asking for another signature", async ({
  page,
}) => {
  await page.clock.install();
  const f = await fixture(page, { profile: true, limitedHoldings: true });
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Private wallet records/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refresh holdings", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(2100);
  await page
    .getByRole("button", { name: "Refresh holdings", exact: true })
    .click();
  await expect(
    page.getByText(/Signed in.*Holder access unlocked/),
  ).toBeVisible();
  expect(f.challenges()).toBe(1);
  expect(f.verifies()).toBe(1);
});

test("an explicitly expired server session returns to sign-in without treating a connected wallet as authenticated", async ({
  page,
}) => {
  const f = await fixture(page, { profile: true, expiredRefresh: true });
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access unlocked/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh holdings", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Wallet session expired");
  await expect(
    page.getByRole("button", { name: "Sign in to wallet play", exact: true }),
  ).toBeEnabled();
  await finishSignIn(page);
  await expect(
    page.getByText(/Signed in.*Holder access unlocked/),
  ).toBeVisible();
  expect(f.challenges()).toBe(2);
});

test("the actual controller serializes simultaneous calls and cancels verification when the principal view is torn down", async ({
  page,
}) => {
  const f = await fixture(page, { controller: true });
  await page
    .getByRole("button", { name: "Start concurrent sign-in", exact: true })
    .click();
  await expect(page.getByText("signature", { exact: true })).toBeVisible();
  expect(f.challenges()).toBe(1);
  await page
    .getByRole("button", { name: "Unmount sign-in view", exact: true })
    .click();
  await page.evaluate(() => window.accessFixture.releaseSignature());
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(f.verifies()).toBe(0);
  expect(f.challenges()).toBe(1);
});
