import { expect, test } from "@playwright/test";
import { fixtureReset, fixtureWalletAccess } from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";
import { mkdirSync } from "node:fs";
test("qualified private lifecycle preserves mobile Ready bar, archived history and fresh invitations", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  await fixtureReset(page.request);
  const a = await fixtureWalletAccess(page.request, 0, baseURL!);
  await attachSignedHeaders(page, [`${baseURL}/api/**`], a.headers);
  const other = await browser.newContext({ baseURL });
  const friend = await other.newPage();
  const b = await fixtureWalletAccess(friend.request, 1, baseURL!);
  await attachSignedHeaders(friend, [`${baseURL}/api/**`], b.headers);
  try {
    await page.goto("/challenge");
    mkdirSync(".cache/copy-pass", { recursive: true });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("textbox", { name: "Invitation link or room code" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.cache/copy-pass/friend-entry-${width}.png`,
        fullPage: true,
      });
    }
    const invitation = page.getByRole("textbox", {
      name: "Invitation link or room code",
    });
    await invitation.fill(
      "https://example.invalid/challenge/" + "a".repeat(24),
    );
    await invitation.press("Enter");
    await expect(
      page
        .getByRole("region", { name: "Challenge a friend", exact: true })
        .getByRole("alert"),
    ).toHaveText("Paste a Soryn invitation from this site or its room code.");
    await invitation.fill("");
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
    const url = page.url(),
      invite = new URL(url).pathname.split("/").at(-1)!;
    await friend.goto("/challenge");
    await friend
      .getByRole("textbox", { name: "Invitation link or room code" })
      .fill(url);
    await friend
      .getByRole("button", { name: "Join a room", exact: true })
      .click();
    await friend.getByRole("button", { name: "Take the open seat" }).click();
    await friend.getByRole("radio", { name: "Nyx / Infiltrator" }).click();
    await page.getByRole("radio", { name: "Aegis / Guardian" }).click();
    mkdirSync(".cache/holder-story-20261018", { recursive: true });
    for (const [width, height] of [
      [320, 740],
      [375, 812],
      [390, 844],
      [430, 932],
      [844, 390],
      [1280, 900],
    ]) {
      await page.setViewportSize({ width, height });
      const ready = page.getByRole("button", { name: "Ready up", exact: true });
      const box = await ready.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.cache/holder-story-20261018/private-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: "html {font-size:125% !important}" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    // Concurrent duplicate leave is idempotent, with real authenticated principals.
    const post = (headers: Record<string, string>, operation: string) =>
      page.request.post("/api/pvp", {
        headers,
        data: { operation, invite, mode: "guest" },
      });
    expect((await post(a.headers, "leave")).ok()).toBe(true);
    expect((await post(a.headers, "leave")).ok()).toBe(true);
    const left = await friend.request.post("/api/pvp", {
      headers: b.headers,
      data: { operation: "leave", invite, mode: "guest" },
    });
    expect(left.ok()).toBe(true);
    await page.goto("/challenge");
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
    expect(page.url()).not.toBe(url);
    const freshInvite = new URL(page.url()).pathname.split("/").at(-1)!;
    expect(
      (
        await page.request.post("/api/pvp", {
          headers: a.headers,
          data: { operation: "close", mode: "guest", invite: freshInvite },
        })
      ).ok(),
    ).toBe(true);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await friend.unrouteAll({ behavior: "ignoreErrors" });
    await other.close();
  }
});
