// Builds tiili's installers for the host platform with Tauri's bundler. Run with `npm run bundle`.
//
// - macOS: a .dmg for Apple Silicon. Intel Macs are not supported.
// - Windows: NSIS setup .exe.
// - Linux: .AppImage and .deb.
//
// Builds are unsigned unless the signing environment variables in docs/packaging.md are set. Without
// TAURI_SIGNING_PRIVATE_KEY the updater bundles are left out, so the installers still build.
// Extra arguments are passed on to `tauri build`.
//
// Cargo runs with --no-default-features, which leaves out the dev-only dev-bridge binary: Tauri's bundler puts every
// binary of the package into the installers.
//
// The argument builder is exported for scripts/bundle.test.ts; the build runs only when this file is run directly.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARGS_BY_PLATFORM = {
  // "app" as well: the updater bundle (.app.tar.gz + .sig) is made only from the app target, not the .dmg.
  darwin: ["--target", "aarch64-apple-darwin", "--bundles", "app,dmg"],
  win32: ["--bundles", "nsis"],
  linux: ["--bundles", "appimage,deb"],
};

/** The extra arguments with --no-default-features added for cargo, after a `--` they may already hold. */
function withCargoArgs(extra) {
  return extra.includes("--") ? [...extra, "--no-default-features"] : [...extra, "--", "--no-default-features"];
}

/** Turns off the updater bundles, which `tauri build` can't sign without the updater key. */
const NO_UPDATER_ARTIFACTS = ["--config", JSON.stringify({ bundle: { createUpdaterArtifacts: false } })];

/**
 * The `tauri build` arguments for `platform` (a `process.platform`), with `extra` passed on and `env` deciding
 * whether updater bundles are made; `undefined` when tiili has no installers for the platform.
 */
export function bundleArgs(platform, extra, env) {
  const platformArgs = ARGS_BY_PLATFORM[platform];
  if (!platformArgs) return undefined;
  const updater = env.TAURI_SIGNING_PRIVATE_KEY ? [] : NO_UPDATER_ARTIFACTS;
  return ["tauri", "build", ...platformArgs, ...updater, ...withCargoArgs(extra)];
}

function main() {
  const args = bundleArgs(process.platform, process.argv.slice(2), process.env);
  if (!args) {
    console.error(`npm run bundle: no installers are defined for platform "${process.platform}".`);
    process.exit(1);
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
    console.warn("npm run bundle: TAURI_SIGNING_PRIVATE_KEY is not set, so the updater bundles are left out.");
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
