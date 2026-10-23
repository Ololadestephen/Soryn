import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const stage = process.env.CHOG_REBRAND_STAGE === "before" ? "before" : "after";
const evidence = `docs/evidence/game-rebrand/${stage}`;
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`${name} main route and state coverage`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [route, label] of [
      ["/", "landing"],
      ["/arena", "setup"],
      ["/character", "holder"],
      ["/journal", "journal-empty"],
      ["/museum", "museum"],
      [
        "/play?challenge=00000000-0000-4000-8000-000000000000",
        "challenge-unavailable",
      ],
      ["/play", "adventure"],
    ]) {
      await page.goto(route);
      if (route === "/arena")
        await expect(
          page.getByRole("button", { name: "Enter guest arena" }),
        ).toBeEnabled();
      if (route === "/character")
        await expect(page.locator(".identity-status")).toBeVisible();
      if (route.includes("challenge="))
        await expect(page.locator(".error[role=alert]")).toBeVisible();
      if (route === "/play")
        await expect(
          page.getByRole("button", { name: "Start guest adventure" }),
        ).toBeEnabled();
      await page.screenshot({ path: `${evidence}/${name}-${label}.png` });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (stage === "after")
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
    }
    await page.getByRole("button", { name: "Start guest adventure" }).click();
    await expect(page.locator(".race-opponent")).toBeVisible();
    await page.getByRole("button", { name: "Inspect the room" }).click();
    await expect(page.locator(".clue")).toBeVisible();
    await page.screenshot({ path: `${evidence}/${name}-adventure-active.png` });
    if (stage === "after")
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.getByRole("button", { name: "Rush the heroic door" }).click();
    await expect(
      page.getByRole("region", { name: "Run result" }),
    ).toBeVisible();
    await page.screenshot({ path: `${evidence}/${name}-adventure-result.png` });
    if (stage === "after")
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.goto("/journal");
    await expect(
      page.getByRole("button", { name: "Open chapter" }).first(),
    ).toBeVisible();
    await page.screenshot({ path: `${evidence}/${name}-journal.png` });
    await page.goto("/arena");
    await page.getByLabel("Music on").uncheck();
    await page.getByRole("button", { name: "Enter guest arena" }).click();
    const basic = page.getByRole("button", { name: /^Basic attack/ });
    await expect(basic).toBeEnabled();
    await page.screenshot({ path: `${evidence}/${name}-battle.png` });
    await page.getByRole("button", { name: "Battle settings" }).click();
    await page.screenshot({ path: `${evidence}/${name}-settings.png` });
    if (stage === "after")
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.getByRole("button", { name: "Return to battle" }).click();
    const rematch = page.getByRole("button", { name: "Rematch", exact: true });
    for (let n = 0; n < 20 && !(await rematch.isVisible()); n++) {
      const special = page.getByRole("button", { name: /^Special/ });
      await ((await special.isEnabled()) ? special : basic).click();
      await expect
        .poll(
          async () => (await basic.isEnabled()) || (await rematch.isVisible()),
          { timeout: 10000 },
        )
        .toBe(true);
    }
    await expect(rematch).toBeVisible();
    await page.screenshot({ path: `${evidence}/${name}-result.png` });
    if (stage === "after")
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.getByRole("button", { name: "View battle history" }).click();
    await page.screenshot({ path: `${evidence}/${name}-battle-history.png` });
    if (stage === "after")
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
  });
}
