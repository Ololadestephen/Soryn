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
    mkdirSync("docs/evidence/art-restoration", { recursive: true });
    await video.saveAs(
      `docs/evidence/art-restoration/${info.title.split(" · ")[0]}.webm`,
    );
  }
});

test("aegis-victory · real basic, guard, special and full outcome, refresh and reduced rematch", async ({
  page,
}) => {
  test.setTimeout(150000);
  const official = await visualHolder(page);
  expect(
    (
      await official({
        operation: "start",
        mode: "official",
        id: randomUUID(),
        characterId: "aegis",
        opponent: "ember",
        difficulty: "easy",
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/arena");
  await page.addStyleTag({
    content:
      '.battle-stage::after{content:"Signed test holder · synthetic RPC";position:absolute;left:12px;bottom:8px;color:white;font:11px Arial;z-index:20;background:#21192ce0;padding:3px 6px;border-radius:4px;pointer-events:none}',
  });
  const hero = page.locator(".fighter-player > .fighter-facing .art-aegis");
  await expect(hero).toBeVisible();
  await expect(hero.locator("clipPath rect")).toHaveCount(1);
  expect(await hero.locator("g").first().getAttribute("clip-path")).toMatch(
    /^url\(#/,
  );
  await expect(hero).toHaveAttribute("data-art-source", "rendered");
  await page.screenshot({ path: "docs/evidence/art-restoration/idle.png" });
  for (const move of [
    "Special",
    "Basic attack",
    "Basic attack",
    "Defence",
    "Special",
    "Defence",
    "Defence",
    "Defence",
    "Basic attack",
    "Defence",
    "Defence",
  ]) {
    if (
      await page
        .getByRole("button", { name: "Rematch", exact: true })
        .isVisible()
    )
      break;
    await page.getByRole("button", { name: new RegExp(`^${move}`) }).click();
    await expect
      .poll(
        async () =>
          (await page
            .getByRole("button", { name: /^Basic attack/ })
            .isEnabled()) ||
          (await page
            .getByRole("button", { name: "Rematch", exact: true })
            .isVisible()),
        { timeout: 20000 },
      )
      .toBe(true);
  }
  await expect(
    page.getByRole("region", { name: "Battle result" }),
  ).toContainText("Victory");
  await expect(page.locator(".fighter-opponent .art-ember")).toHaveAttribute(
    "data-pose",
    "defeated",
  );
  await page.screenshot({
    path: "docs/evidence/art-restoration/victory.png",
  });
  await page.reload();
  await expect(page.locator(".fighter-opponent .art-ember")).toHaveAttribute(
    "data-pose",
    "defeated",
  );
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(hero).toHaveAttribute("data-pose", "idle");
  await expect(hero.locator("image")).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 20000 },
  );
  await official.finish();
});

test("aegis-fallback · unavailable crisp assets preserve real guest combat", async ({
  page,
}) => {
  await page.route("**/combat/{crisp,delivery}/*", (route) => route.abort());
  await page.goto("/arena");
  await page.getByLabel("Computer opponent").selectOption("aegis");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(
    page.locator(".fighter-opponent .art-aegis image"),
  ).toHaveAttribute("href", "/combat/rendered/aegis.webp");
  await expect(page.locator(".fighter-opponent .art-aegis")).toHaveAttribute(
    "data-art-source",
    "legacy-fallback",
  );
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 20000 },
  );
  await expect(page.locator(".arena-round")).toContainText("Round 2");
  await page.reload();
  await expect(page.locator(".move-notice")).toHaveCount(0);
  await page.route("**/combat/rendered/aegis.webp", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".fighter-opponent .art-aegis")).toHaveAttribute(
    "data-art-source",
    "unavailable",
  );
  await expect(page.locator(".fighter-opponent .art-aegis")).toContainText(
    "Artwork unavailable",
  );
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 20000 },
  );
});
