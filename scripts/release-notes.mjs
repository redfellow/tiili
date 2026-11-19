// Writes a release's notes as Markdown: `node scripts/release-notes.mjs <vX.Y.Z> [previous-tag]`.
//
// Every change reaches main through a härvääjä promotion pull request ("Promote hv/main to main"), so GitHub's
// generated notes only list those titles. This reads the promotions merged since the previous tag instead. Each one
// opens with plain-language update notes, which become "What's new", and then lists the pull requests it carries,
// which become the collapsed "All changes". The release workflow runs it for the draft; it needs `git` with the tags
// fetched and `gh` signed in.
//
// `npm run release` can also have Claude write "What's new" (`claudePrompt`, `parseClaudeNotes`): from the full
// descriptions of the pull requests the promotions carry, ordered by impact and worded for users. The collapsed list
// and the changelog link stay as built here.
import { execFile, execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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
 * `{ promotion: { number, body } }` or `{ subject }` for a commit that did not come through a promotion. `whatsNew`,
 * when given, replaces the promotions' update notes as the "What's new" items.
 */
export function buildNotes({ entries, compareUrl, whatsNew }) {
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
  const news = whatsNew?.length ? whatsNew : unique(notes);
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

const execFileAsync = promisify(execFile);

async function outAsync(command, args) {
  return (await execFileAsync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
}

/** The pull request numbers of change lines that end in "(#N)", in order, without repeats. */
export function pullNumbers(changes) {
  const numbers = changes.map((change) => /\(#(\d+)\)\s*$/.exec(change)?.[1]).filter(Boolean);
  return [...new Set(numbers)];
}

const BRIEF_LIMIT = 2500;
// Sections of a härvääjä pull request body that describe the change; the rest (tasks, review, checks) is evidence.
const BRIEF_SECTIONS = /^##\s+(why|what changes?|outcome)\s*$/i;

/**
 * What Claude reads about one pull request: its title and the Why / What changes / Outcome sections of its body.
 * A fast-lane body has none, so its commit messages stand in. Cut to a few thousand characters.
 */
export function pullRequestBrief({ number, title, body = "", commits = [] }) {
  const kept = [];
  let keep = false;
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    if (/^##\s/.test(line)) keep = BRIEF_SECTIONS.test(line.trim());
    if (keep) kept.push(line);
  }
  let text = kept.join("\n").trim();
  if (!text) {
    text = commits
      .map((commit) =>
        [commit.messageHeadline, commit.messageBody]
          .filter(Boolean)
          .join("\n")
          .split("\n")
          .filter((line) => !/^Co-Authored-By:/i.test(line.trim()))
          .join("\n")
          .trim(),
      )
      .filter(Boolean)
      .join("\n\n");
  }
  if (text.length > BRIEF_LIMIT) text = `${text.slice(0, BRIEF_LIMIT).trimEnd()}…`;
  return `### #${number} ${title}\n\n${text || "(no description)"}`;
}

const STYLE_EXAMPLE = [
  "- **New window from the Dock or taskbar.** Open a fresh tiili window on the desktop you're on, without hunting for an existing one first. On macOS, right-click the Dock icon and choose New Window. On Windows, use New Window in the taskbar jump list.",
  "- **Security fix: Heynote notes can no longer run commands.** A math result that looked like HTML used to be rendered as markup, so a crafted, pasted note could reach your shell. Results are now always shown as plain text.",
  "- **Close a pane right where it is.** Every pane has its own × next to the Zen button, shown while you hover over the pane. ⌘W / Ctrl+Shift+W work as before.",
];

/**
 * The prompt for Claude: the rules for "What's new", a style example, the short update notes written when each
 * change merged (as hints) and the brief of every pull request in the release.
 */
export function claudePrompt({ briefs, hints = [] }) {
  return [
    'You write the "What\'s new" list of a GitHub release of tiili, a cross-platform tiling terminal app. Its readers are tiili\'s users around the world. The first six items also show in the app\'s What\'s new panel after an update.',
    "",
    "Write it from the pull requests below, which are every change in this release. Rules:",
    "- One bullet per change a user notices. Merge pull requests that make up one feature into one bullet. Leave out what users never see (internal tooling, tests, lists of ideas, routine README upkeep), but keep docs that help users, such as install instructions.",
    "- Order the bullets from the biggest and best change for users to the least impactful. Security fixes come right after the headline features.",
    "- Each bullet is `- **Short headline.** One to three plain sentences on what changed for the user and how to use it.` Address the reader as \"you\".",
    "- Be accurate: say only what the pull requests say. Where it works differently per platform, say how. Do not invent numbers, shortcuts or settings. A pull request's description beats its title and the update notes when they disagree.",
    '- Plain English for an international audience: no in-jokes, codenames or Finnish words (such as "koivu"), and no names of internal tools, cards, OpenSpec changes or pull request numbers.',
    "- Output only the bullets, one per line: no heading, intro, closing text or code fences.",
    "",
    "The style to follow:",
    ...STYLE_EXAMPLE,
    "",
    ...(hints.length
      ? ["Short update notes written when each change merged (hints only; they can be wrong):", ...hints.map((hint) => `- ${hint}`), ""]
      : []),
    "The pull requests:",
    "",
    briefs.join("\n\n"),
    "",
  ].join("\n");
}

/**
 * The "What's new" items from Claude's reply: its `- ` bullets without the marker, a wrapped line joined to its
 * bullet. Anything before the first bullet (an intro, a fence) is dropped. Throws when there is no bullet.
 */
export function parseClaudeNotes(text) {
  const items = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) items.push(bullet[1].trim());
    else if (!line || /^```/.test(line) || /^#/.test(line)) continue;
    else if (items.length) items[items.length - 1] += ` ${line}`;
  }
  if (!items.length) throw new Error("Claude's reply had no bullet list.");
  return items;
}

/** Main's first-parent commits in `range` (for example "v1.1.1..origin/main") as `buildNotes` entries. */
export async function mainEntries(range) {
  const subjects = (await outAsync("git", ["log", "--first-parent", "--format=%s", range])).split("\n").filter(Boolean);
  return Promise.all(
    subjects.map(async (subject) => {
      const number = promotionNumber(subject);
      if (!number) return { subject };
      const body = await outAsync("gh", ["pr", "view", number, "--json", "body", "--jq", ".body"]);
      return { promotion: { number, body } };
    }),
  );
}

/** The prompt for Claude about `entries`: it reads each carried pull request with `gh`. */
export async function claudePromptFor(entries) {
  const hints = [];
  const changes = [];
  for (const entry of entries) {
    if (!entry.promotion) continue;
    const parsed = parsePromotion(entry.promotion.body ?? "");
    hints.push(...parsed.notes);
    changes.push(...parsed.changes);
  }
  const briefs = await Promise.all(
    pullNumbers(changes).map(async (number) =>
      pullRequestBrief(JSON.parse(await outAsync("gh", ["pr", "view", number, "--json", "number,title,body,commits"]))),
    ),
  );
  for (const entry of entries) if (entry.subject) briefs.push(`### ${entry.subject}\n\n(a commit made straight on main)`);
  return claudePrompt({ briefs, hints: [...new Set(hints)] });
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

async function main() {
  const tag = process.argv[2];
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) throw new Error(`give the release tag, vX.Y.Z, not "${tag ?? ""}".`);
  const previous = process.argv[3] ?? previousTag(tag);
  const entries = await mainEntries(previous ? `${previous}..${tag}` : tag);
  const repo = process.env.GITHUB_REPOSITORY ?? out("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const compareUrl = previous ? `https://github.com/${repo}/compare/${previous}...${tag}` : undefined;
  process.stdout.write(buildNotes({ entries, compareUrl }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`release-notes: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
