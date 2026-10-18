import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { storyBattle, saveRecording, evidence } from "./support";
for (const route of ["grove", "foundry"] as const)
  test(`complete recorded ${route} chapter through the ending`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(480000);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: ".cache/readiness-recordings",
        size: { width: 1280, height: 800 },
      },
    });
    const page = await context.newPage();
    try {
      await page.goto("/start");
      await expect(
        page.getByText("Begin Story", { exact: true }),
      ).toBeVisible();
      await page.locator('.play-mode[href="/story"]').click();
      await page.getByRole("button", { name: "Pip", exact: true }).click();
      const battles = [];
      await page
        .getByRole("button", { name: "Start battle", exact: true })
        .click();
      battles.push(await storyBattle(page, false, true));
      await expect(
        page.getByRole("button", { name: "Take the grove" }),
      ).toBeVisible({ timeout: 20000 });
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Take the grove" }),
      ).toBeVisible();
      await page.goto("/start");
      await expect(
        page.getByText("Continue Story", { exact: true }),
      ).toBeVisible();
      await page.locator('.play-mode[href="/story"]').click();
      await page.getByRole("button", { name: `Take the ${route}` }).click();
      for (const step of ["path", "guardian", "boss"]) {
        const state = await (await page.request.get("/api/story")).json();
        expect(state.step).toBe(step);
        await page
          .getByRole("button", { name: "Start battle", exact: true })
          .click();
        const completed = await storyBattle(page);
        expect(completed.state.outcome).toBe("victory");
        battles.push(completed);
        await expect(page.locator(".battle-stage")).toHaveCount(0, {
          timeout: 20000,
        });
      }
      await expect(page.getByText(/Chapter complete\./)).toBeVisible();
      const final = await (await page.request.get("/api/story")).json();
      expect(final).toMatchObject({ step: "ending", route, completed: true });
      expect(final.completionId).toBeTruthy();
      for (let i = 0; i < 3; i++) {
        const r = await page.request.post("/api/story", {
          data: { operation: "resolve", battleId: battles.at(-1)!.id },
          headers: { Origin: baseURL! },
        });
        expect(r.ok()).toBe(true);
        expect((await r.json()).completionId).toBe(final.completionId);
      }
      await page.reload();
      await expect(page.getByText(/Chapter complete\./)).toBeVisible();
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/story-${route}-ending.png` });
      writeFileSync(
        `${evidence}/story-${route}.json`,
        JSON.stringify(
          {
            source:
              "Pip; legal Special when enabled, otherwise Basic; normal production browser UI; no database edits",
            final,
            battles,
          },
          null,
          2,
        ),
      );
      await page.goto("/start");
      await expect(
        page.getByText("View your ending", { exact: true }),
      ).toBeVisible();
    } finally {
      await saveRecording(page, context, `story-${route}`);
    }
  });
test("a recorded loss persists through refresh and retries the same encounter with a new battle", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  const context = await browser.newContext({
    baseURL,
    recordVideo: {
      dir: ".cache/readiness-recordings",
      size: { width: 1280, height: 800 },
    },
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/story");
    await page.getByRole("button", { name: "Bolt", exact: true }).click();
    await page
      .getByRole("button", { name: "Start battle", exact: true })
      .click();
    const lost = await storyBattle(page, true);
    expect(lost.state.outcome).toBe("defeat");
    await expect(
      page.getByRole("button", { name: "Retry battle", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Retry battle", exact: true }),
    ).toBeVisible();
    expect(await (await page.request.get("/api/story")).json()).toMatchObject({
      step: "scout",
      lost: true,
      completed: false,
      completionId: null,
    });
    await page
      .getByRole("button", { name: "Retry battle", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
    const retry = await (await page.request.get("/api/story")).json();
    expect(retry.battleId).not.toBe(lost.id);
    expect(retry.step).toBe("scout");
    await page.screenshot({ path: `${evidence}/story-retry.png` });
    writeFileSync(
      `${evidence}/story-loss-retry.json`,
      JSON.stringify({ lost, retry }, null, 2),
    );
  } finally {
    await saveRecording(page, context, "story-loss-retry");
  }
});
test("a mid-route loss resumes the same grove encounter after refresh", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(480000);
  const context = await browser.newContext({
    baseURL,
    recordVideo: {
      dir: ".cache/readiness-recordings",
      size: { width: 1280, height: 800 },
    },
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/story");
    await page.getByRole("button", { name: "Pip", exact: true }).click();
    await page
      .getByRole("button", { name: "Start battle", exact: true })
      .click();
    const scout = await storyBattle(page);
    expect(scout.state.outcome).toBe("victory");
    await expect(
      page.getByRole("button", { name: "Take the grove" }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Take the grove" }).click();
    expect(await (await page.request.get("/api/story")).json()).toMatchObject({
      step: "path",
    });
    await page
      .getByRole("button", { name: "Start battle", exact: true })
      .click();
    const path = await storyBattle(page);
    expect(path.state.outcome).toBe("victory");
    await expect(page.locator(".battle-stage")).toHaveCount(0, {
      timeout: 20000,
    });
    expect(await (await page.request.get("/api/story")).json()).toMatchObject({
      step: "guardian",
    });
    await page
      .getByRole("button", { name: "Start battle", exact: true })
      .click();
    const lost = await storyBattle(page, true);
    expect(lost.state.outcome).toBe("defeat");
    await expect(
      page.getByRole("button", { name: "Retry battle", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const afterLoss = await (await page.request.get("/api/story")).json();
    expect(afterLoss).toMatchObject({
      step: "guardian",
      lost: true,
      completed: false,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Retry battle", exact: true }),
    ).toBeVisible();
    const afterReload = await (await page.request.get("/api/story")).json();
    expect(afterReload).toMatchObject({
      step: "guardian",
      lost: true,
      completed: false,
    });
    await page
      .getByRole("button", { name: "Retry battle", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
    const retried = await (await page.request.get("/api/story")).json();
    expect(retried.step).toBe("guardian");
    expect(retried.battleId).toBeTruthy();
    expect(retried.battleId).not.toBe(lost.id);
    const won = await storyBattle(page);
    expect(won.state.outcome).toBe("victory");
    await expect(page.locator(".battle-stage")).toHaveCount(0, {
      timeout: 20000,
    });
    expect(await (await page.request.get("/api/story")).json()).toMatchObject({
      step: "boss",
    });
    await page.screenshot({ path: `${evidence}/story-guardian-retry.png` });
    writeFileSync(
      `${evidence}/story-guardian-loss-retry.json`,
      JSON.stringify({ scout, path, lost, afterReload, retried, won }, null, 2),
    );
  } finally {
    await saveRecording(page, context, "story-midroute-loss-retry");
  }
});
