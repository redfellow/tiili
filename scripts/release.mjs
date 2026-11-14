// Releases what is on main now, in one command: `npm run release <patch|minor|major|x.y.z>`.
//
// No commit is made. The version is the highest vX.Y.Z tag on GitHub bumped by the argument (or the version given),
// and the release workflow stamps it into package.json, Cargo.toml and Cargo.lock from the tag before it builds
// (scripts/stamp-version.mjs). So the command never commits, never switches this checkout's branch, never touches
// hv/main and does not need a pull:
//
//   1. Tag origin/main's commit vX.Y.Z and push only the tag. That starts .github/workflows/release.yml, which builds
//      the installers into a draft GitHub Release.
//   2. Follow that workflow with a live view of each platform's build, then publish the draft as the latest release.
//      The website and the README badge read the latest release from GitHub, so they follow on their own.
//
// It runs origin/main's copy of itself when this one differs, so a checkout that is behind releases with the current
// flow. Each step checks whether it is already done: running the same command again after a stop or a failure carries
// on where it left off, and an unpublished release is finished before a new one is cut.
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const KINDS = ["patch", "minor", "major"];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const MAIN = "main";
const WORKFLOW = "release.yml";
const LATEST_ENV = "TIILI_RELEASE_LATEST";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

// Rewrites the version of Cargo.lock's own `tiili` package entry; other packages stay.
export function setCargoLockVersion(text, version) {
  const next = text.replace(/(\[\[package\]\]\nname = "tiili"\nversion = ")[^"]*(")/, `$1${version}$2`);
  if (next === text && !text.includes(`name = "tiili"\nversion = "${version}"`)) {
    throw new Error('Cargo.lock has no [[package]] entry for "tiili".');
  }
  return next;
}

/** 0:42, 7:26 or 1:02:05 for a number of milliseconds. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const PLATFORM = { macos: "macOS", windows: "Windows", ubuntu: "Linux" };

/** One line of the build view for a workflow job from `gh run view --json jobs`; `frame` is the spinner frame. */
export function describeJob(job, frame) {
  const os = /\((\w+)-/.exec(job.name)?.[1];
  const name = (PLATFORM[os] ?? job.name).padEnd(8);
  if (job.status === "completed") {
    const took = job.startedAt && job.completedAt ? `  ${formatDuration(Date.parse(job.completedAt) - Date.parse(job.startedAt))}` : "";
    if (job.conclusion === "success") return `✓ ${name}done${took}`;
    if (job.conclusion === "skipped") return `– ${name}skipped`;
    return `✗ ${name}${job.conclusion ?? "failed"}${took}`;
  }
  if (job.status !== "in_progress") return `· ${name}waiting for a runner`;
  const steps = job.steps ?? [];
  const current = steps.find((s) => s.status === "in_progress") ?? steps.find((s) => s.status !== "completed");
  const done = steps.filter((s) => s.status === "completed").length;
  const label = current ? current.name.replace(/^Run /, "") : "starting";
  return `${frame} ${name}${label}  (step ${Math.min(done + 1, steps.length || 1)}/${steps.length || "?"})`;
}

// --- side effects -------------------------------------------------------------------------------------------------

let rootDir;
// The repository the command runs in (npm runs scripts from the package root), not the script's folder: the script
// may be a fresh copy from origin/main in a temporary folder.
function root() {
  rootDir ??= execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  return rootDir;
}

const execFileAsync = promisify(execFile);

function out(command, args) {
  return execFileSync(command, args, { cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryOut(command, args) {
  try {
    return out(command, args);
  } catch {
    return undefined;
  }
}

async function outAsync(command, args) {
  return (await execFileAsync(command, args, { cwd: root(), encoding: "utf8" })).stdout.trim();
}

function run(command, args) {
  execFileSync(command, args, { cwd: root(), stdio: "inherit", shell: process.platform === "win32" });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function step(text) {
  console.log(`\n▸ ${text}`);
}

/**
 * A block of status lines redrawn in place on a terminal, with a spinner frame ticking every 100 ms. Off a terminal
 * (a log file, CI) it prints each line only when its text changes.
 */
function liveView(render) {
  const tty = process.stdout.isTTY;
  let frame = 0;
  let drawn = 0;
  let printed = [];
  const draw = () => {
    const lines = render(SPINNER[frame % SPINNER.length]);
    if (tty) {
      let text = drawn ? `\x1b[${drawn}A` : "";
      for (const line of lines) text += `\r\x1b[2K  ${line}\n`;
      process.stdout.write(text);
      drawn = lines.length;
    } else {
      // Compared without the spinner and the clock, so a line prints again only when its text really changes.
      const shown = lines.map((line) => line.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "…"));
      const plain = shown.map((line) => line.replace(/\d+:\d\d(:\d\d)?/g, ""));
      plain.forEach((line, i) => {
        if (line !== printed[i]) console.log(`  ${shown[i]}`);
      });
      printed = plain;
    }
    frame++;
  };
  draw();
  const timer = tty ? setInterval(draw, 100) : setInterval(draw, 5000);
  return {
    stop() {
      clearInterval(timer);
      draw();
    },
  };
}

function fetchOrigin() {
  out("git", ["fetch", "--quiet", "--tags", "--force", "origin", MAIN]);
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

/**
 * Runs origin/main's copy of this script instead of this one when they differ, so a checkout that is behind still
 * releases with the newest flow and never needs a pull first. True when the newer copy ran.
 */
function runLatest() {
  if (process.env[LATEST_ENV]) return false;
  const latest = tryOut("git", ["show", `origin/${MAIN}:scripts/release.mjs`]);
  if (!latest || latest === readFileSync(fileURLToPath(import.meta.url), "utf8").trim()) return false;
  const dir = mkdtempSync(join(tmpdir(), "tiili-release-script-"));
  const script = join(dir, "release.mjs");
  writeFileSync(script, `${latest}\n`);
  console.log(`Using the newest release script from origin/${MAIN}.`);
  try {
    execFileSync(process.execPath, [script, ...process.argv.slice(2)], {
      cwd: root(),
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

function tagMain(version, latest) {
  const tag = `v${version}`;
  if (remoteTags().includes(tag)) {
    console.log(`  ${tag} is already on origin`);
    return;
  }
  if (!tryOut("git", ["cat-file", "-e", `origin/${MAIN}:scripts/stamp-version.mjs`])) {
    throw new Error(
      `${MAIN}'s release workflow does not stamp the version from the tag yet; press Release on the board once to bring this flow to ${MAIN}.`,
    );
  }
  const commit = out("git", ["rev-parse", `origin/${MAIN}`]);
  if (latest !== "0.0.0") {
    const since = out("git", ["log", "--oneline", "--no-merges", `v${latest}..${commit}`]);
    if (!since) throw new Error(`nothing is new on ${MAIN} since v${latest}.`);
    const lines = since.split("\n");
    console.log(`  ${lines.length} commit${lines.length === 1 ? "" : "s"} since v${latest}:`);
    for (const line of lines.slice(0, 15)) console.log(`    ${line}`);
    if (lines.length > 15) console.log(`    … and ${lines.length - 15} more`);
  }
  // Only a tag is made and pushed; the checkout's branch and HEAD stay as they are.
  if (!tryOut("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`])) {
    out("git", ["tag", "-a", tag, commit, "-m", `Release ${tag}`]);
  }
  out("git", ["push", "--quiet", "origin", `refs/tags/${tag}`]);
  console.log(`  pushed ${tag} at ${commit.slice(0, 7)}`);
}

/** How long the last successful release workflow took, for the estimate; undefined when there is none. */
function lastDuration() {
  const json = tryOut("gh", [
    "run", "list", "--workflow", WORKFLOW, "--status", "success", "--limit", "1", "--json", "startedAt,updatedAt",
  ]);
  const last = json ? JSON.parse(json)[0] : undefined;
  return last ? Date.parse(last.updatedAt) - Date.parse(last.startedAt) : undefined;
}

async function followBuild(tag) {
  const estimate = lastDuration();
  const startedWaiting = Date.now();
  let runId;
  let state = { status: "queued", jobs: [] };
  const view = liveView((frame) => {
    const started = state.startedAt ? Date.parse(state.startedAt) : startedWaiting;
    const elapsed = formatDuration(Date.now() - started);
    const of = estimate ? ` of about ${formatDuration(estimate)}` : "";
    if (!runId) return [`${frame} waiting for GitHub to start the release workflow  ${elapsed}`];
    const jobs = state.jobs.filter((job) => job.name !== "draft" || job.status !== "completed" || job.conclusion !== "success");
    return [`${frame} building ${tag}  ${elapsed}${of}`, ...jobs.map((job) => `  ${describeJob(job, frame)}`)];
  });
  try {
    for (;;) {
      if (!runId) {
        const id = await outAsync("gh", [
          "run", "list", "--workflow", WORKFLOW, "--branch", tag, "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId",
        ]).catch(() => "");
        if (id) runId = id;
      }
      if (runId) {
        const json = await outAsync("gh", ["run", "view", runId, "--json", "status,conclusion,startedAt,jobs,url"]).catch(() => "");
        if (json) state = JSON.parse(json);
        if (state.status === "completed") break;
      }
      await sleep(5000);
    }
  } finally {
    view.stop();
  }
  if (state.conclusion !== "success") {
    const failed = state.jobs.filter((job) => job.conclusion && !["success", "skipped"].includes(job.conclusion));
    throw new Error(
      `the release workflow ended ${state.conclusion}${failed.length ? ` in ${failed.map((job) => job.name).join(", ")}` : ""}.\n` +
        `  See ${state.url} or run: gh run view ${runId} --log-failed`,
    );
  }
}

async function buildAndPublish(version) {
  const tag = `v${version}`;
  if (releaseState(tag)?.isDraft !== false) await followBuild(tag);
  run("gh", ["release", "edit", tag, "--draft=false", "--latest"]);
  console.log(`\nReleased ${tag}: ${releaseState(tag)?.url ?? ""}`);
  console.log("The website and the README badge pick it up as the latest release.");
}

let started = false;

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
    console.log(`Releasing v${version} from ${MAIN} (latest is v${latest}).`);
    step(`Tag ${MAIN} v${version}`);
    tagMain(version, latest);
  }
  step("Build the installers");
  await buildAndPublish(version);
}

// realpath on both sides: on macOS the temporary folder is reached through the /var -> /private/var link.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`\nnpm run release: ${error instanceof Error ? error.message : error}`);
    if (started) console.error("Run the same command again to carry on from where it stopped.");
    process.exit(1);
  });
}
