// Writes a release version into the files the build reads it from: `node scripts/stamp-version.mjs <x.y.z|vX.Y.Z>`.
//
// The release workflow runs it with the pushed tag, so the installers, their file names and the app's About window
// carry the tag's version. Releases do not commit version bumps; the version in the repository is only the fallback
// for local builds. package.json is the one Vite and Tauri read (tauri.conf.json points at it); Cargo.toml and
// Cargo.lock follow so the Rust side agrees.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setCargoLockVersion, setCargoVersion, setJsonVersion } from "./release.mjs";

const SEMVER = /^v?(\d+\.\d+\.\d+)$/;

const arg = process.argv[2] ?? "";
const version = SEMVER.exec(arg)?.[1];
if (!version) {
  console.error(`stamp-version: give an x.y.z version or a vX.Y.Z tag, not "${arg}".`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const edit = (file, change) => writeFileSync(join(root, file), change(readFileSync(join(root, file), "utf8")));
edit("package.json", (text) => setJsonVersion(text, version));
edit("src-tauri/Cargo.toml", (text) => setCargoVersion(text, version));
edit("src-tauri/Cargo.lock", (text) => setCargoLockVersion(text, version));
console.log(`Stamped version ${version}.`);
