import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = "assets/combat/blender/frames";
const output = "public/combat/blender";
const manifest = JSON.parse(
  await readFile(path.join(source, "frames.json"), "utf8"),
);
await mkdir(output, { recursive: true });
const actors = {};
const bytes = [];

function alphaBounds(data, width, height) {
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 3) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top)
    throw new Error("Empty rendered animation frame");
  if (left < 2 || top < 2 || right > width - 2 || bottom > height - 2)
    throw new Error(
      "Rendered animation reaches its frame edge; repair camera framing",
    );
  return [left, top, right, bottom];
}

for (const [actor, definition] of Object.entries(manifest.actors)) {
  const { width, height } = definition;
  const clips = {};
  const sources = {};
  let union = [width, height, 0, 0];
  for (const [clip, description] of Object.entries(definition.clips)) {
    const directory = path.join(source, actor, clip);
    const files = (await readdir(directory))
      .filter((f) => f.endsWith(".png"))
      .sort();
    if (files.length !== description.count)
      throw new Error(`${actor}/${clip}: incomplete samples`);
    sources[clip] = files.map((file) => path.join(directory, file));
    for (let n = 0; n < files.length; n++) {
      const file = path.join(directory, files[n]);
      const image = sharp(file);
      const metadata = await image.metadata();
      if (
        !metadata.hasAlpha ||
        metadata.width !== width ||
        metadata.height !== height
      )
        throw new Error(`${file}: wrong alpha or dimensions`);
      const raw = await image.ensureAlpha().raw().toBuffer();
      const bounds = alphaBounds(raw, width, height);
      union = [
        Math.min(union[0], bounds[0]),
        Math.min(union[1], bounds[1]),
        Math.max(union[2], bounds[2]),
        Math.max(union[3], bounds[3]),
      ];
    }
  }
  // One shared crop for every actor/clip preserves pivots while removing empty pixels.
  const crop = {
    left: union[0] - 2,
    top: union[1] - 2,
    width: union[2] - union[0] + 4,
    height: union[3] - union[1] + 4,
  };
  for (const [clip, files] of Object.entries(sources)) {
    const columns = Math.ceil(
      Math.sqrt((files.length * crop.height) / crop.width),
    );
    const rows = Math.ceil(files.length / columns);
    const placements = [];
    for (let n = 0; n < files.length; n++) {
      placements.push({
        input: await sharp(files[n]).extract(crop).png().toBuffer(),
        left: (n % columns) * crop.width,
        top: Math.floor(n / columns) * crop.height,
      });
    }
    const filename = `${actor}-${clip}.webp`;
    const target = path.join(output, filename);
    await sharp({
      create: {
        width: columns * crop.width,
        height: rows * crop.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(placements)
      .webp({ quality: 84, alphaQuality: 100, effort: 6 })
      .toFile(target);
    clips[clip] = {
      path: `/combat/blender/${filename}`,
      width: columns * crop.width,
      height: rows * crop.height,
      columns,
      count: files.length,
      frameWidth: crop.width,
      frameHeight: crop.height,
    };
    bytes.push({
      actor,
      clip,
      encodedBytes: (await stat(target)).size,
      rgbaDecodedBytes: columns * crop.width * rows * crop.height * 4,
    });
  }
  actors[actor] = {
    bounds: [0, 0, crop.width, crop.height],
    sourceCrop: crop,
    clips,
  };
}
await mkdir("src/components/combat/blender", { recursive: true });
await writeFile(
  "src/components/combat/blender/atlases.json",
  JSON.stringify(actors, null, 2) + "\n",
);
await writeFile(
  "docs/evidence/blender-animation/asset-measurements.json",
  JSON.stringify(
    {
      note: "Real compressed file bytes; RGBA figures are full-image estimates, not measured browser heap/GPU allocations.",
      files: bytes,
      totalEncodedBytes: bytes.reduce((n, f) => n + f.encodedBytes, 0),
      totalRgbaDecodedBytes: bytes.reduce((n, f) => n + f.rgbaDecodedBytes, 0),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Packed real transparent rig/action samples:",
  bytes.length,
  "atlases",
);
