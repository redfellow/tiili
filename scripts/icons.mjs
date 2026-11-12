// Generates tiili's app icons in src-tauri/icons from the brand SVGs.
//
// The large icon (docs/brand/logo/icon-light.svg) is rasterised to a 1024 px PNG and handed to `tauri icon`,
// which writes every desktop format. Sizes of 32 px and below are then re-rendered from the small icon
// (icon-light-small.svg), both as PNG files and as entries in icon.ico.
//
// Run with `npm run icons`. The outputs are committed.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = join(root, "docs/brand/logo");
const outDir = join(root, "src-tauri/icons");
const largeSvg = readFileSync(join(logoDir, "icon-light.svg"));
const smallSvg = readFileSync(join(logoDir, "icon-light-small.svg"));

/** Largest size, in pixels, that is rendered from the small icon. */
const SMALL_MAX = 32;

/** PNG files of 32 px and below that `tauri icon` writes, with their size. */
const SMALL_PNGS = [
  ["32x32.png", 32],
  ["Square30x30Logo.png", 30],
];

/** Entries in icon.ico, as `tauri icon` writes them. */
const ICO_SIZES = [16, 24, 32, 48, 64, 256];

function render(size) {
  const svg = size <= SMALL_MAX ? smallSvg : largeSvg;
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

/** Builds an .ico file whose entries are PNG images (supported since Windows Vista). */
function ico(sizes) {
  const images = sizes.map((size) => ({ size, png: render(size) }));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const work = mkdtempSync(join(tmpdir(), "tiili-icons-"));
try {
  const source = join(work, "icon-1024.png");
  writeFileSync(source, render(1024));
  const generated = join(work, "out");
  execFileSync("npx", ["tauri", "icon", source, "--output", generated], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  // Keep the desktop icons only; the android/ and ios/ folders are not used.
  for (const name of readdirSync(generated)) {
    const path = join(generated, name);
    if (statSync(path).isFile()) copyFileSync(path, join(outDir, name));
  }

  for (const [name, size] of SMALL_PNGS) writeFileSync(join(outDir, name), render(size));
  writeFileSync(join(outDir, "icon.ico"), ico(ICO_SIZES));
} finally {
  rmSync(work, { recursive: true, force: true });
}
