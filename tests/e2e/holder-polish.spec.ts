import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  fixtureReset,
  fixtureSignIn,
  fixtureWalletAccess,
} from "../browser-support/holder";
import { CHOG_MINIMUM } from "../../src/domain/access/policy";
import type { MyChogFixture } from "../browser-support/mychog/types";

const evidence = ".cache/holder-polish-500";
let directory: string, bundle: string;
const css = [
  "globals",
  "layout",
  "landing",
  "identity",
  "holder-access",
  "mychog",
]
  .map((name) => readFileSync(`src/app/${name}.css`, "utf8"))
  .join("\n");
test.beforeAll(() => {
  mkdirSync(evidence, { recursive: true });
  directory = mkdtempSync(join(tmpdir(), "soryn-mychog-ui-"));
  execFileSync(process.execPath, [
    resolve("tests/browser-support/privy-bridge/build.mjs"),
    directory,
    resolve("tests/browser-support/mychog/entry.tsx"),
  ]);
  bundle = readFileSync(join(directory, "bridge.js"), "utf8");
});
test.afterAll(() => rmSync(directory, { recursive: true, force: true }));
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function mount(
  page: Page,
  session: { wallet: string; headers: Record<string, string> },
  connected = true,
) {
  await page.addInitScript(
    (state: MyChogFixture) => {
      window.mychogFixture = state;
    },
    { ...session, events: [], connected },
  );
  await page.route("**/__mychog_fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html lang="en"><head><title>My Chog fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main id="root" style="max-width:1240px;margin:auto;padding:24px"></main></body></html>`,
    }),
  );
  await page.route("**/api/**", async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), ...session.headers },
    });
    await route.fulfill({ response });
  });
  await page.goto("/__mychog_fixture");
  await page.addScriptTag({ content: bundle });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("500-token admission matches direct APIs and private records remain readable below it", async ({
  request,
  baseURL,
}) => {
  await fixtureReset(request);
  // Keep admission checkpoints separate from the complete Story journey fixtures.
  const admissionWallet = 7;
  const session = await fixtureWalletAccess(request, admissionWallet, baseURL!);
  for (const units of [
    50n * 10n ** 18n,
    499n * 10n ** 18n,
    CHOG_MINIMUM - 1n,
    CHOG_MINIMUM,
  ]) {
    expect(
      (
        await request.post("https://127.0.0.1:3200/control", {
          data: {
            operation: "balance",
            index: admissionWallet,
            units: units.toString(),
          },
        })
      ).ok(),
    ).toBe(true);
    const qualifies = units === CHOG_MINIMUM;
    const view = await (
      await request.post("/api/access", {
        headers: session.headers,
        data: { operation: "refresh" },
      })
    ).json();
    expect(view.status).toBe(qualifies ? "token" : "practice-only");
    for (const [path, operation] of [
      ["/api/story", { operation: "choose", fighter: "aegis" }],
      ["/api/match", { operation: "join" }],
      ["/api/pvp", { operation: "create" }],
    ] as const) {
      const reply = await request.post(path, {
        headers: session.headers,
        data: { mode: "guest", ...operation },
      });
      expect(reply.status(), await reply.text()).toBe(qualifies ? 200 : 403);
      if (qualifies && path === "/api/match")
        expect(
          (
            await request.post(path, {
              headers: session.headers,
              data: { operation: "cancel", mode: "guest" },
            })
          ).ok(),
        ).toBe(true);
      if (qualifies && path === "/api/pvp")
        expect(
          (
            await request.post(path, {
              headers: session.headers,
              data: {
                operation: "close",
                mode: "guest",
                invite: (await reply.json()).invite,
              },
            })
          ).ok(),
        ).toBe(true);
    }
    const history = await request.get("/api/access?records=1", {
      headers: session.headers,
    });
    expect((await history.json()).authenticated).toBe(true);
  }
});

