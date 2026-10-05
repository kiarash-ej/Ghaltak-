// Builds the web-sized brand files from the brand kit's masters.
//
//   node scripts/brand-assets.mjs <folder with the unzipped GHALTAK_brand_assets>
//
// The masters (up to 2400 px, ~1 MB each) stay out of the repo; only these
// small files are committed. Re-run this when the brand kit changes.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const kit = process.argv[2];
if (!kit) {
  console.error("usage: node scripts/brand-assets.mjs <brand kit folder>");
  process.exit(1);
}

const NAVY = "#0C1326"; // the dark app icon's own background, so the filled corners match it
const src = (name) => path.join(kit, name);
const out = (...p) => path.join(process.cwd(), ...p);

/** Transparent PNG, trimmed to the artwork, fitted into a square of `size`. */
async function symbol(size, file) {
  const trimmed = await sharp(src("logo_symbol_only.png")).trim().toBuffer();
  await sharp(trimmed)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(file);
}

/** Transparent PNG at `width`, trimmed. */
async function wide(name, width, file) {
  const trimmed = await sharp(src(name)).trim().toBuffer();
  await sharp(trimmed).resize({ width }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file);
}

/** A solid square icon: the dark app icon on navy, so no corner is transparent. */
async function solidIcon(size, file) {
  await sharp(src("app_icon_dark.png"))
    .resize(size, size)
    .flatten({ background: NAVY })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

async function webIcon(size, file) {
  await sharp(src("web_icon.png")).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
}

/** An .ico holding PNG images (supported by every current browser). */
async function ico(sizes, file) {
  const images = await Promise.all(
    sizes.map((s) => sharp(src("web_icon.png")).resize(s, s).png({ compressionLevel: 9 }).toBuffer()),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  images.forEach((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0);
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  });
  await writeFile(file, Buffer.concat([header, ...entries, ...images]));
}

await symbol(256, out("public/brand/logo-symbol.png"));
await wide("logo_with_name.png", 960, out("public/brand/logo-with-name.png"));
await wide("logo_text_only.png", 720, out("public/brand/logo-text.png"));
await webIcon(192, out("public/brand/icon-192.png"));
await webIcon(512, out("public/brand/icon-512.png"));
await solidIcon(512, out("public/brand/icon-maskable-512.png"));
await webIcon(192, out("src/app/icon.png"));
await solidIcon(180, out("src/app/apple-icon.png"));
await ico([16, 32, 48], out("src/app/favicon.ico"));
console.log("brand files written");
