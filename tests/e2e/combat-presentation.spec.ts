import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({
  reducedMotion: "no-preference",
  video: { mode: "on", size: { width: 1280, height: 960 } },
  viewport: { width: 1280, height: 960 },
});
test.afterEach(async ({ page, context }, info) => {
  const video = page.video();
  await context.close();
  if (video && info.status === "passed") {
    const recordings = process.env.CHOG_EVIDENCE_DIR
      ? `${process.env.CHOG_EVIDENCE_DIR}/recordings`
      : "docs/evidence/recordings";
    mkdirSync(recordings, { recursive: true });
    await video.saveAs(`${recordings}/${info.title.split(" · ")[0]}.webm`);
  }
});
async function setup(page: Page, fighter: string, foe: string, mode = "easy") {
  await page.goto("/arena");
  await page.getByRole("radio", { name: new RegExp(`^${fighter} /`) }).check();
  await page.getByLabel("Computer opponent").selectOption(foe);
  await page
    .getByRole("radio", {
      name: mode[0].toUpperCase() + mode.slice(1),
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.locator(".arena-round")).toContainText(
    mode[0].toUpperCase() + mode.slice(1),
  );
}
async function move(page: Page, kind: "Basic attack" | "Defence" | "Special") {
  await page.getByRole("button", { name: new RegExp(`^${kind}`) }).click();
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await expect(
    page.locator(".combat-number,.combat-impact,.move-effect"),
  ).toHaveCount(0);
}
for (const mode of ["easy", "medium", "hard"] as const)
  test(`difficulty-${mode} · keyboard setup, refresh and retained rematch`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page, "Pip", "bolt", mode);
    await move(page, "Special");
    const stored = await (await page.request.get("/api/battle")).json();
    expect(stored.battle.snapshot.policy).toBe("combat-opponent/2");
    expect(stored.battle.snapshot.difficulty).toBe(mode);
    expect(stored.battle.pending).toBeUndefined();
    await page.reload();
    await expect(page.locator(".arena-round")).toContainText(
      `${mode[0].toUpperCase() + mode.slice(1)} · Round 2`,
    );
    for (let n = 0; n < 20; n++) {
      if (
        await page
          .getByRole("button", { name: "Rematch", exact: true })
          .isVisible()
      )
        break;
      const special = page.getByRole("button", { name: /^Special/ });
      await (
        (await special.isEnabled())
          ? special
          : page.getByRole("button", { name: /^Basic attack/ })
      ).click();
      await expect
        .poll(
          async () =>
            (await page
              .getByRole("button", { name: /^Defence/ })
              .isEnabled()) ||
            (await page
              .getByRole("button", { name: "Rematch", exact: true })
              .isVisible()),
          { timeout: 15000 },
        )
        .toBe(true);
    }
    await expect(page.locator(".combat-result")).toContainText(
      mode[0].toUpperCase() + mode.slice(1),
    );
    await page.getByRole("button", { name: "Rematch", exact: true }).click();
    await expect(page.locator(".arena-round")).toContainText(
      `${mode[0].toUpperCase() + mode.slice(1)} · Round 1`,
    );
  });

test("combat-counter · full block, special and responding guardian counter", async ({
  page,
}) => {
  await setup(page, "Pip", "aegis", "medium");
  await move(page, "Basic attack");
  await move(page, "Basic attack");
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.locator(".fighter-opponent.combat-melee")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".cue-counter")).toContainText("Counter −4 HP");
  await page.screenshot({
    path: "test-results/presentation-counter.png",
    fullPage: false,
  });
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await expect(
    page.locator(".combat-number,.combat-impact,.move-effect"),
  ).toHaveCount(0);
});

test("combat-repair · attack versus actual repair animation and numeric healing", async ({
  page,
}) => {
  await setup(page, "Patch", "bolt");
  await move(page, "Basic attack");
  await page.getByRole("button", { name: /^Special/ }).click();
  await expect(page.locator(".treatment-patch-special")).toBeVisible();
  await expect(page.locator(".cue-heal")).toContainText("+14 HP");
  await page.screenshot({
    path: "test-results/presentation-repair.png",
    fullPage: false,
  });
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await expect(
    page.locator(".combat-number,.combat-impact,.move-effect"),
  ).toHaveCount(0);
});

