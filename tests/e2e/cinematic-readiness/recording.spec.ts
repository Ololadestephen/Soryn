import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const evidence = "docs/evidence/cinematic-readiness/after";
test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: "on", size: { width: 1280, height: 800 } },
});
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));

async function playBattle(page: Page) {
  const basic = page.getByRole("button", { name: /^Basic attack/ });
  const rematch = page.getByRole("button", { name: "Rematch", exact: true });
  await expect(basic).toBeEnabled();
  for (const label of [/^Defence/, /^Basic attack/, /^Special/]) {
    await page.getByRole("button", { name: label }).click();
    await expect(basic).toBeEnabled({ timeout: 15000 });
  }
  for (let n = 0; n < 20 && !(await rematch.isVisible()); n++) {
    const special = page.getByRole("button", { name: /^Special/ });
    await ((await special.isEnabled()) ? special : basic).click();
    await expect
      .poll(
        async () => (await basic.isEnabled()) || (await rematch.isVisible()),
        { timeout: 15000 },
      )
      .toBe(true);
  }
  await expect(rematch).toBeVisible();
  await expect(page.locator('.rendered-art[data-pose="defeated"]')).toHaveCount(
    1,
  );
  const { battle } = await (await page.request.get("/api/battle")).json();
  expect(
    battle.rounds.slice(0, 3).map((r: { player: string }) => r.player),
  ).toEqual(["guard", "basic", "special"]);
  return battle;
}

test("record landing to setup, battle, result and rematch", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Déjà Vu",
  );
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );
  await page.waitForTimeout(11000);
  await page.getByRole("link", { name: "Play now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
  await page.getByLabel("Sound effects on").uncheck();
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  const battle = await playBattle(page);
  writeFileSync(
    `${evidence}/complete-battle.json`,
    JSON.stringify(
      {
        source: "Disposable guest; actual production API and renderer",
        battle,
      },
      null,
      2,
    ),
  );
  await page.waitForTimeout(1200);
  const rematchStarted = Date.now();
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  writeFileSync(
    `${evidence}/warm-rematch.json`,
    JSON.stringify(
      {
        readyMs: Date.now() - rematchStarted,
        cache: "same document decoded cache, normal network",
      },
      null,
      2,
    ),
  );
  await expect(page.locator(".arena-round")).toContainText("Round 1");
  await page.waitForTimeout(600);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${evidence}/journey.webm`);
});
