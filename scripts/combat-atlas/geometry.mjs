/** Alpha bounds in source pixels. Threshold is explicit: never resize to invent detail. */
export function alphaBounds(data, width, height, threshold) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (right < left) throw new Error("Empty artwork cell");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Bottom of substantial opaque silhouette; ignore stray particles and faint alpha noise. */
export function groundRow(data, width, height) {
  for (let y = height - 1; y >= 0; y--) {
    let count = 0;
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 128) count++;
    if (count >= Math.max(4, Math.ceil(width * 0.04))) return y + 1;
  }
  throw new Error("No substantial artwork silhouette");
}

export function sharedCrop(frames) {
  const left = Math.min(...frames.map((f) => f.bounds.left + f.shift[0])) - 2;
  const top = Math.min(...frames.map((f) => f.bounds.top + f.shift[1])) - 2;
  const right =
    Math.max(
      ...frames.map((f) => f.bounds.left + f.bounds.width + f.shift[0]),
    ) + 2;
  const bottom =
    Math.max(
      ...frames.map((f) => f.bounds.top + f.bounds.height + f.shift[1]),
    ) + 2;
  return { left, top, width: right - left, height: bottom - top };
}
