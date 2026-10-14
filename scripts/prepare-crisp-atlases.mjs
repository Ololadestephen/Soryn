import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import sharp from "sharp";
import {
  alphaBounds,
  groundRow,
  sharedCrop,
} from "./combat-atlas/geometry.mjs";

const legacy = JSON.parse(
  readFileSync("src/components/combat/rendered/legacy-atlas-data.json", "utf8"),
);
const output = "public/combat/crisp";
mkdirSync(output, { recursive: true });
const atlases = {},
  measurements = [];

async function pack(source, role, indices) {
  const input = legacy[source],
    key = role === "fighter" ? source : `${source}-pet`;
  const masterPath = `assets/combat/rendered/${source}.png`;
  const canvas = input.cells[indices[0]].slice(2),
    frames = [];
  const baseline = Math.round(canvas[1] * 0.94);
  for (const index of indices) {
    const [left, top, width, height] = input.cells[index];
    const { data } = await sharp(masterPath)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ground = groundRow(data, width, height);
    frames.push({
      data,
      width,
      height,
      source: [left, top, width, height],
      ground,
      shift: [Math.round((canvas[0] - width) / 2), baseline - ground],
      bounds: alphaBounds(data, width, height, 2),
    });
  }
  const crop = sharedCrop(frames),
    cells = [],
    normalized = [];
  for (const frame of frames) {
    // Integer translation only: preserve original pixel scale, proportions and idle framing.
    const pixels = Buffer.alloc(crop.width * crop.height * 4);
    for (let y = 0; y < frame.height; y++)
      for (let x = 0; x < frame.width; x++) {
        const dx = x + frame.shift[0] - crop.left,
          dy = y + frame.shift[1] - crop.top;
        if (dx < 0 || dy < 0 || dx >= crop.width || dy >= crop.height) continue;
        frame.data.copy(
          pixels,
          (dy * crop.width + dx) * 4,
          (y * frame.width + x) * 4,
          (y * frame.width + x) * 4 + 4,
        );
      }
    normalized.push(pixels);
  }
  const rows = Math.ceil(indices.length / 3),
    width = crop.width * 3,
    height = crop.height * rows;
  const packed = Buffer.alloc(width * height * 4);
  normalized.forEach((pixels, i) => {
    const x = (i % 3) * crop.width,
      y = Math.floor(i / 3) * crop.height;
    cells.push([x, y, crop.width, crop.height]);
    for (let row = 0; row < crop.height; row++)
      pixels.copy(
        packed,
        ((y + row) * width + x) * 4,
        row * crop.width * 4,
        (row + 1) * crop.width * 4,
      );
  });
  const path = `${output}/${key}.webp`;
  await sharp(packed, { raw: { width, height, channels: 4 } })
    .webp({ nearLossless: true, quality: 85, alphaQuality: 100, effort: 6 })
    .toFile(path);
  atlases[key] = {
    path: path.replace("public", ""),
    width,
    height,
    canvas,
    offset: [crop.left, crop.top],
    baseline,
    cells,
    fallback: { ...input, cells: indices.map((i) => input.cells[i]) },
  };
  let preview;
  if (role === "fighter") {
    const previewPath = `${output}/${key}-idle.webp`;
    await sharp(normalized[0], {
      raw: { width: crop.width, height: crop.height, channels: 4 },
    })
      .webp({ nearLossless: true, quality: 85, alphaQuality: 100, effort: 6 })
      .toFile(previewPath);
    preview = {
      path: previewPath.replace("public", ""),
      width: crop.width,
      height: crop.height,
      cells: [[0, 0, crop.width, crop.height]],
    };
    atlases[key].preview = preview;
  }
  measurements.push({
    key,
    master: masterPath,
    sourceDimensions: [input.width, input.height],
    sourceCells: frames.map((f) => ({
      source: f.source,
      bounds: f.bounds,
      ground: f.ground,
      shift: f.shift,
    })),
    canvas,
    crop,
    runtimeDimensions: [width, height],
    bytes: statSync(path).size,
    decodedRgbaBytes: width * height * 4,
    preview: preview
      ? {
          dimensions: [preview.width, preview.height],
          bytes: statSync(`public${preview.path}`).size,
          decodedRgbaBytes: preview.width * preview.height * 4,
        }
      : null,
  });
}

for (const key of Object.keys(legacy)) {
  if (["armadillo", "phoenix"].includes(key)) await pack(key, "pet", [0, 1, 2]);
  else {
    await pack(key, "fighter", [0, 1, 2, 3, 4, 5]);
    if (!["aegis", "ember"].includes(key)) await pack(key, "pet", [6, 7, 8]);
  }
}
writeFileSync(
  "src/components/combat/rendered/atlas-data.json",
  JSON.stringify(atlases, null, 2) + "\n",
);
writeFileSync(
  "docs/evidence/art-restoration/runtime-manifest.json",
  JSON.stringify(
    {
      codec:
        "WebP near-lossless quality 85, alpha quality 100; no resampling/sharpening/regeneration",
      measurements,
      totalBytes: measurements.reduce((n, a) => n + a.bytes, 0),
      totalDecodedRgbaBytes: measurements.reduce(
        (n, a) => n + a.decodedRgbaBytes,
        0,
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${measurements.length} cropped rendered-art atlases`);
