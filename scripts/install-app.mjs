// Builds tiili.app for this Mac's chip, installs it in /Applications and pins it to the Dock. Run with
// `npm run install-app` (macOS only). See docs/packaging.md.
//
// The steps are pure helpers, exported for scripts/install-app.test.ts; `main` runs them in order.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "tiili.app";
export const APP_IDENTIFIER = "app.tiili";
export const INSTALL_PATH = `/Applications/${APP_NAME}`;

/** Arguments for `tauri build`: the host architecture only, the .app only (no .dmg, no universal binary). */
export function buildArgs() {
  return ["tauri", "build", "--bundles", "app"];
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
