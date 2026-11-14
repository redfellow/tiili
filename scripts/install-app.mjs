// Builds tiili.app for this Mac's chip, installs it in /Applications and pins it to the Dock. Run with
// `npm run install-app` (macOS only). See docs/packaging.md.
//
// It runs `npm ci` first when node_modules does not match package-lock.json, so it also works right after a pull or
// a promotion that added or changed dependencies (härvääjä runs it after each Release).
//
// The steps are pure helpers, exported for scripts/install-app.test.ts; `main` runs them in order.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "tiili.app";
export const APP_IDENTIFIER = "app.tiili";
export const INSTALL_PATH = `/Applications/${APP_NAME}`;

/**
 * Arguments for `tauri build`: the host architecture only, the .app only (no .dmg, no universal binary), and cargo
 * without default features so the dev-only dev-bridge binary stays out of the app.
 */
export function buildArgs() {
  return ["tauri", "build", "--bundles", "app", "--", "--no-default-features"];
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
  run("npx", buildArgs(), { cwd: root });

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