for (const status of [
  "token",
  "nft",
  "both",
  "practice-only",
  "unavailable",
] as const) {
  test(`connected My Chog reflects actual ${status} fixture entitlement and perk controls`, async ({
    page,
    baseURL,
  }) => {
    await fixtureReset(page.request);
    const index =
      status === "token"
        ? 3
        : status === "practice-only"
          ? 5
          : status === "unavailable"
            ? 6
            : 0;
    const session = await fixtureWalletAccess(page.request, index, baseURL!);
    if (status === "nft" || status === "practice-only")
      await page.request.post("https://127.0.0.1:3200/control", {
        data: { operation: "balance", index, units: "0" },
      });
    if (status === "nft" || status === "both")
      await fixtureSignIn(page.request, 0);
    if (status === "unavailable")
      await page.request.post("https://127.0.0.1:3200/control", {
        data: { operation: "outage", enabled: true },
      });
    try {
      const qualified = ["token", "nft", "both"].includes(status);
      await page.request.post("/api/access", {
        headers: session.headers,
        data: { operation: "refresh" },
      });
      await mount(page, session);
      await expect(
        page.getByRole("heading", { name: "Available fighters", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".mychog-fighters li")).toHaveCount(
        qualified ? (status === "token" ? 6 : 12) : 4,
      );
      await expect(page.locator("#nft-competitor")).toHaveCount(
        status === "nft" || status === "both" ? 1 : 0,
      );
      if (status === "practice-only")
        await expect(page.getByRole("status")).toContainText(
          "Hold 500 $CHOG or a Chog NFT to unlock holder access.",
        );
      else if (status === "unavailable")
        await expect(page.getByRole("status")).toContainText(
          /couldn.t verify holdings/i,
        );
      else
        await expect(page.getByRole("status").first()).toContainText(
          status === "both"
            ? "$CHOG + Chog NFT"
            : status === "token"
              ? "$CHOG verified"
              : "Chog NFT verified",
        );
      if (status === "nft" || status === "both") {
        await expect(
          page.getByRole("heading", {
            name: "Selected competitor",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "View my private history", exact: true })
          .click();
        const history = page.locator("details").filter({
          has: page.locator("summary", {
            hasText: "Your private results and publication consent",
          }),
        });
        await expect(history).toHaveAttribute("open", "");
        const records = await (
          await page.request.get("/api/competitor?history=1", {
            headers: session.headers,
          })
        ).json();
        await expect(history.locator("article")).toHaveCount(
          records.entries.length,
        );
        if (!records.entries.length)
          await expect(history).toContainText("No private results yet.");
        await history.locator("summary").click();
        await expect(history).not.toHaveAttribute("open", "");
        expect(
          await page.locator("#nft-competitor").evaluate((element) => {
            const roster = document.querySelector(".mychog-fighters");
            return (
              !!roster &&
              !!(
                element.compareDocumentPosition(roster) &
                Node.DOCUMENT_POSITION_FOLLOWING
              )
            );
          }),
        ).toBe(true);
      }
      const equip = page.getByRole("checkbox", { name: /Equip holder frame/ });
      if (qualified) {
        if (!(await equip.isChecked())) await equip.click();
        await expect(equip).toBeChecked();
        await expect(page.locator(".holder-profile-frame")).toBeVisible();
        expect(
          (
            await (
              await page.request.get("/api/access", {
                headers: session.headers,
              })
            ).json()
          ).equipped,
        ).toBe(true);
      } else await expect(equip).toHaveCount(0);
      for (const [label, width, height] of [
        ["desktop", 1440, 1000],
        ["320", 320, 850],
        ["375", 375, 850],
        ["390", 390, 844],
        ["430", 430, 850],
        ["landscape", 844, 390],
      ] as const) {
        await page.setViewportSize({ width, height });
        await noOverflow(page);
        await page.screenshot({
          path: `${evidence}/fixture-${status}-${label}.png`,
          fullPage: true,
        });
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        document.body.style.fontSize = "24px";
      });
      await noOverflow(page);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Connect wallet", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Available fighters" }),
      ).toHaveCount(0);
    } finally {
      await page.request.post("https://127.0.0.1:3200/control", {
        data: { operation: "outage", enabled: false },
      });
    }
  });
}

test("compact entry delegates Connect wallet to its existing Privy adapter", async ({
  page,
  baseURL,
}) => {
  await mount(
    page,
    { wallet: `0x${"11".repeat(20)}`, headers: { Origin: baseURL! } },
    false,
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.mychogFixture.events)).toContain(
    "privy-login",
  );
});

test("entry, public discovery and landing remain responsive with one hero addition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [label, width, height] of [
    ["desktop", 1440, 1000],
    ["320", 320, 850],
    ["375", 375, 850],
    ["mobile", 390, 844],
    ["430", 430, 850],
    ["landscape", 844, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/character");
    await expect(
      page.getByRole("heading", { name: "My Chog", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Connect wallet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Public history token ID" }),
    ).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({
      path: `${evidence}/after-mychog-${label}.png`,
      fullPage: true,
    });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Play now", exact: true }).last(),
    ).toHaveAttribute("href", "/start");
    await expect(page.locator(".gateway-actions a")).toHaveCount(2);
    await noOverflow(page);
    await page.locator("#holders").scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("img", { name: "Armadillo companion", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${evidence}/after-landing-${label}.png`,
      fullPage: true,
    });
  }
  await page.goto("/character");
  await page.getByRole("link", { name: "Explore Chogs", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await page
    .getByRole("textbox", { name: "Public history token ID" })
    .fill("276");
  await page.getByRole("button", { name: "Read public chapters" }).click();
  await expect(
    page.getByRole("link", { name: "View public competitor profile" }),
  ).toHaveAttribute("href", "/chog/276");
  await expect(page.locator(".public-chapters")).toContainText("Token 276");
  await page.goto("/help#access-wallets");
  await page
    .getByText("Which modes are free, and which require holdings?", {
      exact: true,
    })
    .click();
  await expect(page.locator("#access-wallets")).toContainText(
    "at least 500 $CHOG",
  );
});

test("a former NFT keeper can reach authenticated historical records without reopening holder play", async ({
  page,
  baseURL,
}) => {
  await fixtureReset(page.request);
  const session = await fixtureWalletAccess(page.request, 0, baseURL!);
  await fixtureSignIn(page.request, 0);
  await page.request.post("/api/access", {
    headers: session.headers,
    data: { operation: "refresh" },
  });
  await page.request.post("https://127.0.0.1:3200/control", {
    data: { operation: "balance", index: 0, units: "0" },
  });
  await page.request.post("https://127.0.0.1:3200/control", {
    data: { operation: "transfer", owner: 1 },
  });
  await mount(page, session);
  await page
    .getByRole("button", { name: "Refresh holdings", exact: true })
    .click();
  await expect(page.locator(".mychog-fighters li")).toHaveCount(4);
  await expect(page.locator("#nft-competitor")).toHaveCount(0);
  await page
    .getByText("Previous NFT records and publication consent", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Private NFT records", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Private historical session only.", { exact: false }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/competitor?history=1", {
        headers: session.headers,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/pvp", {
        headers: session.headers,
        data: { operation: "create", mode: "guest" },
      })
    ).status(),
  ).toBe(403);
  await expect(
    page.getByRole("button", { name: "Publish this result", exact: true }),
  ).toHaveCount(0);
});
