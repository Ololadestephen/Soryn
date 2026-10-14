import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureHolder } from "../browser-support/holder";

test("Pip battle visibly resolves attack, defence, special, result and persisted rematch", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Enter the arena", exact: true })
    .click();
  await expect(page).toHaveURL(/\/arena$/);
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.locator(".arena-fighter")).toHaveCount(2);
  await expect(page.locator(".fighter-roster")).toHaveCount(0);
  const special = page.getByRole("button", { name: /^Special · Survey Shot/ });
  await special.click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeDisabled();
  await expect(page.locator(".move-notice-region")).toContainText(/Pip|Bolt/);
  await expect(page.locator(".combat-melee")).toBeVisible();
  await expect(page.locator(".status-player progress")).toBeInViewport();
  await expect(page.locator(".status-opponent progress")).toBeInViewport();
  await page.screenshot({
    path: "test-results/combat-action.png",
    fullPage: false,
  });
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 10000,
  });
  await expect(page.locator(".combat-log")).toHaveCount(0);
  await page.getByRole("button", { name: /^Defence/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 10000 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  const before = await (await page.request.get("/api/battle")).json();
  expect(before.battle.rounds).toHaveLength(3);
  expect(before.battle.pending).toBeUndefined();
  await page.reload();
  await expect(page.locator(".arena-round")).toContainText("Round 4");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/combat-pip.png",
    fullPage: true,
  });
  for (let n = 0; n < 20; n++) {
    if (
      await page
        .getByRole("button", { name: "Rematch", exact: true })
        .isVisible()
    )
      break;
    const move = (await special.isEnabled())
      ? special
      : page.getByRole("button", { name: /^Basic attack/ });
    await move.click();
    await expect(page.getByRole("button", { name: /^Defence/ }))
      .toBeEnabled()
      .catch(async () =>
        expect(
          page.getByRole("button", { name: "Rematch", exact: true }),
        ).toBeVisible(),
      );
  }
  await expect(page.locator(".combat-result")).toBeVisible();
  const finished = await (await page.request.get("/api/battle")).json();
  await page.getByRole("button", { name: "View battle history" }).click();
  await expect(page.locator(".combat-log")).toContainText("Survey Shot");
  await page.getByRole("button", { name: "Close Battle history" }).click();
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(page.locator(".arena-round")).toContainText("Round 1");
  expect(
    (await (await page.request.get("/api/battle")).json()).battle.id,
  ).not.toBe(finished.battle.id);
});

test("lost combat round reply retries the same intent without a second hit", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  let dropped = false;
  await page.route("**/api/battle", async (route) => {
    const input = route.request().postDataJSON();
    if (input?.operation === "step" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(
    page.getByRole("button", { name: "Retry same battle request" }),
  ).toBeVisible();
  const first = await (await page.request.get("/api/battle")).json();
  expect(first.battle.rounds).toHaveLength(1);
  await page.getByRole("button", { name: "Retry same battle request" }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  const retried = await (await page.request.get("/api/battle")).json();
  expect(retried.battle.state).toEqual(first.battle.state);
  expect(retried.battle.rounds).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".arena-round")).toContainText("Round 2");
});

test("leaving during a visible action restores the resolved round without restarting it", async ({
  page,
}) => {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.locator(".combat-melee")).toBeVisible();
  const accepted = await (await page.request.get("/api/battle")).json();
  await page.goto("/play");
  await page.goto("/arena");
  await expect(page.locator(".arena-round")).toContainText("Round 2");
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  const restored = await (await page.request.get("/api/battle")).json();
  expect(restored.battle.state).toEqual(accepted.battle.state);
  expect(restored.battle.rounds).toHaveLength(1);
});

test("narrow keyboard combat and original full-body selection remain readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/arena");
  await expect(page.locator(".fighter-option")).toHaveCount(12);
  await expect(
    page.getByRole("radio", { name: "Aegis / Guardian" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Bolt / Courier" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Enter guest arena" }).focus();
  await page.keyboard.press("Enter");
  const basic = page.getByRole("button", { name: /^Basic attack/ });
  await expect(basic).toBeEnabled();
  await basic.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".arena-round")).toContainText("Round 2");
  await expect(basic).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/combat-mobile.png",
    fullPage: true,
  });
});

test("labelled synthetic holder battle rejects forged stats, RPC failure and revoked generation", async ({
  page,
}) => {
  const guest = page.waitForResponse(
    (response) =>
      response.url().includes("/api/battle?mode=guest") && response.ok(),
  );
  await page.goto("/arena");
  await guest;
  const actor = page.request;
  const forged = await actor.post("/api/battle", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      operation: "start",
      mode: "guest",
      id: randomUUID(),
      characterId: "aegis",
      opponent: "pip",
    },
  });
  expect(forged.status()).toBe(403);
  const official = await fixtureHolder(actor, 0, "/api/battle");
  const id = randomUUID();
  expect(
    (
      await official({
        operation: "start",
        mode: "official",
        id,
        characterId: "aegis",
        opponent: "pip",
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await official({
        operation: "step",
        mode: "official",
        id,
        round: 1,
        move: "guard",
        damage: 999,
      })
    ).status(),
  ).toBe(400);
  const played = await official({
    operation: "step",
    mode: "official",
    id,
    round: 1,
    move: "special",
  });
  expect(played.ok(), await played.text()).toBe(true);
  expect((await played.json()).battle.snapshot.player.health).toBe(100);
  await actor.post("https://127.0.0.1:3200/control", {
    data: { operation: "outage", enabled: true },
  });
  expect(
    (
      await official({
        operation: "step",
        mode: "official",
        id,
        round: 2,
        move: "basic",
      })
    ).status(),
  ).toBe(503);
  await actor.post("https://127.0.0.1:3200/control", {
    data: { operation: "reset" },
  });
  await actor.post("https://127.0.0.1:3200/control", {
    data: { operation: "awayBack" },
  });
  expect(
    (
      await official({
        operation: "step",
        mode: "official",
        id,
        round: 2,
        move: "basic",
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.locator(".arena-fighter")).toHaveCount(2);
});
