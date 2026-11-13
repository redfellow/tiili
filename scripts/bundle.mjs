// Builds tiili's installers for the host platform with Tauri's bundler. Run with `npm run bundle`.
//
// - macOS: one universal .dmg (Apple Silicon + Intel). Needs the rustup targets aarch64-apple-darwin and
//   x86_64-apple-darwin.
// - Windows: NSIS setup .exe.
// - Linux: .AppImage and .deb.
//
// Builds are unsigned unless the signing environment variables in docs/packaging.md are set.
// Extra arguments are passed on to `tauri build`.
//
// Cargo runs with --no-default-features, which leaves out the dev-only dev-bridge binary: Tauri's bundler puts every
// binary of the package into the installers.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARGS_BY_PLATFORM = {
  darwin: ["--target", "universal-apple-darwin", "--bundles", "dmg"],
  win32: ["--bundles", "nsis"],
  linux: ["--bundles", "appimage,deb"],
};

/** The extra arguments with --no-default-features added for cargo, after a `--` they may already hold. */
function withCargoArgs(extra) {
  return extra.includes("--") ? [...extra, "--no-default-features"] : [...extra, "--", "--no-default-features"];
}

const platformArgs = ARGS_BY_PLATFORM[process.platform];
if (!platformArgs) {
  console.error(`npm run bundle: no installers are defined for platform "${process.platform}".`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("npx", ["tauri", "build", ...platformArgs, ...withCargoArgs(process.argv.slice(2))], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
