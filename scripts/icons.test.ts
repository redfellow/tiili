// @harvaaja-test-tier: fast
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const iconsDir = resolve(__dirname, "../src-tauri/icons");

/** Icon files each platform's bundle needs, with the pixel size of each PNG (null for container formats). */
const REQUIRED: Record<string, [file: string, size: number | null][]> = {
  macOS: [
    ["icon.icns", null],
    ["32x32.png", 32],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
  ],
  Windows: [
    ["icon.ico", null],
    ["32x32.png", 32],
    ["Square30x30Logo.png", 30],
    ["Square44x44Logo.png", 44],
    ["Square71x71Logo.png", 71],
    ["Square89x89Logo.png", 89],
    ["Square107x107Logo.png", 107],
    ["Square142x142Logo.png", 142],
    ["Square150x150Logo.png", 150],
    ["Square284x284Logo.png", 284],
    ["Square310x310Logo.png", 310],
    ["StoreLogo.png", 50],
  ],
  Linux: [
    ["32x32.png", 32],
    ["64x64.png", 64],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
    ["icon.png", 512],
  ],
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width and height from a PNG's IHDR chunk. */
function pngSize(data: Buffer): [number, number] {
  expect(data.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

/** Reads the sizes of an .ico file's entries from its directory. */
function icoSizes(data: Buffer): number[] {
  const count = data.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => data.readUInt8(6 + 16 * i) || 256);
}

/** Reads an .icns file's entries as a map from entry type to its data. */
function icnsEntries(data: Buffer): Map<string, Buffer> {
  expect(data.subarray(0, 4).toString("ascii")).toBe("icns");
  const entries = new Map<string, Buffer>();
  for (let offset = 8; offset < data.length; ) {
    const length = data.readUInt32BE(offset + 4);
    entries.set(data.toString("ascii", offset, offset + 4), data.subarray(offset + 8, offset + length));
    offset += length;
  }
  return entries;
}

/** icon.icns entries of 32 px and below: icp4 is 16 px, icp5 32 px, ic11 16@2x (32 px). */
const ICNS_SMALL: [type: string, size: number][] = [
  ["icp4", 16],
  ["icp5", 32],
  ["ic11", 32],
];

describe("Icon set check: every icon each platform needs exists at its size", () => {
  const cases = Object.entries(REQUIRED).flatMap(([platform, files]) =>
    files.map(([file, size]) => ({ platform, file, size })),
  );

  it.each(cases)("$platform: $file", ({ file, size }) => {
    const path = join(iconsDir, file);
    expect(existsSync(path)).toBe(true);
    if (size !== null) expect(pngSize(readFileSync(path))).toEqual([size, size]);
  });

  it("Windows: icon.ico holds the 16, 24, 32, 48, 64 and 256 px entries", () => {
    expect(icoSizes(readFileSync(join(iconsDir, "icon.ico")))).toEqual([16, 24, 32, 48, 64, 256]);
  });

  it.each(ICNS_SMALL)("macOS: icon.icns holds %s as a %i px PNG", (type, size) => {
    const entry = icnsEntries(readFileSync(join(iconsDir, "icon.icns"))).get(type);
    expect(entry).toBeDefined();
    expect(pngSize(entry!)).toEqual([size, size]);
  });
});
