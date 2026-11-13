// Cuts a tiili release. Run with `npm run release <patch|minor|major>`.
//
// Refuses a missing or unknown kind and a working tree with uncommitted changes. Otherwise it bumps the version in
// package.json, package-lock.json, src-tauri/Cargo.toml and src-tauri/Cargo.lock, commits `Release vX.Y.Z`, tags
// `vX.Y.Z` and pushes the commit and tag. src-tauri/tauri.conf.json takes its version from package.json
// ("../package.json") and is left as it is; it is rewritten only if it holds a literal version.
// The tag starts .github/workflows/release.yml, which builds the installers into a draft GitHub Release.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KINDS = ["patch", "minor", "major"];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function bumpVersion(version, kind) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`"${version}" is not a plain x.y.z version.`);
  const [major, minor, patch] = match.slice(1).map(Number);
  switch (kind) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown release kind "${kind}": use one of ${KINDS.join(", ")}.`);
  }
}

// Rewrites the first "version" key of a JSON file when it holds a literal x.y.z version, keeping the formatting.
// A reference such as tauri.conf.json's "../package.json" is left untouched.
export function setJsonVersion(text, version) {
  return text.replace(/("version"\s*:\s*")(\d+\.\d+\.\d+)(")/, `$1${version}$3`);
}

// Rewrites only the `version` line of Cargo.toml's [package] table; dependency `version =` entries stay.
export function setCargoVersion(text, version) {
  const lines = text.split("\n");
  let table = "";
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(lines[i]);
    if (header) {
      table = header[1].trim();
      continue;
    }
    if (table === "package" && /^\s*version\s*=/.test(lines[i])) {
      lines[i] = lines[i].replace(/=\s*"[^"]*"/, `= "${version}"`);
      return lines.join("\n");
    }
  }
  throw new Error("Cargo.toml has no [package] version line.");
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function run(root, command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

function rewrite(path, change) {
  writeFileSync(path, change(readFileSync(path, "utf8")));
}

function main() {
  const kind = process.argv[2];
  if (!KINDS.includes(kind)) {
    throw new Error(`give the release kind: npm run release <${KINDS.join("|")}>.`);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (git(root, ["status", "--porcelain"]).trim() !== "") {
    throw new Error("the working tree has uncommitted changes; commit or discard them first.");
  }

  const packageJson = join(root, "package.json");
  const current = JSON.parse(readFileSync(packageJson, "utf8")).version;
  const version = bumpVersion(current, kind);
  const tag = `v${version}`;

  rewrite(packageJson, (text) => setJsonVersion(text, version));
  rewrite(join(root, "src-tauri", "tauri.conf.json"), (text) => setJsonVersion(text, version));
  rewrite(join(root, "src-tauri", "Cargo.toml"), (text) => setCargoVersion(text, version));
  run(root, "npm", ["install", "--package-lock-only", "--no-audit", "--no-fund"]);
  const files = ["package.json", "package-lock.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"];
  if (existsSync(join(root, "src-tauri", "Cargo.lock"))) {
    run(root, "cargo", ["update", "-p", "tiili", "--manifest-path", "src-tauri/Cargo.toml"]);
    files.push("src-tauri/Cargo.lock");
  }

  git(root, ["add", "--", ...files]);
  git(root, ["commit", "-m", `Release ${tag}`]);
  // Annotated, because --follow-tags sends only annotated tags along with the commit.
  git(root, ["tag", "-a", tag, "-m", `Release ${tag}`]);
  run(root, "git", ["push", "--follow-tags"]);
  console.log(`Released ${tag}: CI builds the installers into a draft GitHub Release.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`npm run release: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