test("combat-multi-hit · two visible deliveries, dodge, burn and recoil", async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page, "Pip", "bolt");
  for (let n = 0; n < 4; n++) await move(page, "Defence");
  await page.evaluate(() => {
    const observed: string[] = [];
    (window as Window & { chogVisualEvidence?: string[] }).chogVisualEvidence =
      observed;
    const collect = () => {
      for (const node of document.querySelectorAll(".move-effect"))
        observed.push(node.getAttribute("class") ?? "");
    };
    new MutationObserver(collect).observe(
      document.querySelector(".combat-field")!,
      { childList: true, subtree: true },
    );
  });
  await page.getByRole("button", { name: /^Defence/ }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { chogVisualEvidence?: string[] })
              .chogVisualEvidence ?? [],
        ),
      { timeout: 15000 },
    )
    .toContainEqual(expect.stringContaining("treatment-bolt-special hit-2"));
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  // Independent test-only actor contexts, never a battle reset or health override.
  await page.context().clearCookies();
  await setup(page, "Pip", "nyx");
  for (let n = 0; n < 3; n++) await move(page, "Basic attack");
  await page.evaluate(() => {
    const observed: string[] = [];
    (window as Window & { chogVisualEvidence?: string[] }).chogVisualEvidence =
      observed;
    const collect = () => {
      for (const node of document.querySelectorAll<HTMLElement>(".cue-dodge")) {
        const box = node.getBoundingClientRect();
        if (
          box.width > 0 &&
          box.height > 0 &&
          box.y >= 0 &&
          box.bottom <= innerHeight &&
          getComputedStyle(node).visibility === "visible"
        )
          observed.push(node.textContent ?? "");
      }
    };
    const field = document.querySelector(".combat-field");
    if (!field) throw new Error("Missing actual battlefield");
    new MutationObserver(collect).observe(field, {
      childList: true,
      subtree: true,
    });
  });
  await page.getByRole("button", { name: /^Basic attack/ }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { chogVisualEvidence?: string[] })
              .chogVisualEvidence ?? [],
        ),
      { timeout: 15000 },
    )
    .toContain("Dodge · 0 damage");
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await page.context().clearCookies();
  await setup(page, "Pip", "ember");
  for (let n = 0; n < 4; n++) await move(page, "Defence");
  await page.getByRole("button", { name: /^Defence/ }).click();
  await expect(page.locator(".cue-recoil")).toContainText("Recoil −7 HP", {
    timeout: 15000,
  });
  await expect(page.locator(".cue-burn")).toContainText("Burn −3 HP");
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await expect(
    page.locator(".combat-number,.combat-impact,.move-effect"),
  ).toHaveCount(0);
});

test("combat-mobile · narrow enlarged text, keyboard difficulty and truthful layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/arena");
  const difficulty = page.getByRole("radio", { name: "Easy", exact: true });
  await expect(difficulty).toBeEnabled();
  await difficulty.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Medium", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Enter guest arena" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".arena-round")).toContainText("Medium");
  await page.getByRole("button", { name: /^Basic attack/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Defence/ })).toBeEnabled({
    timeout: 15000,
  });
  await page.addStyleTag({
    content:
      "body{font-size:200%} p,a,button,small,summary{font-size:1em!important}",
  });
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    nodes: Array.from(document.querySelectorAll("body *"))
      .filter(
        (el) =>
          el.getBoundingClientRect().right > innerWidth + 1 &&
          el.getClientRects().length > 0,
      )
      .map((el) => ({
        tag: el.tagName,
        class: el.className.toString(),
        right: el.getBoundingClientRect().right,
        text: el.textContent?.slice(0, 45),
      }))
      .slice(0, 15),
  }));
  expect(overflow).toMatchObject({ scroll: overflow.width });
  const status = await page.locator(".combat-scoreboard").boundingBox(),
    field = await page.locator(".combat-field").boundingBox();
  expect(field!.y).toBeGreaterThanOrEqual(status!.y + status!.height);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/presentation-mobile.png",
    fullPage: true,
  });
});

test("difficulty-http · invalid and conflicting modes are rejected without rerolling", async ({
  page,
}) => {
  await page.goto("/arena");
  const id = randomUUID(),
    input = {
      operation: "start",
      mode: "guest",
      id,
      characterId: "pip",
      opponent: "bolt",
      difficulty: "easy",
    };
  const headers = { Origin: "http://127.0.0.1:3100" };
  expect(
    (
      await page.request.post("/api/battle", {
        headers,
        data: { ...input, difficulty: "impossible" },
      })
    ).status(),
  ).toBe(400);
  const first = await (
    await page.request.post("/api/battle", { headers, data: input })
  ).json();
  expect(
    (
      await page.request.post("/api/battle", {
        headers,
        data: { ...input, difficulty: "hard" },
      })
    ).status(),
  ).toBe(409);
  expect((await (await page.request.get("/api/battle")).json()).battle).toEqual(
    first.battle,
  );
});

test("combat-normal-versus-reduced · identical complete outcomes and a visible knockout", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await setup(page, "Pip", "bolt");
  const play = async (target: Page) => {
    await expect(
      target.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled();
    const actions: string[] = [];
    for (let n = 0; n < 20; n++) {
      if (
        await target
          .getByRole("button", { name: "Rematch", exact: true })
          .isVisible()
      )
        break;
      const special = target.getByRole("button", { name: /^Special/ });
      const chosen = (await special.isEnabled()) ? "Special" : "Basic attack";
      actions.push(chosen);
      await target
        .getByRole("button", { name: new RegExp(`^${chosen}`) })
        .click();
      await expect
        .poll(
          async () =>
            (await target
              .getByRole("button", { name: /^Defence/ })
              .isEnabled()) ||
            (await target
              .getByRole("button", { name: "Rematch", exact: true })
              .isVisible()),
          { timeout: 15000 },
        )
        .toBe(true);
    }
    const final = await (await target.request.get("/api/battle")).json();
    await expect(target.locator(".arena-round")).toContainText(
      `${final.battle.rounds.length} resolved rounds`,
    );
    await expect(
      target.getByRole("region", { name: "Battle result" }),
    ).toBeVisible();
    await target.reload();
    await expect(
      target.getByRole("region", { name: "Battle result" }),
    ).toBeVisible();
    await expect(target.locator(".move-notice")).toHaveCount(0);
    return { actions, state: final.battle.state };
  };
  const normal = await play(page);
  await expect(page.locator(".combat-ko")).toBeVisible();
  await expect(
    page.locator(".combat-number,.combat-impact,.move-effect"),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/presentation-knockout.png",
    fullPage: true,
  });
  const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const reducedPage = await reducedContext.newPage();
    await setup(reducedPage, "Pip", "bolt");
    expect(await play(reducedPage)).toEqual(normal);
  } finally {
    await reducedContext.close();
  }
});
