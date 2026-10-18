import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const cli = process.argv[2];
const ffmpeg = process.env.CHOG_FFMPEG ?? "ffmpeg";
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited ${result.status}`);
}
mkdirSync(".cache/hero", { recursive: true });
mkdirSync("public/hero", { recursive: true });
if (cli) {
  run(process.execPath, [cli, "check", "assets/hero-loop"]);
  run(process.execPath, [
    cli,
    "render",
    "assets/hero-loop",
    "--output",
    ".cache/hero/master.mp4",
    "--fps",
    "24",
    "--crf",
    "19",
    "--workers",
    "1",
  ]);
} else {
  // Offline fallback for the existing paused WAAPI composition. No CLI download.
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  const encoder = spawn(
    ffmpeg,
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "24",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      ".cache/hero/master.mp4",
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const completion = once(encoder, "close");
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.goto(
      new URL("../assets/hero-loop/index.html", import.meta.url).href,
    );
    const duration = await page
      .locator("[data-composition-id]")
      .getAttribute("data-duration");
    if (duration !== "10")
      throw new Error("Expected the ten-second Sanctuary composition.");
    for (let frame = 0; frame < 240; frame++) {
      await page.evaluate(
        (time) => {
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = time;
          }
        },
        (frame * 1000) / 24,
      );
      const png = await page.screenshot();
      if (!encoder.stdin.write(png)) await once(encoder.stdin, "drain");
    }
    encoder.stdin.end();
    const [code] = await completion;
    if (code !== 0) throw new Error(`Frame encoder exited ${code}`);
  } finally {
    if (encoder.exitCode === null) encoder.kill();
    await browser.close();
  }
}
for (const variant of ["desktop", "mobile"]) {
  const target = `public/hero/sanctuary-motion-v4-${variant}`;
  run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    ".cache/hero/master.mp4",
    ...(variant === "mobile" ? ["-vf", "crop=460:720,scale=540:844"] : []),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `${target}.mp4`,
  ]);
  const first = `.cache/hero/first-${variant}.png`;
  run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    `${target}.mp4`,
    "-frames:v",
    "1",
    first,
  ]);
  await sharp(first)
    .webp({ quality: 94 })
    .toFile(fileURLToPath(new URL(`../${target}.webp`, import.meta.url)));
}
