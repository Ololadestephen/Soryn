import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import sharp from "sharp";
// Preserve every source pixel position, alpha edge, cell, canvas and pivot.
// Only the opaque RGB encoding changes; near-lossless sources remain available.
const atlases = JSON.parse(
  readFileSync("src/components/combat/rendered/atlas-data.json", "utf8"),
);
const measurements = [];
mkdirSync("public/combat/delivery", { recursive: true });
for (const [key, asset] of Object.entries(atlases)) {
  const source = `public/combat/crisp/${key}.webp`;
  const path = `public/combat/delivery/${key}.webp`;
  await sharp(source)
    .webp({ quality: 94, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(path);
  measurements.push({
    key,
    source,
    path,
    width: asset.width,
    height: asset.height,
    originalBytes: statSync(source).size,
    bytes: statSync(path).size,
    decodedRgbaBytes: asset.width * asset.height * 4,
  });
}
mkdirSync("docs/evidence/cinematic-readiness", { recursive: true });
writeFileSync(
  "docs/evidence/cinematic-readiness/atlas-candidates.json",
  JSON.stringify(measurements, null, 2) + "\n",
);
console.log(
  measurements
    .map((a) => `${a.key}: ${a.originalBytes} → ${a.bytes}`)
    .join("\n"),
);
