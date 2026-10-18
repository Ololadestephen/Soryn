import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureHolder } from "../../browser-support/holder";
import { attachSignedHeaders, evidence } from "./support";
test.use({ actionTimeout: 15000 });

test("an official fixture Story encounter refreshes and publishes only after consent", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const signed = await fixtureHolder(page.request, 0);
  await attachSignedHeaders(
    page,
    ["**/api/story*", "**/api/competitor*"],
    signed.headers,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/story?as=chog", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Official Chog Story · token 276/)).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Pip", exact: true }).click();
  await page.getByRole("button", { name: "Start battle", exact: true }).click();
  let battle;
  for (let n = 0; n < 20; n++) {
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
    const special = page.getByRole("button", { name: /^Special/ });
    const posted = page.waitForResponse(
      (r) =>
        r.url().includes("/api/story") &&
        r.request().method() === "POST" &&
        (r.request().postData()?.includes('"operation":"move"') ?? false),
    );
    await (
      (await special.isEnabled())
        ? special
        : page.getByRole("button", { name: /^Basic attack/ })
    ).click();
    const result = await posted;
    expect(result.ok()).toBe(true);
    battle = (await result.json()).battle;
    if (battle.state.outcome) break;
    if (n === 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("button", { name: /^Basic attack/ }),
      ).toBeEnabled({ timeout: 20000 });
    }
  }
  expect(battle.state.outcome).toBe("victory");
  await expect(
    page.getByRole("button", { name: "Take the grove" }),
  ).toBeVisible({ timeout: 20000 });
  const entriesReply = await page.request.get("/api/competitor", {
    headers: signed.headers,
  });
  expect(entriesReply.ok()).toBe(true);
  const { entries } = await entriesReply.json();
  const entry = entries.find(
    (r: { kind: string }) => r.kind === "story-encounter",
  );
  expect(entry).toBeTruthy();
  const before = await (await page.request.get("/api/chog/276")).json();
  expect(before.records).toEqual([]);
  expect(
    (
      await page.request.post("/api/competitor", {
        headers: { ...signed.headers, Origin: baseURL! },
        data: {
          operation: "publish",
          id: entry.id,
          alias: "Story fixture keeper",
          consent: true,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/chog/276", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Encounter complete · Story encounter" }),
  ).toBeVisible();
  await expect(page.getByText(/Played by Story fixture keeper/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({
    path: `${evidence}/official-story-mobile-profile.png`,
    fullPage: true,
  });
  writeFileSync(
    `${evidence}/official-story-ui.json`,
    JSON.stringify(
      {
        source:
          "Disposable holder and read-only synthetic RPC fixture; actual UI moves, no real wallet login or transfer; reduced-motion portrait CSS viewport.",
        battleId: battle.id,
        result: battle.state.outcome,
        published: entry.id,
        axeViolations: axe.violations.length,
      },
      null,
      2,
    ),
  );
});

test("guest startup avoids identity/RPC UI calls and the public profile remains keyboard readable", async ({
  page,
}) => {
  const walletCalls: string[] = [];
  page.on("request", (request) => {
    if (/privy\.io|\/api\/(identity|competitor)/.test(request.url()))
      walletCalls.push(new URL(request.url()).pathname);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await page.goto("/match", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/You are playing as a guest with four starters/),
  ).toBeVisible();
  expect(walletCalls).toEqual([]);
  await page.goto("/chog/276", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the Chog record" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#chog-record")).toBeFocused();
});
