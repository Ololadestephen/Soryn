import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
const evidence = "docs/evidence/cinematic-readiness/after";
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
for (const mobile of [false, true])
  test(`hero ${mobile ? "portrait" : "desktop"}: poster, three loops, no scene controls, offscreen, hidden and navigation`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    const media: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/hero/")) media.push(r.url());
    });
    await page.goto("/");
    const film = page.locator(".hero-film");
    await expect(
      page
        .locator(".gateway-hero .gateway-actions")
        .getByRole("link", { name: "Play now", exact: true }),
    ).toBeVisible();
    await expect(film).toHaveAttribute("data-ready", "true", {
      timeout: 20000,
    });
    expect(media.every((p) => p.includes(mobile ? "mobile" : "desktop"))).toBe(
      true,
    );
    for (let loop = 0; loop < 3; loop++) {
      await page.waitForTimeout(9700);
      await page.screenshot({
        path: `${evidence}/hero-${mobile ? "portrait" : "desktop"}-loop-${loop + 1}.png`,
      });
    }
    await expect(page.locator(".hero-film-control")).toHaveCount(0);
    await page.locator("#fighters").scrollIntoViewIfNeeded();
    await expect
      .poll(() => film.evaluate((v) => (v as HTMLVideoElement).paused))
      .toBe(true);
    await page.locator(".gateway-hero").scrollIntoViewIfNeeded();
    await expect
      .poll(() => film.evaluate((v) => (v as HTMLVideoElement).paused))
      .toBe(false);
    const other = await context.newPage();
    await other.goto("/museum");
    await page.bringToFront();
    await other.close();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page
      .locator(".gateway-hero .gateway-actions")
      .getByRole("link", { name: "Play now", exact: true })
      .click();
    await page.locator('.play-mode[href="/arena"]').click();
    await expect(
      page.getByRole("button", { name: "Enter guest arena" }),
    ).toBeEnabled();
    await expect(film).toHaveCount(0);
    writeFileSync(
      `${evidence}/hero-${mobile ? "portrait" : "desktop"}-requests.json`,
      JSON.stringify(media, null, 2),
    );
  });
test("reduced motion and data saver remain static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForTimeout(8500);
  await expect(page.locator(".hero-film")).not.toHaveAttribute("src", /./);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.waitForTimeout(8500);
  await expect(page.locator(".hero-film")).not.toHaveAttribute("src", /./);
});
test("autoplay rejection retains the poster without scene controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("Autoplay rejected", "NotAllowedError"));
  });
  await page.goto("/");
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-failed",
    "true",
    { timeout: 15000 },
  );
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await expect(page.locator(".gateway-world img")).toBeVisible();
});
test("failed hero request retains poster and Play remains available", async ({
  page,
}) => {
  await page.route("**/hero/*.mp4", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-failed",
    "true",
    { timeout: 15000 },
  );
  await expect(page.locator(".hero-film-control")).toHaveCount(0);
  await page.unroute("**/hero/*.mp4");
  await page.reload();
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .locator(".gateway-hero .gateway-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await page.locator('.play-mode[href="/arena"]').click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
});

test("slow hero request keeps the poster visible and does not hold Play", async ({
  page,
}) => {
  await page.route("**/hero/*.mp4", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      await route.continue();
    } catch {
      /* Navigation already released this media request. */
    }
  });
  await page.goto("/");
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "src",
    /hero\/.+mp4/,
    { timeout: 15000 },
  );
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-ready",
    "false",
  );
  await expect(page.locator(".gateway-world img")).toBeVisible();
  await page
    .locator(".gateway-hero .gateway-actions")
    .getByRole("link", { name: "Play now", exact: true })
    .click();
  await page.locator('.play-mode[href="/arena"]').click();
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeEnabled();
});
