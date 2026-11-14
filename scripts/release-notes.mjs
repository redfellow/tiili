// Writes a release's notes as Markdown: `node scripts/release-notes.mjs <vX.Y.Z> [previous-tag]`.
//
// Every change reaches main through a härvääjä promotion pull request ("Promote hv/main to main"), so GitHub's
// generated notes only list those titles. This reads the promotions merged since the previous tag instead. Each one
// opens with plain-language update notes, which become "What's new", and then lists the pull requests it carries,
// which become the collapsed "All changes". The release workflow runs it for the draft; it needs `git` with the tags
// fetched and `gh` signed in.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROMOTES_LINE = /^Promotes what härvääjä merged/;
const CHANGES_END = /^Any merge method works/;
// Notes that only restate the version, from the days when releases committed a version bump.
const VERSION_NOTE = /^tiili is (now at|updated to) version \d+\.\d+\.\d+\.?$/i;

/** A promotion pull request body split into its update notes and the pull requests it lists. */
export function parsePromotion(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((line) => PROMOTES_LINE.test(line.trim()));
  const head = at === -1 ? [] : lines.slice(0, at);
  const tail = at === -1 ? lines : lines.slice(at + 1);
  const notes = head
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line && !VERSION_NOTE.test(line));
  const changes = [];
  for (const line of tail) {
    if (CHANGES_END.test(line.trim())) break;
    const item = /^\s*[-*]\s+(.+)$/.exec(line)?.[1]?.trim();
    if (item) changes.push(item);
  }
  return { notes, changes };
}

/** The pull request number of a "Promote hv/main to main (#N)" subject on main, or undefined. */
export function promotionNumber(subject) {
  return /^Promote .+ \(#(\d+)\)$/.exec(subject.trim())?.[1];
}

/**
 * The notes as Markdown. `entries` are main's first-parent commits since the previous tag, newest first, each either
 * `{ promotion: { number, body } }` or `{ subject }` for a commit that did not come through a promotion.
 */
export function buildNotes({ entries, compareUrl }) {
  const notes = [];
  const changes = [];
  for (const entry of entries) {
    if (entry.promotion) {
      const parsed = parsePromotion(entry.promotion.body ?? "");
      notes.push(...parsed.notes);
      changes.push(...(parsed.changes.length ? parsed.changes : [`Promotion #${entry.promotion.number}`]));
    } else if (entry.subject) {
      changes.push(entry.subject);
    }
  }
  const unique = (items) => [...new Set(items)];
  const out = [];
  const news = unique(notes);
  const all = unique(changes).filter((change) => !/^Release v\d+\.\d+\.\d+( \(#\d+\))?$/.test(change));
  if (news.length) out.push("## What's new", "", ...news.map((note) => `- ${note}`), "");
  if (all.length) {
    const list = all.map((change) => `- ${change}`);
    if (news.length) {
      out.push(`<details><summary>All changes (${all.length})</summary>`, "", ...list, "", "</details>", "");
    } else {
      out.push("## Changes", "", ...list, "");
    }
  }
  if (!out.length) out.push("No changes since the previous release.", "");
  if (compareUrl) out.push(`**Full changelog:** ${compareUrl}`);
  return `${out.join("\n").trim()}\n`;
}

function out(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** The highest vX.Y.Z tag below `tag`, or undefined for the first release. */
function previousTag(tag) {
  const key = (t) => t.slice(1).split(".").map(Number);
  const below = (a, b) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  return out("git", ["tag", "--list", "v*"])
    .split("\n")
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t) && below(t, tag))
    .sort((a, b) => (below(a, b) ? 1 : -1))[0];
}

function main() {
  const tag = process.argv[2];
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) throw new Error(`give the release tag, vX.Y.Z, not "${tag ?? ""}".`);
  const previous = process.argv[3] ?? previousTag(tag);
  const range = previous ? `${previous}..${tag}` : tag;
  const subjects = out("git", ["log", "--first-parent", "--format=%s", range]).split("\n").filter(Boolean);
  const entries = subjects.map((subject) => {
    const number = promotionNumber(subject);
    if (!number) return { subject };
    const body = out("gh", ["pr", "view", number, "--json", "body", "--jq", ".body"]);
    return { promotion: { number, body } };
  });
  const repo = process.env.GITHUB_REPOSITORY ?? out("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const compareUrl = previous ? `https://github.com/${repo}/compare/${previous}...${tag}` : undefined;
  process.stdout.write(buildNotes({ entries, compareUrl }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`release-notes: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
