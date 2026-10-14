import { expect, test } from "@playwright/test";
test("stable selection prepares only its pair, cancels obsolete work and refresh retains the chosen match", async ({
  page,
}) => {
  test.setTimeout(60000);
  const paths: string[] = [];
  const cancelled: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/combat/delivery/")) paths.push(r.url());
  });
  page.on("requestfailed", (r) => cancelled.push(r.url()));
  await page.route("**/combat/delivery/*", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      await r.continue();
    } catch {
      /* Selection cleanup may already cancel the request. */
    }
  });
  await page.goto("/arena");
  await page.waitForTimeout(850);
  await page.getByLabel("Computer opponent").selectOption("moss");
  await page.getByRole("radio", { name: "Patch / Tinkerer" }).check();
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 30000 },
  );
  expect(paths.every((p) => /pip|bolt|patch|moss/.test(p))).toBe(true);
  expect(cancelled.some((p) => p.includes("/combat/delivery/"))).toBe(true);
  const saved = await (await page.request.get("/api/battle")).json();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await expect(
    page.locator('.rendered-art[data-art-source="unavailable"]'),
  ).toHaveCount(0);
  expect((await (await page.request.get("/api/battle")).json()).battle.id).toBe(
    saved.battle.id,
  );
});
test("total actor failure locks moves; retry recovers the same saved battle without another start", async ({
  page,
}) => {
  const pattern = "**/combat/{delivery,crisp,rendered}/*";
  await page.route(pattern, (r) => r.abort());
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(
    page.getByRole("button", { name: "Retry artwork" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeDisabled();
  const saved = await (await page.request.get("/api/battle")).json();
  await page.unroute(pattern);
  await page.getByRole("button", { name: "Retry artwork" }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await expect(
    page.locator('.rendered-art[data-art-source="unavailable"]'),
  ).toHaveCount(0);
  expect((await (await page.request.get("/api/battle")).json()).battle.id).toBe(
    saved.battle.id,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await expect(
    page.locator('.rendered-art[data-art-source="unavailable"]'),
  ).toHaveCount(0);
});

test("delivery encoding failure uses the preserved original complete pose atlas", async ({
  page,
}) => {
  await page.route("**/combat/delivery/*", (route) => route.abort());
  await page.goto("/arena");
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeEnabled();
  await expect(
    page.locator(".fighter-player .rendered-art image"),
  ).toHaveAttribute("href", "/combat/crisp/pip.webp");
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 15000 },
  );
  await expect(page.locator(".arena-round")).toContainText("Round 2");
});
