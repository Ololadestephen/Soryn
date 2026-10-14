import fs from "node:fs";
import sharp from "sharp";
const source = JSON.parse(
  fs.readFileSync("src/components/combat/rendered/atlas-data.json", "utf8"),
);
import { renderedFighters } from "../src/components/combat/rendered/catalogue.ts";
const pairs = Object.fromEntries(
  Object.entries(renderedFighters).map(([id, a]) => [id, a.companion]),
);
fs.mkdirSync("public/landing", { recursive: true });
const assets = {},
  measurements = [];
for (const [id, pet] of Object.entries(pairs)) {
  const family = {};
  for (const [kind, key] of [
    ["fighter", id],
    ["companion", pet],
  ]) {
    const a = source[key],
      [x, y, width, height] = a.cells[0];
    const path =
      kind === "fighter" ? a.preview.path : `/landing/${id}-companion.webp`;
    if (kind === "companion")
      await sharp(`public${a.path}`)
        .extract({ left: x, top: y, width, height })
        .resize({
          width: 512,
          height: 512,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 92, alphaQuality: 100, effort: 6 })
        .toFile(`public${path}`);
    const dims =
      kind === "fighter" ? a.preview : await sharp(`public${path}`).metadata();
    const scale = dims.width / width;
    family[kind] = {
      path,
      width: dims.width,
      height: dims.height,
      offset: a.offset.map((value) => value * scale),
      canvas: a.canvas.map((value) => value * scale),
    };
    measurements.push({
      id,
      kind,
      path,
      dimensions: [dims.width, dims.height],
      bytes: fs.statSync(`public${path}`).size,
      rgbaBytes: dims.width * dims.height * 4,
    });
  }
  const a = family.fighter;
  const thumbnail = `/landing/${id}-thumb.webp`;
  await sharp(`public${a.path}`)
    .resize(128, 128, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`public${thumbnail}`);
  family.thumbnail = thumbnail;
  assets[id] = family;
  measurements.push({
    id,
    kind: "thumbnail",
    path: thumbnail,
    dimensions: [128, 128],
    bytes: fs.statSync(`public${thumbnail}`).size,
    rgbaBytes: 128 * 128 * 4,
  });
}
fs.writeFileSync(
  "src/components/site/landing/assets.json",
  JSON.stringify(assets, null, 2) + "\n",
);
fs.writeFileSync(
  "docs/evidence/cinematic-landing/assets.json",
  JSON.stringify(
    {
      method:
        "Approved idle pixels; existing full-quality fighter exports, companion idle crops capped at 512px (WebP quality 92, alpha 100, proportional canvas/offset), 128px catalogue thumbnails. Full battle sources preserved. No image regeneration/upscaling or NFT artwork.",
      measurements,
    },
    null,
    2,
  ) + "\n",
);
