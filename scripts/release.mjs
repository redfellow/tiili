// Cuts a tiili release in one command: `npm run release <patch|minor|major|x.y.z>`.
//
// It never commits in this checkout, never switches its branch and never pushes to main: main only receives
// promotions from härvääjä's integration branch (hv/main), so the release goes the same way as every other change.
//
//   1. Bump: in a throwaway worktree of origin/hv/main, set the version in package.json, package-lock.json,
//      src-tauri/Cargo.toml and src-tauri/Cargo.lock, commit `Release vX.Y.Z` on release/vX.Y.Z and send it through
//      `hv fast-lane`. Waits until hv/main has the new version.
//   2. Release: promote hv/main to main (the board's Release, merging by itself once its checks pass). This also
//      carries everything else waiting on hv/main. Waits until main has the new version.
//   3. Tag: tag main's commit vX.Y.Z and push only the tag. That starts .github/workflows/release.yml, which builds
//      the installers into a draft GitHub Release.
//   4. Publish: wait for that workflow, then publish the draft as the latest release. The website and the README badge
//      read the latest release from GitHub, so they follow on their own.
//
// It first runs origin/hv/main's copy of itself when this one differs, so a checkout that is behind needs no pull.
// Each step checks whether it is already done, so running the same command again after a stop or a failure carries on
// where it left off. With no argument it only finishes a release whose tag exists but whose draft is not published.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const KINDS = ["patch", "minor", "major"];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const POLL_MS = 15_000;
let started = false;
const INTEGRATION = "hv/main";
const MAIN = "main";

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
      throw new Error(`Unknown release kind "${kind}": use one of ${KINDS.join(", ")} or an x.y.z version.`);
  }
}

/** Negative when a < b, positive when a > b, for plain x.y.z versions. */
export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** The highest x.y.z among `vX.Y.Z` tag names, or "0.0.0" when there is none. */
export function highestTag(tags) {
  return tags
    .map((tag) => /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1])
    .filter(Boolean)
    .reduce((best, version) => (compareVersions(version, best) > 0 ? version : best), "0.0.0");
}

/**
 * Which version this run works on. `latest` is the highest tagged version and `latestPublished` whether its GitHub
 * Release is published. An unfinished latest release is finished first, whatever was asked for.
 */
