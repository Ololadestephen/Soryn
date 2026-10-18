import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const brand = new URL("../public/brand/", import.meta.url);
const source = new URL("soryn-icon.svg", brand);
const sizes = [16, 32, 48, 180, 192, 512];
const images = [];

for (const size of sizes) {
  const png = await sharp(source.pathname, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(new URL(`soryn-icon-${size}.png`, brand), png);
  if (size <= 48) images.push({ size, png });
}

// ICO supports embedded PNG frames, keeping each small size independently rendered.
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
for (const [index, { size, png }] of images.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile(
  new URL("../public/favicon.ico", import.meta.url),
  Buffer.concat([directory, ...images.map(({ png }) => png)]),
);
