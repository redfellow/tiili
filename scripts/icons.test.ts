// @harvaaja-test-tier: fast
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_NAME, iconJson, splitIcon, srgb } from "./app-icon.mjs";

const iconsDir = resolve(__dirname, "../src-tauri/icons");
const logoDir = resolve(__dirname, "../docs/brand/logo");

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
  // The Icon Composer bundle compiled into Assets.car, whose light and dark appearances the Dock shows while tiili
  // is not running (scripts/app-icon.mjs).
  "macOS appearance": [
    [`${ICON_NAME}.icon/icon.json`, null],
    [`${ICON_NAME}.icon/Assets/light.png`, 1024],
    [`${ICON_NAME}.icon/Assets/dark.png`, 1024],
    ["Assets.car", null],
  ],
  // The light and dark icons the app swaps in at run time to follow the OS appearance (src-tauri/src/app_icon.rs).
  "Run time": [
    ["app-light.png", 512],
    ["app-dark.png", 512],
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

describe("Appearance icon check: the macOS bundle icon has a light and a dark appearance", () => {
  const light = splitIcon(readFileSync(join(logoDir, "icon-light.svg"), "utf8"));
  const dark = splitIcon(readFileSync(join(logoDir, "icon-dark.svg"), "utf8"));

  it("splits the tile colours off the brand icons", () => {
    expect([light.tile, dark.tile]).toEqual(["#F6F1E9", "#182023"]);
    expect(light.layer).not.toContain('fill="#F6F1E9"');
    expect(light.layer).not.toContain('rx="22.5"');
  });

  it("writes srgb colours the way Icon Composer does", () => {
    expect(srgb("#FFFFFF")).toBe("srgb:1.00000,1.00000,1.00000,1.00000");
    expect(srgb("#182023")).toBe("srgb:0.09412,0.12549,0.13725,1.00000");
  });

  it(`${ICON_NAME}.icon/icon.json matches the brand icons`, () => {
    const committed = JSON.parse(readFileSync(join(iconsDir, `${ICON_NAME}.icon/icon.json`), "utf8"));
    expect(committed).toEqual(iconJson(light, dark));
  });

  it("Assets.car is an asset catalog", () => {
    expect(readFileSync(join(iconsDir, "Assets.car")).subarray(0, 8).toString("ascii")).toBe("BOMStore");
  });

  it.skipIf(process.platform !== "darwin")(`Assets.car holds ${ICON_NAME} in the light and the dark appearance`, () => {
    const info = spawnSync("assetutil", ["--info", join(iconsDir, "Assets.car")], { encoding: "utf8" });
    expect(info.status).toBe(0);
    const renditions: { AssetType?: string; Name?: string; Appearance?: string }[] = JSON.parse(info.stdout);
    const stacks = renditions.filter((r) => r.AssetType === "IconImageStack" && r.Name === ICON_NAME);
    expect(stacks.map((r) => r.Appearance)).toEqual(
      expect.arrayContaining(["NSAppearanceNameAqua", "NSAppearanceNameDarkAqua"]),
    );
    // Tauri takes CFBundleIconName from the first flat icon image.
    expect(renditions.find((r) => r.AssetType === "Icon Image")?.Name).toBe(ICON_NAME);
  });
});
