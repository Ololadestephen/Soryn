import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fixtureReset, fixtureWalletAccess } from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";

test("labelled holders use the queue, offer and fighter selection with compact keyboard-accessible wallet controls", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  await fixtureReset(page.request);
  const a = await fixtureWalletAccess(page.request, 0, baseURL!);
  await attachSignedHeaders(page, [`${baseURL}/api/**`], a.headers);
  const other = await browser.newContext({ baseURL });
  try {
    const b = await fixtureWalletAccess(other.request, 1, baseURL!);
    await page.goto("/match");
    await expect(
      page.getByRole("heading", { name: "Ready when you are" }),
    ).toBeVisible();
    await expect(page.locator(".match-roster li")).toHaveCount(6);
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).not.toBeVisible();
    const menu = page.locator(".wallet-menu > summary");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("link", { name: "Private battle history", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).not.toBeVisible();
    mkdirSync(".cache/match-polish-20261019", { recursive: true });
    async function capture(state: string) {
      for (const [width, height] of [
        [1440, 1000],
        [390, 844],
        [320, 740],
      ]) {
        await page.setViewportSize({ width, height });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const rect = await menu.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.height).toBeLessThan(90);
        await page.screenshot({
          path: `.cache/match-polish-20261019/${state}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await capture("idle");
    await page
      .getByRole("button", { name: "Find a match", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Finding your opponent" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Leave queue", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ready when you are" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Find a match", exact: true })
      .click();
    const join = await other.request.post("/api/match", {
      headers: b.headers,
      data: { operation: "join", mode: "guest" },
    });
    expect(join.ok(), await join.text()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Opponent found", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Decline", exact: true }),
    ).toHaveClass("secondary");
    await capture("offered");
    await page
      .getByRole("button", { name: "Accept opponent", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Offer accepted" }),
    ).toBeVisible();
    const accepted = await other.request.post("/api/match", {
      headers: b.headers,
      data: { operation: "accept", mode: "guest" },
    });
    expect(accepted.ok(), await accepted.text()).toBe(true);
    await expect(page).toHaveURL(/\/match\/[A-Za-z0-9_-]+/);
    await expect(
      page.getByRole("heading", { name: "Choose your fighter", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ready up", exact: true }),
    ).toBeVisible();
    await capture("selection");
    const invite = new URL(page.url()).pathname.split("/").at(-1)!;
    const closed = await page.request.post("/api/pvp", {
      headers: a.headers,
      data: { operation: "close", mode: "guest", invite },
    });
    expect(closed.ok(), await closed.text()).toBe(true);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await other.close();
  }
});
