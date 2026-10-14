import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const cli = process.argv[2];
if (!cli)
  throw new Error(
    "Usage: node scripts/render-hero.mjs /absolute/path/to/hyperframes/bin/hyperframes.mjs",
  );
function run(command, args) {
  const r = spawnSync(command, args, { stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} exited ${r.status}`);
}
mkdirSync(".cache/hero", { recursive: true });
mkdirSync("public/hero", { recursive: true });
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
for (const variant of ["desktop", "mobile"]) {
  run(process.env.CHOG_FFMPEG ?? "ffmpeg", [
    "-y",
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
    `public/hero/sanctuary-motion-v3-${variant}.mp4`,
  ]);
}
