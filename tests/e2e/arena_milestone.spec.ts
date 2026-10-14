import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { visualHolder } from "../browser-support/visual-holder";
import { installAudioCapture } from "../browser-support/audio-capture";

test.use({
  video: { mode: "on", size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
  reducedMotion: "no-preference",
});
test.afterEach(async ({ page, context }, info) => {
  const video = page.video();
  await context.close();
  if (video && info.status === "passed")
    await video.saveAs(
      `docs/evidence/arena-feel/${info.title.split(" · ")[0]}.webm`,
    );
});

for (const encounter of [
  {
    arena: "sanctuary",
    player: "aegis",
    foe: "ember",
    difficulty: "easy",
    motion: "no-preference",
    sound: true,
  },
  {
    arena: "grove",
    player: "pip",
    foe: "bolt",
    difficulty: "medium",
    motion: "no-preference",
    sound: false,
  },
  {
    arena: "foundry",
    player: "patch",
    foe: "bolt",
    difficulty: "hard",
    motion: "reduce",
    sound: true,
  },
  {
    arena: "sky",
    player: "echo",
    foe: "nyx",
    difficulty: "easy",
    motion: "no-preference",
    sound: false,
  },
] as const) {
  test.describe(encounter.arena, () => {
    const recordingViewport =
      encounter.arena === "sanctuary"
        ? { width: 1280, height: 800 }
        : { width: 390, height: 844 };
    test.use({
      viewport: recordingViewport,
    });
    test(`${encounter.arena}-complete · actual attacks, defence, specials, result and persistence`, async ({
      page,
    }) => {
      test.setTimeout(220000);
      mkdirSync("docs/evidence/arena-feel", { recursive: true });
      const videoStartedAt = Date.now();
      await installAudioCapture(page);
      const official = await visualHolder(page, 1300);
      expect(
        (
          await official({
            operation: "start",
            mode: "official",
            id: randomUUID(),
            characterId: encounter.player,
            opponent: encounter.foe,
            difficulty: encounter.difficulty,
            arena: encounter.arena,
          })
        ).ok(),
      ).toBe(true);
      await page.emulateMedia({ reducedMotion: encounter.motion });
      await page.goto("/arena");
      await expect(page.locator(".arena-name")).toContainText(
        encounter.arena === "grove"
          ? "Moonlit Grove"
          : encounter.arena === "foundry"
            ? "Ember Foundry"
            : encounter.arena === "sky"
              ? "Sky Temple"
              : "Ruined Sanctuary",
      );
      await expect(page.locator(".battle-stage")).not.toHaveAttribute(
        "data-preparing",
        "true",
        { timeout: 40000 },
      );
      expect(await page.evaluate(() => window.chogAudioQA.contexts)).toBe(0);
      const watermark =
        '.battle-stage::after{content:"Synthetic holder · cosmetic arena QA";position:absolute;bottom:3px;left:8px;background:#21192ce0;color:white;font:10px Arial;padding:3px 5px;z-index:30;pointer-events:none}';
      await page.addStyleTag({ content: watermark });
      const ownVariant = encounter.arena === "sanctuary" ? "desktop" : "mobile";
      await page.screenshot({
        path: `docs/evidence/arena-feel/${encounter.arena}-${ownVariant}.png`,
      });
      // This page remains at one viewport for the entire recording. Other-viewport screenshots are captured in the separate full-suite visual checks.
      await page.getByRole("button", { name: "Battle settings" }).click();
      const sound = page.getByLabel("Sound effects on");
      await expect(sound).toBeVisible();
      await sound.setChecked(encounter.sound);
      if (encounter.sound)
        await page.getByRole("button", { name: "Try sound" }).click();
      await page.getByRole("button", { name: "Return to battle" }).click();
      const beforeControls = await page
        .locator(".combat-controls")
        .boundingBox();
      for (let round = 0; round < 20; round++) {
        if (
          await page
            .getByRole("button", { name: "Rematch", exact: true })
            .isVisible()
        )
          break;
        const special = page.getByRole("button", { name: /^Special/ });
        const guard = page.getByRole("button", { name: /^Defence/ });
        const basic = page.getByRole("button", { name: /^Basic attack/ });
        const ready =
          round % 4 === 1
            ? guard
            : (await special.isEnabled())
              ? special
              : basic;
        const sequence = [
          "special",
          "basic",
          "basic",
          "guard",
          "special",
          "guard",
          "guard",
          "guard",
          "basic",
          "guard",
          "guard",
        ];
        const planned =
          encounter.arena === "sanctuary" ? sequence[round] : undefined;
        await (
          planned === "special" && (await special.isEnabled())
            ? special
            : planned === "guard"
              ? guard
              : planned === "basic"
                ? basic
                : ready
        ).click();
        await expect
          .poll(
            async () =>
              (await basic.isEnabled()) ||
              (await page
                .getByRole("button", { name: "Rematch", exact: true })
                .isVisible()),
            { timeout: 30000 },
          )
          .toBe(true);
        const controls = await page.locator(".combat-controls").boundingBox();
        expect(controls?.y).toBe(beforeControls?.y);
      }
      await expect(
        page.getByRole("region", { name: "Battle result" }),
      ).toBeVisible();
      await expect(page.locator(".move-notice")).toHaveCount(0);
      writeFileSync(
        `docs/evidence/arena-feel/${encounter.arena}-battle.json`,
        JSON.stringify(
          {
            fixture: "Disposable synthetic holder; actual engine/API battle",
            battle: (await (await official.read()).json()).battle,
          },
          null,
          2,
        ),
      );
      await page.waitForTimeout(650);
      await page.screenshot({
        path: `docs/evidence/arena-feel/${encounter.arena}-result.png`,
      });
      const paths = await page.evaluate(() =>
        window.chogAudioQA.trace.map((entry) => entry.path),
      );
      if (encounter.sound) {
        expect(paths).toContain("/combat/audio/confirm.wav");
        expect(paths.some((path) => path.includes("special-"))).toBe(true);
        expect(paths).toContain("/combat/audio/impact.wav");
      } else expect(paths).toEqual([]);
      const count = paths.length;
      if (encounter.arena === "sanctuary") {
        expect(paths).toContain("/combat/audio/block.wav");
        expect(paths).toContain("/combat/audio/counter.wav");
        expect(paths).toContain("/combat/audio/knockout.wav");
        const captured = await page.evaluate(() => window.chogAudioQA.finish());
        expect(captured.bytes.length).toBeGreaterThan(1000);
        writeFileSync(
          "docs/evidence/arena-feel/sanctuary-audio.webm",
          Buffer.from(captured.bytes),
        );
        writeFileSync(
          "docs/evidence/arena-feel/audio-capture.json",
          JSON.stringify(
            {
              offsetSeconds: (captured.startedAt - videoStartedAt) / 1000,
              trace: captured.trace,
              method:
                "Actual Web Audio output graph captured by MediaRecorder; approximate wall-clock alignment to recorded page video",
            },
            null,
            2,
          ),
        );
      }
      await page.reload();
      expect(await page.evaluate(() => window.chogAudioQA.trace.length)).toBe(
        0,
      );
      await expect(page.locator(".move-notice")).toHaveCount(0);
      await page.getByRole("button", { name: "View battle history" }).click();
      await expect(page.locator(".combat-log")).toContainText("cosmetic arena");
      await page.getByRole("button", { name: "Close Battle history" }).click();
      await page.getByRole("button", { name: "Rematch", exact: true }).click();
      const saved = await (await official.read()).json();
      expect(saved.battle.arena).toBe(encounter.arena);
      expect(saved.battle.snapshot.difficulty).toBe(encounter.difficulty);
      writeFileSync(
        `docs/evidence/arena-feel/${encounter.arena}-verification.json`,
        JSON.stringify(
          {
            arena: encounter.arena,
            difficulty: encounter.difficulty,
            motion: encounter.motion,
            sound: encounter.sound,
            paths,
            count,
          },
          null,
          2,
        ),
      );
      // Finalize the rematch via real authorized steps so the fixture leaves no active record.
      await official.finish();
    });
  });
}
