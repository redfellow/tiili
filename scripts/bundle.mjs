// Builds tiili's installers for the host platform with Tauri's bundler. Run with `npm run bundle`.
//
// - macOS: a .dmg for Apple Silicon. Intel Macs are not supported. Tauri's bundler always makes a zlib .dmg, so it is
//   converted to lzma (ULMO) afterwards and, when APPLE_SIGNING_IDENTITY is set, signed again (see dmgPostSteps).
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
// The argument and step builders are exported for scripts/bundle.test.ts; the build runs only when this file is run
// directly.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

/**
 * The commands that run on the built `dmgPath` (macOS): `steps` convert it to lzma (ULMO) in `scratch.dir` and put it
 * back in place, then sign it again when `env.APPLE_SIGNING_IDENTITY` is set, since converting drops the signature.
 * Tauri deletes the keychain it imported `env.APPLE_CERTIFICATE` into once its build ends, so with a certificate the
 * steps import it again, from `scratch.dir`/certificate.p12, into a keychain of their own in `scratch.dir`, locked with
 * `scratch.password`; `cleanup` deletes that keychain and runs even when a step fails.
 */
export function dmgPostSteps(env, dmgPath, scratch) {
  const converted = join(scratch.dir, "converted.dmg");
  const steps = [
    ["hdiutil", ["convert", dmgPath, "-format", "ULMO", "-ov", "-o", converted]],
    ["mv", ["-f", converted, dmgPath]],
  ];
  const identity = env.APPLE_SIGNING_IDENTITY;
  if (!identity) return { steps, cleanup: [] };
  if (!env.APPLE_CERTIFICATE) {
    steps.push(["codesign", ["--force", "--sign", identity, dmgPath]]);
    return { steps, cleanup: [] };
  }
  const keychain = join(scratch.dir, "signing.keychain-db");
  steps.push(
    ["security", ["create-keychain", "-p", scratch.password, keychain]],
    ["security", ["unlock-keychain", "-p", scratch.password, keychain]],
    ["security", ["import", join(scratch.dir, "certificate.p12"), "-k", keychain, "-P",
      env.APPLE_CERTIFICATE_PASSWORD ?? "", "-T", "/usr/bin/codesign"]],
    ["security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", scratch.password, keychain]],
    ["codesign", ["--force", "--sign", identity, "--keychain", keychain, dmgPath]],
  );
  return { steps, cleanup: [["security", ["delete-keychain", keychain]]] };
}

/** The .dmg files the build that started at `since` (ms) made, in Tauri's output folder. */
function builtDmgs(root, env, since) {
  const dir = join(env.CARGO_TARGET_DIR ? resolve(root, env.CARGO_TARGET_DIR) : join(root, "src-tauri", "target"),
    "aarch64-apple-darwin", "release", "bundle", "dmg");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".dmg"))
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).mtimeMs >= since);
}

/** Runs `cmd` with `args`; false, after saying why, when it could not start or failed. */
function runStep([cmd, args]) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  return !result.error && result.status === 0;
}

/** Converts and re-signs every .dmg the build made (dmgPostSteps); false when a step failed. */
function finishDmgs(root, env, since) {
  const dmgs = builtDmgs(root, env, since);
  if (dmgs.length === 0) {
    console.error("npm run bundle: the build made no .dmg to compress.");
    return false;
  }
  for (const dmg of dmgs) {
    const scratch = { dir: mkdtempSync(join(tmpdir(), "tiili-dmg-")), password: randomBytes(24).toString("hex") };
    const { steps, cleanup } = dmgPostSteps(env, dmg, scratch);
    try {
      if (env.APPLE_SIGNING_IDENTITY && env.APPLE_CERTIFICATE) {
        writeFileSync(join(scratch.dir, "certificate.p12"), Buffer.from(env.APPLE_CERTIFICATE, "base64"), { mode: 0o600 });
      }
      if (!steps.every(runStep)) {
        console.error(`npm run bundle: compressing ${dmg} failed.`);
        return false;
      }
    } finally {
      cleanup.forEach(runStep);
      rmSync(scratch.dir, { recursive: true, force: true });
    }
  }
  return true;
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
  const started = Date.now();
  // Node runs tauri's CLI directly, without npx or a shell: a shell on Windows would strip the quotes of the
  // --config JSON. args[0] is "tauri", which the CLI's script path replaces.
  const result = spawnSync(process.execPath, [resolve(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args.slice(1)], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (process.platform === "darwin" && !finishDmgs(root, process.env, started)) process.exit(1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