export function pickTarget(arg, latest, latestPublished) {
  if (latest !== "0.0.0" && !latestPublished) return { version: latest, resume: true };
  if (arg === undefined) return { version: undefined, resume: false };
  if (SEMVER.test(arg)) {
    if (compareVersions(arg, latest) <= 0) throw new Error(`${arg} is not newer than the latest release v${latest}.`);
    return { version: arg, resume: false };
  }
  return { version: bumpVersion(latest, arg), resume: false };
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

// --- side effects -------------------------------------------------------------------------------------------------

// The repository the command runs in (npm runs scripts from the package root), not the script's folder: the script
// may be a fresh copy from origin/hv/main in a temporary folder.
const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SELF = fileURLToPath(import.meta.url);
const LATEST_ENV = "TIILI_RELEASE_LATEST";

function out(command, args, cwd = ROOT) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function run(command, args, cwd = ROOT) {
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

function tryOut(command, args, cwd = ROOT) {
  try {
    return out(command, args, cwd);
  } catch {
    return undefined;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function step(text) {
  console.log(`\n▸ ${text}`);
}

function fetchOrigin() {
  out("git", ["fetch", "--quiet", "--tags", "origin", MAIN, INTEGRATION]);
}

function versionOn(branch) {
  return JSON.parse(out("git", ["show", `origin/${branch}:package.json`])).version;
}

function remoteTags() {
  return out("git", ["ls-remote", "--tags", "--refs", "origin", "v*"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("refs/tags/")[1]);
}

function releaseState(tag) {
  const json = tryOut("gh", ["release", "view", tag, "--json", "isDraft,url"]);
  return json ? JSON.parse(json) : undefined;
}

/** Polls `done` until it returns true, printing `status()` whenever it changes. */
function waitFor(what, done, status = () => undefined) {
  let last;
  for (;;) {
    fetchOrigin();
    if (done()) return;
    const now = status() ?? `waiting for ${what}`;
    if (now !== last) console.log(`  ${now}`);
    last = now;
    sleep(POLL_MS);
  }
}

function cardStatus(branch) {
  const line = tryOut("hv", ["card", branch])?.split("\n")[0];
  if (!line) return undefined;
  const parts = line.split(" · ");
  const waiting = parts.find((part) => part.startsWith("waiting on "));
  return `fast-lane card ${parts[1]}${waiting ? `, ${waiting}` : ""}`;
}

function bump(version) {
  const tag = `v${version}`;
  const branch = `release/${tag}`;
  if (compareVersions(versionOn(INTEGRATION), version) >= 0) {
    console.log(`  ${INTEGRATION} already has ${versionOn(INTEGRATION)}`);
    return;
  }
  if (cardStatus(branch) === undefined) {
    const dir = mkdtempSync(join(tmpdir(), "tiili-release-"));
    const tree = join(dir, "tree");
    out("git", ["worktree", "add", "--quiet", "--no-track", "-b", branch, tree, `origin/${INTEGRATION}`]);
    try {
      const edit = (file, change) => writeFileSync(join(tree, file), change(readFileSync(join(tree, file), "utf8")));
      edit("package.json", (text) => setJsonVersion(text, version));
      edit("src-tauri/tauri.conf.json", (text) => setJsonVersion(text, version));
      edit("src-tauri/Cargo.toml", (text) => setCargoVersion(text, version));
      run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], tree);
      if (existsSync(join(tree, "src-tauri", "Cargo.lock"))) {
        run("cargo", ["update", "--quiet", "-p", "tiili", "--manifest-path", "src-tauri/Cargo.toml"], tree);
      }
      out("git", ["commit", "--quiet", "--all", "-m", `Release ${tag}`], tree);
      run("hv", ["fast-lane", branch, "--title", `Release ${tag}`], tree);
    } finally {
      out("git", ["worktree", "remove", "--force", tree]);
      tryOut("git", ["branch", "-D", branch]);
      rmSync(dir, { recursive: true, force: true });
    }
  }
  waitFor(
    `${branch} to merge into ${INTEGRATION}`,
    () => versionOn(INTEGRATION) === version,
    () => cardStatus(branch),
  );
}

function hvApi() {
  const home = process.env.HV_HOME ?? join(homedir(), "Library", "Application Support", "harvaaja");
  const configFile = join(home, "config.json");
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
  const token = readFileSync(join(home, "owner.credential"), "utf8").trim();
  const base = `http://127.0.0.1:${config.port ?? 7317}/api/v2`;
  return async (name, input) => {
    const response = await fetch(`${base}/commands/${name}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-harvaaja-client": "tiili-release",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`hv ${name}: ${body?.error?.message ?? response.status}`);
    return body;
  };
}

async function promote(version) {
  if (versionOn(MAIN) === version) {
    console.log(`  ${MAIN} already has ${version}`);
    return;
  }
  const ahead = out("git", ["log", "--oneline", "--no-merges", `origin/${MAIN}..origin/${INTEGRATION}`]);
  console.log(`  ${INTEGRATION} carries along:\n${ahead.replace(/^/gm, "    ")}`);
  const workspaceId = JSON.parse(out("hv", ["here", "--json"])).workspace.id;
  await hvApi()("promote", { workspaceId, merge: "auto" });
  waitFor(
    `the promotion pull request to merge into ${MAIN}`,
    () => versionOn(MAIN) === version,
    () => {
      const pr = tryOut("gh", [
        "pr", "list", "--base", MAIN, "--search", "Promote hv/main to main in:title",
        "--json", "url", "--jq", ".[0].url",
      ]);
      return pr ? `waiting for ${pr} to merge (it merges by itself once its checks pass)` : undefined;
    },
  );
}

function tagMain(version) {
  const tag = `v${version}`;
  if (remoteTags().includes(tag)) {
    console.log(`  ${tag} is already on origin`);
    return;
  }
  if (versionOn(MAIN) !== version) throw new Error(`${MAIN} has ${versionOn(MAIN)}, not ${version}; not tagging.`);
  const commit = out("git", ["rev-parse", `origin/${MAIN}`]);
  // Only a tag is made and pushed; the checkout's branch and HEAD stay as they are.
  if (!tryOut("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`])) {
    out("git", ["tag", "-a", tag, commit, "-m", `Release ${tag}`]);
  }
  out("git", ["push", "--quiet", "origin", `refs/tags/${tag}`]);
  console.log(`  pushed ${tag} at ${commit.slice(0, 7)}`);
}

function buildAndPublish(version) {
  const tag = `v${version}`;
  let runId;
  waitFor(`the release workflow for ${tag} to start`, () => {
    runId = tryOut("gh", [
      "run", "list", "--workflow", "release.yml", "--branch", tag, "--limit", "1",
      "--json", "databaseId", "--jq", ".[0].databaseId",
    ]);
    return Boolean(runId);
  });
  run("gh", ["run", "watch", runId, "--exit-status", "--interval", "30"]);
  run("gh", ["release", "edit", tag, "--draft=false", "--latest"]);
  console.log(`\nReleased ${tag}: ${releaseState(tag)?.url ?? ""}`);
  console.log("The website and the README badge pick it up as the latest release.");
}

/**
 * Runs origin/hv/main's copy of this script instead of this one when they differ, so a checkout that is behind still
 * releases with the newest flow and never needs a pull first. True when the newer copy ran.
 */
function runLatest() {
  if (process.env[LATEST_ENV]) return false;
  const latest = tryOut("git", ["show", `origin/${INTEGRATION}:scripts/release.mjs`]);
  if (!latest || latest === readFileSync(SELF, "utf8").trim()) return false;
  const dir = mkdtempSync(join(tmpdir(), "tiili-release-script-"));
  const script = join(dir, "release.mjs");
  writeFileSync(script, `${latest}\n`);
  console.log(`Using the newest release script from origin/${INTEGRATION}.`);
  try {
    execFileSync(process.execPath, [script, ...process.argv.slice(2)], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, [LATEST_ENV]: "1" },
    });
  } catch (error) {
    process.exitCode = typeof error?.status === "number" ? error.status : 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

async function main() {
  const arg = process.argv[2];
  if (arg !== undefined && !KINDS.includes(arg) && !SEMVER.test(arg)) {
    throw new Error(`give the release kind or version: npm run release <${KINDS.join("|")}|x.y.z>.`);
  }
  fetchOrigin();
  if (runLatest()) return;
  const latest = highestTag(remoteTags());
  const latestPublished = latest === "0.0.0" || releaseState(`v${latest}`)?.isDraft === false;
  const { version, resume } = pickTarget(arg, latest, latestPublished);
  if (!version) {
    console.log(`v${latest} is released. To cut the next one: npm run release <${KINDS.join("|")}|x.y.z>.`);
    return;
  }
  started = true;
  if (resume) {
    console.log(`v${version} is tagged but not published yet: finishing it first.`);
  } else {
    const integration = versionOn(INTEGRATION);
    if (compareVersions(integration, latest) > 0 && integration !== version) {
      throw new Error(
        `${INTEGRATION} already has ${integration}, not ${version}; release that one with: npm run release ${integration}`,
      );
    }
    console.log(`Releasing v${version} (latest is v${latest}).`);
    step(`Bump the version on ${INTEGRATION} through the fast lane`);
    bump(version);
    step(`Release: promote ${INTEGRATION} to ${MAIN}`);
    await promote(version);
    step(`Tag ${MAIN} v${version}`);
    tagMain(version);
  }
  step("Build the installers and publish the release");
  buildAndPublish(version);
}

// realpath on both sides: on macOS the temporary folder is reached through the /var -> /private/var link.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(SELF)) {
  main().catch((error) => {
    console.error(`\nnpm run release: ${error instanceof Error ? error.message : error}`);
    if (started) console.error("Run the same command again to carry on from where it stopped.");
    process.exit(1);
  });
}
