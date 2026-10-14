import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const manifestPath = "docs/evidence/arena-3d/asset-manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Read alpha only: retain every source pixel, record clear gutters for SVG viewports.
function gutters(data, width, height, channels, axis, parts) {
  const length = axis === "x" ? width : height;
  const cross = axis === "x" ? height : width;
  const occupancy = Array.from({ length }, (_, point) => {
    let count = 0;
    for (let offset = 0; offset < cross; offset++) {
      const x = axis === "x" ? point : offset;
      const y = axis === "x" ? offset : point;
      if (data[(y * width + x) * channels + 3] > 16) count++;
    }
    return count;
  });
  const boundaries = [0];
  for (let n = 1; n < parts; n++) {
    const expected = Math.round((n * length) / parts);
    const radius = Math.round((length / parts) * 0.3);
    const candidates = Array.from(
      { length: radius * 2 + 1 },
      (_, i) => expected - radius + i,
    );
    candidates.sort(
      (a, b) =>
        occupancy[a] - occupancy[b] ||
        Math.abs(a - expected) - Math.abs(b - expected),
    );
    boundaries.push(candidates[0]);
  }
  boundaries.push(length);
  return boundaries;
}

const atlases = {};
for (const [key, asset] of Object.entries(manifest.assets)) {
  if (key === "environment") continue;
  const { data, info } = await sharp(asset.master)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`${key}: missing alpha`);
  const rows =
    key === "armadillo" || key === "phoenix"
      ? 1
      : key === "aegis" || key === "ember"
        ? 2
        : 3;
  const x = gutters(data, info.width, info.height, info.channels, "x", 3);
  const y = gutters(data, info.width, info.height, info.channels, "y", rows);
  const cells = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < 3; col++)
      cells.push([x[col], y[row], x[col + 1] - x[col], y[row + 1] - y[row]]);
  atlases[key] = {
    path: asset.runtime.replace("public", ""),
    width: info.width,
    height: info.height,
    cells,
  };
  asset.displayCells = cells;
}
writeFileSync(
  "src/components/combat/rendered/atlas-data.json",
  JSON.stringify(atlases, null, 2) + "\n",
);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
