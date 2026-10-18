import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fixtureReset, fixtureWalletAccess } from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
const evidence = ".cache/holder-story-20261018";
for (const route of ["grove", "foundry"] as const) {
  test(`fixture wallet plays complete ${route} Story with saved choices`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    mkdirSync(evidence, { recursive: true });
    await fixtureReset(page.request);
    const session = await fixtureWalletAccess(
      page.request,
      route === "grove" ? 0 : 1,
      baseURL!,
    );
    await attachSignedHeaders(page, [`${baseURL}/api/**`], session.headers);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/story");
    await expect(
      page.getByRole("heading", { name: "The Fractured Sanctuary" }),
    ).toBeVisible();
    await page.getByText(/Holder access unlocked ·/).click();
    const equip = page.getByRole("checkbox", { name: /Equip holder frame/ });
    if (!(await equip.isChecked())) await equip.click();
    await expect(equip).toBeChecked();
    await expect(page.locator(".holder-profile-frame")).toBeVisible();
    await page.getByText(/Holder access unlocked ·/).click();
    await page.getByRole("button", { name: /Enter Sanctuary as Pip/ }).click();
    await expect(
      page.getByRole("heading", { name: "The broken listening shrine" }),
    ).toBeVisible();
    for (const width of [320, 375, 390, 430, 844, 1280]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 850 });
      await expect(
        page.getByRole("button", { name: "Inspect the ring markings" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${evidence}/${route}-shrine-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Skip dialogue", exact: true })
      .click();
    const inspect = page.getByRole("button", {
      name: "Inspect the ring markings",
    });
    await expect(inspect).toBeEnabled();
    await inspect.focus();
    await page.keyboard.press("Enter");
    await expect(inspect).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Ask your companion to investigate" })
      .click();
    await page
      .getByRole("button", {
        name: "Align the broken ring with the returning echo",
      })
      .click();
    await page.reload();
    async function battle() {
      await page
        .getByRole("button", {
          name: /^(Start battle|Retry battle|Resume battle)$/,
        })
        .click();
      await expect(
        page.getByRole("button", { name: /^Basic attack/ }),
      ).toBeVisible({ timeout: 20000 });
      for (let turn = 0; turn < 25; turn++) {
        const basic = page.getByRole("button", { name: /^Basic attack/ });
        const chapter = page.getByRole("heading", {
          name: "The Fractured Sanctuary",
        });
        await expect
          .poll(
            async () =>
              (await chapter.isVisible()) ||
              (await basic.isEnabled().catch(() => false)),
            { timeout: 20000 },
          )
          .toBe(true);
        if (await chapter.isVisible()) return;
        const special = page.getByRole("button", { name: /^Special/ });
        await ((await special.isEnabled()) ? special : basic).click();
      }
      throw Error("Story combat exceeded turn bound");
    }
    await battle();
    await page
      .getByRole("button", {
        name: route === "grove" ? /Help the stranded companion/ : /Pursue Bolt/,
      })
      .click();
    await page
      .getByRole("button", {
        name:
          route === "grove"
            ? "Compare the tracks beside the water"
            : "Inspect the two support ropes",
      })
      .click();
    await page
      .getByRole("button", {
        name:
          route === "grove"
            ? "Ask your companion to scout"
            : "Ask your companion to test the supports",
      })
      .click();
    await page
      .getByRole("button", {
        name:
          route === "grove"
            ? "Follow the shallow riverbank"
            : "Brace both ropes and use the supported planks",
      })
      .click();
    await battle();
    await page
      .getByRole("button", { name: "Skip dialogue", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What will you leave behind?" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name:
          route === "grove"
            ? /Restore the listening shrine/
            : /Keep the seed's light/,
      })
      .click();
    await page
      .getByRole("button", { name: "Ask your companion to read the seal" })
      .click();
    await page
      .getByRole("button", {
        name:
          route === "grove"
            ? "Guide the restored shrine's echo"
            : "Light the seal with the saved seed",
      })
      .click();
    await battle();
    await battle();
    await expect(
      page.getByRole("heading", { name: "The sanctuary remembers" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Visit the echo nook/ }).click();
    await page
      .getByRole("button", { name: "Listen for the missing note" })
      .click();
    await page
      .getByRole("button", { name: "Invite your companion into the duet" })
      .click();
    await page
      .getByRole("button", {
        name: "Return the quiet note after your companion",
      })
      .click();
    await expect(
      page.getByText("Keeper of the Echo", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "The sanctuary remembers" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${evidence}/${route}-ending.png`,
      fullPage: true,
    });
    for (const width of [320, 375, 390, 430, 844, 1280]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${evidence}/${route}-ending-${width}.png`,
        fullPage: true,
      });
    }
  });
}
