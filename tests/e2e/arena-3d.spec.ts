import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";

test.use({
  video: { mode: "on", size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
  reducedMotion: "no-preference",
});
test.afterEach(async ({ page, context }, info) => {
  const video = page.video();
  await context.close();
  if (video && info.status === "passed") {
    mkdirSync("docs/evidence/arena-3d", { recursive: true });
    await video.saveAs(
      `docs/evidence/arena-3d/${info.title.split(" · ")[0]}.webm`,
    );
  }
});

test("aegis-ember · authenticated synthetic holder visual slice, special, counter and result history", async ({
  page,
}) => {
  test.setTimeout(100000);
  const official = await visualHolder(page);
  expect(
    (
      await official({
        operation: "start",
        mode: "official",
        id: randomUUID(),
        characterId: "aegis",
        opponent: "ember",
        difficulty: "medium",
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/arena");
  await expect(page.locator(".battle-stage")).toBeVisible();
  await expect(page.locator(".rendered-art")).toHaveCount(2);
  await expect(
    page.getByRole("img", { name: "Armadillo companion" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Phoenix companion" }),
  ).toBeVisible();
  await page.addStyleTag({
    content:
      '.battle-stage::after{content:"Signed test holder · synthetic RPC";position:absolute;left:12px;bottom:8px;color:white;font:11px Arial;z-index:20;background:#21192ce0;padding:3px 6px;border-radius:4px;pointer-events:none}',
  });
  await page.screenshot({ path: "docs/evidence/arena-3d/idle.png" });
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(
    page.locator(
      ".pet-phase-action .companion-ember, .pet-phase-impact .companion-ember",
    ),
  ).toBeVisible();
  await page.screenshot({ path: "docs/evidence/arena-3d/phoenix-special.png" });
  await expect(
    page.locator(
      ".pet-phase-action .companion-aegis, .pet-phase-impact .companion-aegis",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/arena-3d/armadillo-special.png",
  });
  await expect(page.locator(".move-notice")).toContainText("Shield Bash");
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await page.getByRole("button", { name: /^Defence/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 15000 },
  );
  for (let round = 3; round <= 5; round++) {
    await page.getByRole("button", { name: /^Defence/ }).click();
    if (round === 5) {
      await expect(page.locator(".cue-counter")).toBeVisible();
      await page.screenshot({ path: "docs/evidence/arena-3d/counter.png" });
    }
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 15000 });
  }
  const before = await (
    await page.request.get("/api/battle?mode=official", {
      headers: official.headers,
    })
  ).json();
  await page.getByRole("button", { name: "Battle settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Battle settings", exact: true }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get("/api/battle?mode=official", {
          headers: official.headers,
        })
      ).json()
    ).battle.state,
  ).toEqual(before.battle.state);
  await page.getByRole("button", { name: "Return to battle" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let n = 0; n < 20; n++) {
    if (
      await page
        .getByRole("button", { name: "Rematch", exact: true })
        .isVisible()
    )
      break;
    const special = page.getByRole("button", { name: /^Special/ });
    await (
      (await special.isEnabled())
        ? special
        : page.getByRole("button", { name: /^Basic attack/ })
    ).click();
    await expect
      .poll(
        async () =>
          (await page.getByRole("button", { name: /^Defence/ }).isEnabled()) ||
          (await page
            .getByRole("button", { name: "Rematch", exact: true })
            .isVisible()),
        { timeout: 15000 },
      )
      .toBe(true);
  }
  await expect(
    page.getByRole("region", { name: "Battle result" }),
  ).toBeVisible();
  const knockedOut = page.locator(".fighter-player .art-aegis");
  await expect(knockedOut).toHaveAttribute("data-pose", "defeated");
  const cycle = await knockedOut.getAttribute("viewBox");
  if (!cycle) throw new Error("Knockout presentation identity missing");
  await page.waitForTimeout(150);
  await expect(knockedOut).toHaveAttribute("viewBox", cycle);
  await page.screenshot({ path: "docs/evidence/arena-3d/result.png" });
  await page.reload();
  await expect(knockedOut).toHaveAttribute("data-pose", "defeated");
  await expect(knockedOut.locator("image")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".combat-log")).toHaveCount(0);
  await page.getByRole("button", { name: "View battle history" }).click();
  await expect(
    page.getByRole("dialog", { name: "Battle history", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".combat-log")).toContainText("Shield Bash");
  await page.screenshot({ path: "docs/evidence/arena-3d/history.png" });
  await page.getByRole("button", { name: "Close Battle history" }).click();
  await page.getByRole("button", { name: "Change setup" }).click();
  await expect(
    page.getByRole("radio", { name: "Aegis / Guardian" }),
  ).toBeDisabled();
});

test("arena-mobile · viewport, compact notices, focus and recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/arena");
  await page.getByLabel("Computer opponent").selectOption("ember");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  const bounds = await page.locator(".battle-stage").boundingBox();
  expect(bounds).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Sandwich adventure/ }),
  ).toHaveCount(0);
  for (const part of [
    ".status-player",
    ".status-opponent",
    ".fighter-player",
    ".fighter-opponent",
    ".combat-controls",
  ]) {
    await expect(page.locator(part)).toBeInViewport();
  }
  await page.screenshot({ path: "docs/evidence/arena-3d/mobile-idle.png" });
  const attack = page.getByRole("button", { name: /^Basic attack/ });
  await attack.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".move-notice")).toBeVisible();
  expect(
    await page
      .locator(".move-notice")
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(false);
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await expect(page.locator(".move-notice")).toHaveCount(0, { timeout: 3500 });
  await page.reload();
  await expect(page.locator(".arena-round")).toContainText("Round 2");
  await expect(page.locator(".move-notice")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const stage = document.querySelector(".battle-stage");
      return !!stage && stage.scrollWidth <= innerWidth;
    }),
  ).toBe(true);
  await page.screenshot({ path: "docs/evidence/arena-3d/mobile-round.png" });
});

