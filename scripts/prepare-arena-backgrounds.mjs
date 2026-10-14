import { writeFileSync, statSync } from "node:fs";
import sharp from "sharp";

const ids = ["sanctuary", "grove", "foundry", "sky"];
const measurements = [];
for (const id of ids) {
  const input =
    id === "sanctuary"
      ? "assets/combat/rendered/environment.png"
      : `assets/combat/arenas/${id}.png`;
  const meta = await sharp(input).metadata();
  const paths = [];
  for (const variant of ["desktop", "portrait", "preview"]) {
    let image = sharp(input);
    if (variant === "portrait") {
      const width = Math.round(meta.height * 0.64);
      image = image.extract({
        left: Math.round((meta.width - width) / 2),
        top: 0,
        width,
        height: meta.height,
      });
    }
    if (variant === "preview")
      image = image.resize(240, 160, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: true,
      });
    const path = `public/combat/arenas/${id}-${variant}.webp`;
    await image
      .webp({ quality: variant === "preview" ? 80 : 90, effort: 6 })
      .toFile(path);
    const result = await sharp(path).metadata();
    paths.push({
      variant,
      path,
      dimensions: [result.width, result.height],
      compressedBytes: statSync(path).size,
      rgbaBytes: result.width * result.height * 4,
    });
  }
  measurements.push({
    id,
    master: input,
    masterDimensions: [meta.width, meta.height],
    variants: paths,
  });
}
writeFileSync(
  "docs/evidence/arena-feel/backgrounds.json",
  JSON.stringify(measurements, null, 2) + "\n",
);
console.log(`Prepared ${measurements.length} arena families`);
