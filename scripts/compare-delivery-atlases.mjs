import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const entries = JSON.parse(
  readFileSync("src/components/combat/rendered/atlas-data.json", "utf8"),
);
const metrics = [];
for (const [key, a] of Object.entries(entries)) {
  const original = await sharp(`public${a.path}`)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const candidate = await sharp(`public/combat/delivery/${key}.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer();
  let alphaChanges = 0,
    error = 0,
    count = 0;
  for (let p = 0; p < original.length; p += 4) {
    if (original[p + 3] !== candidate[p + 3]) alphaChanges++;
    if (original[p + 3] > 128)
      for (let c = 0; c < 3; c++) {
        error += (original[p + c] - candidate[p + c]) ** 2;
        count++;
      }
  }
  metrics.push({
    key,
    alphaChanges,
    opaqueRgbPsnr: 10 * Math.log10(255 ** 2 / (error / count)),
    dimensions: [a.width, a.height],
  });
  if (
    ["aegis", "ember", "pip", "bolt", "armadillo-pet", "phoenix-pet"].includes(
      key,
    )
  ) {
    const [left, top, width, height] = a.cells[0];
    const shots = await Promise.all(
      [`public${a.path}`, `public/combat/delivery/${key}.webp`].map((p) =>
        sharp(p)
          .extract({ left, top, width, height })
          .flatten({ background: "#32283c" })
          .png()
          .toBuffer(),
      ),
    );
    await sharp({
      create: { width: width * 2, height, channels: 3, background: "#32283c" },
    })
      .composite(shots.map((input, i) => ({ input, left: i * width, top: 0 })))
      .png()
      .toFile(`docs/evidence/cinematic-readiness/${key}-native-comparison.png`);
  }
}
writeFileSync(
  "docs/evidence/cinematic-readiness/encoding-quality.json",
  JSON.stringify(metrics, null, 2) + "\n",
);
