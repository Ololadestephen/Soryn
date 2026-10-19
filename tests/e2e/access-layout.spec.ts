import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fixtureReset, fixtureWalletAccess } from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";
const evidence = ".cache/shared-access-20261019";
for (const width of [1440, 390, 320]) {
  test(`access page arrangement at ${width}px, with authenticated private History separate from admission`, async ({
    page,
    baseURL,
  }) => {
    mkdirSync(evidence, { recursive: true });
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    for (const path of ["match", "challenge", "story"]) {
      await page.goto(`/${path}`);
      const panel = page.getByRole("region", { name: "Soryn access" });
      await expect(panel.locator(".access-entry-heading h1")).toBeVisible();
      await expect(panel.locator(".access-primary button")).toHaveCount(1);
      await expect(
        panel.getByText("Account & saved progress", { exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("link", { name: "Existing browser history" }),
      ).not.toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${evidence}/${path}-${width}.png`,
        fullPage: true,
      });
    }
    await fixtureReset(page.request);
    const session = await fixtureWalletAccess(page.request, 1, baseURL!);
    await attachSignedHeaders(page, [`${baseURL}/api/**`], session.headers);
    await page.goto("/history?as=holder");
    await expect(
      page.getByRole("heading", { name: "Battle history", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Signed in · Private wallet records", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".access-entry")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/history-${width}.png`,
      fullPage: true,
    });
  });
}
