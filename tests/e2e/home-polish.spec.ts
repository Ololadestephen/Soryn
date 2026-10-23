import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [320, 700],
  [375, 812],
  [390, 844],
  [430, 932],
  [844, 390],
  [667, 375],
  [1440, 900],
  [1920, 1080],
]) {
  test(`clean hero, matching media and usable Play at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const movies: string[] = [];
    page.on("request", (r) => {
      if (/\/hero\/.*\.mp4/.test(r.url())) movies.push(r.url());
    });
    await page.goto("/");
    const hero = page.locator(".gateway-hero");
    await expect(
      hero.getByRole("link", { name: "Play now", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(hero.locator("h1")).toHaveCount(1);
    await expect(hero.locator(".hero-film")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const fit = await hero.evaluate((el) => {
      const video = el.querySelector("video")!,
        image = el.querySelector("img")!;
      return {
        video: [video.videoWidth, video.videoHeight],
        poster: [image.naturalWidth, image.naturalHeight],
        videoPosition: getComputedStyle(video).objectPosition,
        posterPosition: getComputedStyle(image).objectPosition,
      };
    });
    expect(fit.video).toEqual(fit.poster);
    expect(fit.videoPosition).toBe(fit.posterPosition);
    expect(movies.length).toBeGreaterThan(0);
    expect(new Set(movies).size).toBe(1);
    expect(movies[0]).toContain(
      width <= 700 && height >= width ? "mobile" : "desktop",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.locator(".landing-secondary,.landing-closing"),
    ).toHaveCount(0);
  });
}
test("video need not wait for window load or poster completion", async ({
  page,
}) => {
  let release = () => {};
  const poster = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/hero/*.webp", async (route) => {
    await poster;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".hero-film")).toHaveAttribute(
      "data-ready",
      "true",
    );
    expect(await page.evaluate(() => document.readyState)).not.toBe("complete");
    await expect(
      page.locator('.gateway-actions a[href="/start"]'),
    ).toBeEnabled();
  } finally {
    release();
  }
});
for (const preference of ["reduced", "save-data", "autoplay-rejected"]) {
  test(`polished static fallback: ${preference}`, async ({ page }) => {
    const media: string[] = [];
    page.on("request", (r) => {
      if (/\/hero\/.*\.mp4/.test(r.url())) media.push(r.url());
    });
    if (preference === "reduced")
      await page.emulateMedia({ reducedMotion: "reduce" });
    if (preference === "save-data")
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "connection", {
          value: Object.assign(new EventTarget(), { saveData: true }),
          configurable: true,
        }),
      );
    if (preference === "autoplay-rejected")
      await page.addInitScript(() => {
        HTMLMediaElement.prototype.play = () =>
          Promise.reject(
            new DOMException("Autoplay rejected", "NotAllowedError"),
          );
      });
    await page.goto("/");
    const film = page.locator(".hero-film");
    if (preference === "autoplay-rejected")
      await expect(film).toHaveAttribute("data-failed", "true");
    else {
      await page.waitForTimeout(400);
      expect(media).toEqual([]);
    }
    await expect(film).toHaveAttribute("data-ready", "false");
    await expect(page.locator(".gateway-world img")).toBeVisible();
    await page.locator('.gateway-actions a[href="/start"]').click();
    await expect(
      page.getByRole("heading", { name: "Play", exact: true }),
    ).toBeVisible();
  });
}
test("failed and slow media do not block navigation", async ({ page }) => {
  await page.route("**/hero/*.mp4", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-failed",
    "true",
  );
  await expect(page.locator(".gateway-world img")).toBeVisible();
  await page.unroute("**/hero/*.mp4");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/hero/*.mp4", async (route) => {
    await gate;
    await route.abort();
  });
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".hero-film")).toHaveAttribute(
      "data-ready",
      "false",
    );
    await page.locator('.gateway-actions a[href="/start"]').click();
    await expect(page.locator('.play-mode[href="/arena"]')).toContainText(
      "Free",
    );
    for (const mode of ["/story", "/match", "/challenge"])
      await expect(page.locator(`.play-mode[href="${mode}"]`)).toBeVisible();
    await expect(page.locator(".play-menu > .muted")).toHaveText(
      "Story and player battles: 500 $CHOG or a Chog NFT.",
    );
  } finally {
    release();
  }
});
test("rotation updates the variant; enlarged text and keyboard navigation remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".hero-film")).toHaveAttribute("src", /mobile.mp4/);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "src",
    /desktop.mp4/,
  );
  await expect(page.locator(".hero-film")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>(".gateway-copy *")]
      .filter((el) => el.namespaceURI === "http://www.w3.org/1999/xhtml")
      .map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }));
    for (const { el, size } of sizes) el.style.fontSize = `${size * 2}px`;
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const play = page.locator('.gateway-actions a[href="/start"]');
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await play.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(play).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/start$/);
});

test("only Practice is available without holdings; mode entry preserves access gates", async ({
  page,
}) => {
  for (const path of [
    "/story",
    "/match",
    "/challenge",
    "/arena?as=holder",
    "/history?as=holder",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("region", { name: "Soryn access" }),
    ).toBeVisible();
    // Provider readiness is external to this anonymous-gate check; full sign-in
    // and recovery are covered by the labelled access-gate adapter fixtures.
    const entry = page.getByRole("button", {
      name: /^(Connect wallet|Checking your session…)$/,
    });
    await expect(entry).toBeVisible();
    if ((await entry.textContent()) === "Checking your session…")
      await expect(entry).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "Play Practice", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create invitation", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".story-journey")).toHaveCount(0);
  }
  await page.goto("/start");
  await expect(
    page.getByRole("link", { name: "Holder Practice", exact: true }),
  ).toHaveAttribute("href", "/arena?as=holder");
  await expect(
    page.getByRole("link", { name: "Wallet history", exact: true }),
  ).toHaveAttribute("href", "/history?as=holder");
  await page.goto("/arena");
  await expect(
    page.getByRole("button", { name: "Enter guest arena", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Guest Practice", { exact: true })).toBeVisible();
});
