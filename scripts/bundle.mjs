// Builds tiili's installers for the host platform with Tauri's bundler. Run with `npm run bundle`.
//
// - macOS: one universal .dmg (Apple Silicon + Intel). Needs the rustup targets aarch64-apple-darwin and
//   x86_64-apple-darwin.
// - Windows: NSIS setup .exe.
// - Linux: .AppImage and .deb.
//
// Builds are unsigned unless the signing environment variables in docs/packaging.md are set.
// Extra arguments are passed on to `tauri build`.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARGS_BY_PLATFORM = {
  darwin: ["--target", "universal-apple-darwin", "--bundles", "dmg"],
  win32: ["--bundles", "nsis"],
  linux: ["--bundles", "appimage,deb"],
};

const platformArgs = ARGS_BY_PLATFORM[process.platform];
if (!platformArgs) {
  console.error(`npm run bundle: no installers are defined for platform "${process.platform}".`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("npx", ["tauri", "build", ...platformArgs, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