test("rendered-roster · twelve signed holder fighters execute real specials with their own companion", async ({
  page,
}) => {
  test.setTimeout(240000);
  const official = await visualHolder(page, 1300);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const names = {
    pip: "Owl",
    bolt: "Cheetah",
    patch: "Mechanical beetle",
    moss: "Tortoise",
    aegis: "Armadillo",
    nyx: "Panther",
    echo: "Fox",
    prism: "Peacock",
    atlas: "Bear",
    flux: "Electric eel",
    ember: "Phoenix",
    mneme: "Raven",
  };
  for (const [id, companion] of Object.entries(names)) {
    expect(
      (
        await official({
          operation: "start",
          mode: "official",
          id: randomUUID(),
          characterId: id,
          opponent: "bolt",
          difficulty: "easy",
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/arena");
    await expect(
      page.locator(`.fighter-player > .fighter-facing .art-${id}`),
    ).toBeVisible();
    await expect(
      page.locator(`.fighter-player > .fighter-facing .art-${id}`),
    ).toHaveCSS("overflow", "visible");
    await expect(
      page
        .locator(".companion-side-player")
        .getByRole("img", { name: `${companion} companion`, exact: true }),
    ).toBeVisible();
    const href = await page
      .locator(`.fighter-player > .fighter-facing .art-${id} image`)
      .getAttribute("href");
    if (!href) throw new Error(`${id}: rendered asset missing`);
    expect((await page.request.get(href)).ok()).toBe(true);
    await page.getByRole("button", { name: /^Special/ }).click();
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 15000 });
    await expect(
      page.locator(`.companion-side-player .companion-${id}[data-pose="idle"]`),
    ).toBeVisible();
    await expect(
      page.locator(".combat-number,.combat-impact,.move-effect"),
    ).toHaveCount(0);
    // Finish through real authorized steps before switching kits; never bypass the active-battle gate.
    await official.finish();
  }
});

test("arena-viewports · desktop, narrow portrait and landscape keep controls, HUD and full bodies in bounds", async ({
  page,
}) => {
  await page.goto("/arena");
  await page.getByLabel("Computer opponent").selectOption("aegis");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  const before = await (await page.request.get("/api/battle")).json();
  for (const size of [
    { width: 1280, height: 800 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => {
        const r = await page.locator(".battle-stage").boundingBox();
        return r && [r.width, r.height];
      })
      .toEqual([size.width, size.height]);
    for (const part of [
      ".status-player",
      ".status-opponent",
      ".fighter-player",
      ".fighter-opponent",
      ".combat-controls",
    ]) {
      await expect(page.locator(part)).toBeInViewport();
      const box = await page.locator(part).boundingBox();
      if (!box) throw new Error(`${part}: missing layout bounds`);
      if (part.includes("fighter")) {
        // Transparent margin may extend horizontally; rendered viewports remain inside the available vertical field.
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
    }
    const hud = await page.locator(".combat-scoreboard").boundingBox(),
      field = await page.locator(".combat-field").boundingBox(),
      controls = await page.locator(".combat-controls").boundingBox();
    if (!hud || !field || !controls) throw new Error("Arena layout missing");
    expect(field.y).toBeGreaterThan(hud.y + hud.height);
    expect(field.y + field.height).toBeLessThan(controls.y);
  }
  expect(
    (await (await page.request.get("/api/battle")).json()).battle.state,
  ).toEqual(before.battle.state);
});
