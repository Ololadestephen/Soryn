import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("framing · narrow/common portrait, landscape, safe insets and doubled text", async ({
  page,
  context,
}) => {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  const cdp = await context.newCDPSession(page);
  const measurements = [];
  for (const size of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 24, bottom: 20, left: 16, right: 16 },
    });
    await expect
      .poll(
        async () => (await page.locator(".battle-stage").boundingBox())?.width,
      )
      .toBe(size.width);
    const result = await page.evaluate(() => {
      const rect = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Missing ${selector}`);
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        hud: rect(".combat-scoreboard"),
        field: rect(".combat-field"),
        controls: rect(".combat-controls"),
        settings: rect(".battle-settings"),
        fighter: rect(".fighter-player"),
      };
    });
    expect(result.hud.y).toBeGreaterThanOrEqual(24);
    expect(result.hud.x).toBeGreaterThanOrEqual(16);
    expect(result.field.y).toBeGreaterThan(result.hud.y + result.hud.height);
    expect(result.field.y + result.field.height).toBeLessThan(
      result.controls.y,
    );
    expect(result.controls.x).toBeGreaterThanOrEqual(16);
    expect(result.controls.y + result.controls.height).toBeLessThanOrEqual(
      size.height - 20,
    );
    measurements.push({ size, ...result });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".battle-stage h3,.battle-stage p,.battle-stage small,.battle-stage strong,.battle-stage li,.battle-stage button span,.health-row label,.arena-round",
      ),
    );
    const sizes = items.map(
      (el) => parseFloat(getComputedStyle(el).fontSize) * 2,
    );
    items.forEach((el, index) => (el.style.fontSize = `${sizes[index]}px`));
  });
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeInViewport();
  await page.screenshot({ path: "docs/evidence/arena-feel/enlarged-text.png" });
  const field = await page.locator(".combat-field").boundingBox();
  const hud = await page.locator(".combat-scoreboard").boundingBox();
  const controls = await page.locator(".combat-controls").boundingBox();
  if (!field || !hud || !controls) throw new Error("Missing arena geometry");
  expect(field.y).toBeGreaterThan(hud.y + hud.height);
  expect(field.y + field.height).toBeLessThan(controls.y);
  const round = await page.locator(".arena-round").boundingBox();
  const name = await page.locator(".status-player h3").boundingBox();
  const readiness = await page.locator(".turn-readiness").boundingBox();
  if (!round || !name || !readiness) throw new Error("Missing enlarged labels");
  expect(name.y).toBeGreaterThan(round.y + round.height);
  expect(field.y + field.height).toBeLessThan(readiness.y);
  for (const button of await page.locator(".combat-controls button").all()) {
    expect(
      await button.evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);
  }
  mkdirSync("docs/evidence/arena-feel", { recursive: true });
  writeFileSync(
    "docs/evidence/arena-feel/framing.json",
    JSON.stringify(
      {
        safeInsets: { top: 24, bottom: 20, left: 16, right: 16 },
        textTest:
          "Computed gameplay label font sizes doubled; desktop browser emulation",
        measurements,
      },
      null,
      2,
    ),
  );
});
