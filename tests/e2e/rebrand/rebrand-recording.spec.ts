import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const evidence = "docs/evidence/game-rebrand/after";
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
  const { battle } = await (await page.request.get("/api/battle")).json();
  expect(
    battle.rounds.slice(0, 3).map((r: { player: string }) => r.player),
  ).toEqual(["guard", "basic", "special"]);
  return battle;
}

test("record actual guest gameplay source", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  if (!baseURL) throw new Error("The production browser baseURL is required.");
  await page.addInitScript(() =>
    localStorage.setItem(
      "chog-combat-audio/1",
      JSON.stringify({ enabled: false, volume: 0.5 }),
    ),
  );
  await page.request.get("/api/battle");
  const start = await page.request.post("/api/battle", {
    headers: { Origin: baseURL },
    data: {
      operation: "start",
      mode: "guest",
      id: randomUUID(),
      characterId: "pip",
      opponent: "bolt",
      difficulty: "easy",
      arena: "sanctuary",
    },
  });
  expect(start.ok()).toBe(true);
  await page.goto("/arena");
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await page.screenshot({ path: `${evidence}/gameplay-poster.png` });
  const battle = await playBattle(page);
  writeFileSync(
    `${evidence}/gameplay-battle.json`,
    JSON.stringify(
      {
        source:
          "Disposable guest in isolated test database; actual engine/API/UI",
        battle,
      },
      null,
      2,
    ),
  );
  await page.waitForTimeout(1000);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${evidence}/gameplay-source.webm`);
});

test("record landing to setup, battle, result and rematch", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Déjà Vu",
  );
  await page.waitForTimeout(1000);
  await page.getByRole("link", { name: "Play now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
  await page.getByLabel("Sound effects on").uncheck();
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await playBattle(page);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await expect(page.locator(".arena-round")).toContainText("Round 1");
  await page.waitForTimeout(600);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${evidence}/journey.webm`);
});
