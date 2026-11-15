// Builds tiili.app for this Mac's chip, installs it in /Applications and pins it to the Dock. Run with
// `npm run install-app` (macOS only). See docs/packaging.md.
//
// It runs `npm ci` first when node_modules does not match package-lock.json, so it also works right after a pull or
// a promotion that added or changed dependencies (härvääjä runs it after each Release).
//
// The app gets a version from git, since releases stamp theirs only in CI and package.json's is a stale fallback: the
// tag's version on a tagged commit, and a dev version past the last tag otherwise (see buildVersion). It is written
// into package.json, Cargo.toml and Cargo.lock for the build and the files are put back afterwards.
//
// The steps are pure helpers, exported for scripts/install-app.test.ts; `main` runs them in order.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bumpVersion, setCargoLockVersion, setCargoVersion, setJsonVersion } from "./release.mjs";

export const APP_NAME = "tiili.app";
export const APP_IDENTIFIER = "app.tiili";
export const INSTALL_PATH = `/Applications/${APP_NAME}`;

/**
 * Arguments for `tauri build`: the host architecture only, the .app only (no .dmg, no universal binary), no updater
 * bundle (a local install never ships one, and `tauri build` can't sign it without the release key), and cargo
 * without default features so the dev-only dev-bridge binary stays out of the app.
 */
export function buildArgs() {
  return [
    "tauri",
    "build",
    "--bundles",
    "app",
    "--config",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
    "--",
    "--no-default-features",
  ];
}

/**
 * The version to build, from `git describe --tags --long --match "v[0-9]*"` output (undefined when there is no tag):
 * `v0.3.0-0-gd2c41ae` (on the tag) gives `0.3.0`; `v0.3.0-145-gd2c41ae` gives `0.3.1-dev.145+d2c41ae`, which sorts
 * after 0.3.0 and before any next release, so the in-app updater neither offers 0.3.0 again nor misses the next one.
 * Without a tag it is `fallback`, package.json's version.
 */
export function buildVersion(describe, fallback) {
  const match = /^v(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)$/.exec(describe?.trim() ?? "");
  if (!match) return fallback;
  const [, version, ahead, sha] = match;
  return ahead === "0" ? version : `${bumpVersion(version, "patch")}-dev.${ahead}+${sha}`;
}

/** Where `tauri build --bundles app` leaves the app, for a repository root. */
export function builtAppPath(root) {
  return resolve(root, "src-tauri/target/release/bundle/macos", APP_NAME);
}

/** Whether a `defaults read com.apple.dock persistent-apps` dump already holds tiili. */
export function isPinned(persistentApps) {
  const byIdentifier = /(^|[^\w.-])app\.tiili(?![\w.-])/.test(persistentApps);
  return byIdentifier || persistentApps.includes(INSTALL_PATH);
}

/** The plist XML of one Dock entry for tiili, for `defaults write com.apple.dock persistent-apps -array-add`. */
export function dockEntryXml() {
  return (
    "<dict><key>tile-data</key><dict><key>file-data</key><dict>" +
    `<key>_CFURLString</key><string>${INSTALL_PATH}</string>` +
    "<key>_CFURLStringType</key><integer>0</integer>" +
    "</dict></dict></dict>"
  );
}

/**
 * Whether node_modules is out of date: `installedLock` is node_modules/.package-lock.json (what npm last installed;
 * undefined when it is missing) and `lock` is package-lock.json. Optional packages are skipped, since npm leaves out
 * the ones for other platforms.
 */
export function dependenciesStale(lock, installedLock) {
  if (!installedLock) return true;
  const wanted = JSON.parse(lock).packages ?? {};
  const installed = JSON.parse(installedLock).packages ?? {};
  return Object.entries(wanted).some(
    ([path, entry]) => path !== "" && !entry.optional && installed[path]?.version !== entry.version,
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0] ?? ""} failed (exit ${result.status}).`);
}

function read(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

function quitTiili() {
  const running = spawnSync("pgrep", ["-f", `${INSTALL_PATH}/Contents/MacOS/`]).status === 0;
  if (!running) return;
  console.log("Quitting tiili...");
  spawnSync("osascript", ["-e", `tell application id "${APP_IDENTIFIER}" to quit`], { stdio: "inherit" });
  // Give it a moment to exit before the copy replaces the app.
  for (let i = 0; i < 20; i++) {
    if (spawnSync("pgrep", ["-f", `${INSTALL_PATH}/Contents/MacOS/`]).status !== 0) return;
    spawnSync("sleep", ["0.5"]);
  }
}

/**
 * Runs `build` with `version` written into the files the build reads it from, and puts their old contents back
 * afterwards, also when the build fails or is stopped with Ctrl-C.
 */
export function withVersion(root, version, build) {
  const files = [
    ["package.json", setJsonVersion],
    ["src-tauri/Cargo.toml", setCargoVersion],
    ["src-tauri/Cargo.lock", setCargoLockVersion],
  ].map(([file, stamp]) => {
    const path = resolve(root, file);
    return { path, text: readFileSync(path, "utf8"), stamp };
  });
  // Ctrl-C stops the build (same process group); ignoring it here lets the failed build reach the restore below.
  const ignore = () => {};
  process.on("SIGINT", ignore);
  try {
    for (const { path, text, stamp } of files) writeFileSync(path, stamp(text, version));
    build();
  } finally {
    for (const { path, text } of files) writeFileSync(path, text);
    process.off("SIGINT", ignore);
  }
}

function main() {
  if (process.platform !== "darwin") {
    console.error(`npm run install-app: this command runs only on macOS, not "${process.platform}".`);
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const installedLock = resolve(root, "node_modules/.package-lock.json");
  const lock = readFileSync(resolve(root, "package-lock.json"), "utf8");
  if (dependenciesStale(lock, existsSync(installedLock) ? readFileSync(installedLock, "utf8") : undefined)) {
    console.log("Dependencies changed: running npm ci...");
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: root });
  }
  const fallback = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
  const describe = spawnSync("git", ["describe", "--tags", "--long", "--match", "v[0-9]*"], { cwd: root, encoding: "utf8" });
  const version = buildVersion(describe.status === 0 ? describe.stdout : undefined, fallback);
  console.log(`Building tiili ${version}...`);
  withVersion(root, version, () => run("npx", buildArgs(), { cwd: root }));

  const built = builtAppPath(root);
  if (!existsSync(built)) throw new Error(`The build did not produce ${built}.`);

  quitTiili();
  run("rm", ["-rf", INSTALL_PATH]);
  run("ditto", [built, INSTALL_PATH]);
  console.log(`Installed ${INSTALL_PATH}.`);

  if (isPinned(read("defaults", ["read", "com.apple.dock", "persistent-apps"]))) {
    console.log("tiili is already in the Dock.");
    return;
  }
  run("defaults", ["write", "com.apple.dock", "persistent-apps", "-array-add", dockEntryXml()]);
  run("killall", ["Dock"]);
  console.log("Added tiili to the Dock.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`npm run install-app: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
