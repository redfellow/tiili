// tiili's appearance-aware macOS app icon: an Icon Composer bundle (src-tauri/icons/AppIcon.icon) with a light
// and a dark appearance, compiled by Apple's `actool` into src-tauri/icons/Assets.car. Tauri's bundler copies
// Assets.car into the app and sets CFBundleIconName, so Finder and the Dock show the icon that matches the OS
// appearance even while tiili is not running. icon.icns stays in the bundle as the fallback for older macOS.
//
// `npm run icons` writes the .icon bundle and, when Xcode 26 or later is installed, compiles it. Without Xcode,
// compile it with the app-icon workflow (.github/workflows/app-icon.yml) and commit the Assets.car it uploads.
// Running this file directly compiles the committed .icon bundle into Assets.car.
//
// The pure helpers are exported for scripts/icons.test.ts.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Name of the icon in the asset catalog, which Tauri writes to CFBundleIconName. */
export const ICON_NAME = "AppIcon";

/** The background rectangle of the brand icon SVGs: the tile, with its colour. */
const TILE_RECT = /<rect width="100" height="100" rx="22\.5" fill="(#[0-9A-Fa-f]{6})"\/>/;

/** The rounded clip of the brand icon SVGs; macOS applies its own icon shape instead. */
const TILE_CLIP = '<clipPath id="tile"><rect width="100" height="100" rx="22.5"/></clipPath>';

/**
 * Splits a brand icon SVG into the Icon Composer fill and layer: the tile colour, and the artwork on a
 * transparent, square canvas (the system masks it to the icon shape).
 */
export function splitIcon(svg) {
  const tile = svg.match(TILE_RECT);
  if (!tile || !svg.includes(TILE_CLIP)) throw new Error("The icon SVG has no tile rectangle to split off.");
  const layer = svg
    .replace(TILE_RECT, "")
    .replace(TILE_CLIP, '<clipPath id="tile"><rect width="100" height="100"/></clipPath>');
  return { tile: tile[1], layer };
}

/** A #RRGGBB colour as an Icon Composer solid colour. */
export function srgb(hex) {
  const channels = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5));
  return `srgb:${channels.join(",")},1.00000`;
}

/**
 * The icon.json of the Icon Composer bundle: the tile colour as the fill and the artwork as one flat layer, each
 * with a dark specialisation. Glass, shadow and translucency are off so the icon keeps the brand look.
 */
export function iconJson(light, dark) {
  return {
    fill: { solid: srgb(light.tile) },
    "fill-specializations": [{ appearance: "dark", value: { solid: srgb(dark.tile) } }],
    groups: [
      {
        layers: [
          {
            glass: false,
            "image-name-specializations": [{ value: "light.png" }, { appearance: "dark", value: "dark.png" }],
            name: "Bricks",
          },
        ],
        name: "Bricks",
        shadow: { kind: "none", opacity: 0.5 },
        specular: false,
        translucency: { enabled: false, value: 0.5 },
      },
    ],
    "supported-platforms": { squares: ["macOS"] },
  };
}

/** `actool` arguments that compile the .icon bundle at `iconPath` into `outDir`. */
export function actoolArgs(iconPath, outDir) {
  return [
    "actool",
    iconPath,
    "--compile",
    outDir,
    "--output-format",
    "human-readable-text",
    "--notices",
    "--warnings",
    "--output-partial-info-plist",
    join(outDir, "partial.plist"),
    "--app-icon",
    ICON_NAME,
    "--enable-on-demand-resources",
    "NO",
    "--development-region",
    "en",
    "--target-device",
    "mac",
    // Below macOS 26 the catalog also carries the pre-rendered icon images older systems show.
    "--minimum-deployment-target",
    "11.0",
    "--platform",
    "macosx",
  ];
}

/** The major version of Xcode's actool, or undefined when it is not installed. */
export function actoolMajor() {
  const result = spawnSync("xcrun", ["actool", "--version", "--output-format", "human-readable-text"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  const version = result.stdout.match(/short-bundle-version:\s*(\d+)/);
  return version ? Number(version[1]) : undefined;
}

/** Compiles the .icon bundle at `iconPath` into the Assets.car at `carPath` with Xcode's actool. */
export function compile(iconPath, carPath) {
  const out = mkdtempSync(join(tmpdir(), "tiili-assets-"));
  try {
    execFileSync("xcrun", actoolArgs(iconPath, out), { stdio: "inherit" });
    copyFileSync(join(out, "Assets.car"), carPath);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

function main() {
  const major = actoolMajor();
  if (major === undefined || major < 26) {
    console.error("app-icon: compiling the .icon bundle needs actool from Xcode 26 or later.");
    process.exit(1);
  }
  const icons = resolve(dirname(fileURLToPath(import.meta.url)), "../src-tauri/icons");
  compile(join(icons, `${ICON_NAME}.icon`), join(icons, "Assets.car"));
  console.log("Wrote src-tauri/icons/Assets.car.");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
