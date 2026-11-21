#!/usr/bin/env node
// Follows an agent transcript (JSONL) as it grows and draws it as a readable log, for a tiili pane opened beside the
// agent that spawned it. Understands Oh My Pi session files and Claude Code transcripts. Read-only: it never writes
// to the transcript.
//
//   node follow.mjs FILE [--title TEXT] [--pid PID] [--done MARKER]
//
// It waits for FILE to appear (agents write it lazily), then prints each entry as it lands. It stops following when
// the transcript says the session ended (Oh My Pi's `session_exit` entry), when MARKER exists, or when process PID is
// gone, and then waits for a key so the pane stays open to read: tiili closes a pane when its command exits.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POLL_MS = 250;
const RESULT_LINES = 3;
const THINKING_LINES = 4;

const sgr = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = sgr("1");
const dim = sgr("2");
const italicDim = sgr("2;3");
const cyan = sgr("36");
const red = sgr("31");
const green = sgr("32");

function parseArgs(argv) {
  const out = { file: undefined, title: undefined, pid: undefined, done: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--title") out.title = argv[++i];
    else if (arg === "--pid") out.pid = Number(argv[++i]);
    else if (arg === "--done") out.done = argv[++i];
    else if (arg.startsWith("--")) fail(`unknown option ${arg}`);
    else if (out.file === undefined) out.file = arg;
    else fail(`unexpected argument ${arg}`);
  }
  if (!out.file) fail("usage: follow.mjs FILE [--title TEXT] [--pid PID] [--done MARKER]");
  return out;
}

function fail(message) {
  process.stderr.write(`follow: ${message}\n`);
  process.exit(2);
}

/** Text with terminal control sequences removed, so a transcript cannot drive the terminal. Keeps newlines and tabs. */
export function clean(text) {
  /* eslint-disable no-control-regex -- matching control characters is the point */
  return String(text)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
  /* eslint-enable no-control-regex */
}

function firstLines(text, count) {
  const lines = clean(text).replace(/\s+$/, "").split("\n");
  const shown = lines.slice(0, count);
  const more = lines.length - shown.length;
  return { shown, more };
}

function oneLine(text, max = 160) {
  const flat = clean(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A short description of a tool call's arguments: its stated intent, else its most telling argument. */
export function summarizeArgs(args, intent) {
  if (intent) return oneLine(intent);
  if (!args || typeof args !== "object") return args === undefined ? "" : oneLine(JSON.stringify(args));
  if (typeof args.i === "string") return oneLine(args.i);
  for (const key of ["description", "command", "file_path", "path", "pattern", "url", "query", "prompt"]) {
    if (typeof args[key] === "string" && args[key]) return oneLine(args[key]);
  }
  return oneLine(JSON.stringify(args));
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (typeof block === "string" ? block : block?.type === "text" ? block.text ?? "" : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * The events one transcript line holds, in a shape shared by both formats:
 * `{kind: "user"|"text"|"thinking"|"tool"|"result"|"note"|"end", ...}`. Lines that are bookkeeping give none.
 */
export function eventsOf(entry) {
  if (!entry || typeof entry !== "object") return [];

  // Oh My Pi: `{type: "message", message: {role, content}}`, `{type: "session_exit"}`, `{type: "compaction"}`.
  // omp 18.21 writes the exit record as `{type: "custom", customType: "session_exit", data: {reason}}`.
  if (entry.type === "custom" && entry.customType === "session_exit") return [{ kind: "end", reason: entry.data?.reason }];
  if (entry.type === "session_exit") return [{ kind: "end", reason: entry.reason }];
  if (entry.type === "compaction") return [{ kind: "note", text: "context compacted" }];
  if (entry.type === "message" && entry.message) {
    const { role, content } = entry.message;
    if (role === "user") return [{ kind: "user", text: contentText(content) }];
    if (role === "assistant") return assistantBlocks(content);
    if (role === "toolResult") {
      return [{ kind: "result", text: contentText(content), error: Boolean(entry.message.isError) }];
    }
    return [];
  }

  // Claude Code: `{type: "user"|"assistant", message: {role, content}}`; other types are request bookkeeping.
  if ((entry.type === "user" || entry.type === "assistant") && entry.message) {
    const { content } = entry.message;
    if (entry.type === "assistant") return assistantBlocks(content);
    if (typeof content === "string") return [{ kind: "user", text: content }];
    const results = (content ?? []).filter((block) => block?.type === "tool_result");
    if (results.length > 0) {
      return results.map((block) => ({
        kind: "result",
        text: contentText(block.content),
        error: Boolean(block.is_error),
      }));
    }
    const text = contentText(content);
    return text ? [{ kind: "user", text }] : [];
  }
  return [];
}

function assistantBlocks(content) {
  if (typeof content === "string") return content ? [{ kind: "text", text: content }] : [];
  const events = [];
  for (const block of content ?? []) {
    if (block?.type === "text" && block.text) events.push({ kind: "text", text: block.text });
    else if (block?.type === "thinking" && block.thinking) events.push({ kind: "thinking", text: block.thinking });
    else if (block?.type === "toolCall") {
      events.push({ kind: "tool", name: block.name, summary: summarizeArgs(block.arguments, block.intent) });
    } else if (block?.type === "tool_use") {
      events.push({ kind: "tool", name: block.name, summary: summarizeArgs(block.input) });
    }
  }
  return events;
}

/** The lines to print for one event. */
export function render(event, state) {
  switch (event.kind) {
    case "user": {
      const header = state.sawTask ? bold("› message") : bold("› task");
      state.sawTask = true;
      return [header, clean(event.text).trimEnd(), ""];
    }
    case "text":
      return [clean(event.text).trimEnd(), ""];
    case "thinking": {
      const { shown, more } = firstLines(event.text, THINKING_LINES);
      return [...shown.map(italicDim), ...(more > 0 ? [italicDim(`… ${more} more`)] : []), ""];
    }
    case "tool":
      return [`${cyan("●")} ${bold(clean(event.name ?? "tool"))} ${dim(event.summary)}`];
    case "result": {
      const { shown, more } = firstLines(event.text, RESULT_LINES);
      const paint = event.error ? red : dim;
      const lines = shown.filter((line) => line.length > 0).map((line, i) => paint(`${i === 0 ? "  ⎿ " : "    "}${line}`));
      if (lines.length === 0) lines.push(paint(event.error ? "  ⎿ (error)" : "  ⎿ (no output)"));
      if (more > 0) lines.push(dim(`    … ${more} more lines`));
      return [...lines, ""];
    }
    case "note":
      return [dim(`— ${event.text} —`), ""];
    default:
      return [];
  }
}

function alive(pid) {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function waitForKey(message) {
  if (!process.stdin.isTTY) {
    // Nobody to press a key: exit once the line is written (a piped stdout is asynchronous).
    process.stdout.write(`\n${message}\n`, () => process.exit(0));
    return;
  }
  process.stdout.write(`\n${message}\n`);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(0));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  // The pane closed under us (or output is piped into `head`): nothing left to draw on.
  process.stdout.on("error", () => process.exit(0));
  const title = opts.title ?? path.basename(opts.file, ".jsonl");
  process.stdout.write(`${bold(clean(title))}\n${dim(clean(opts.file))}\n\n`);

  if (process.stdin.isTTY) {
    // Ctrl-C closes the pane at any time; other keys are ignored until the session ends.
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (key) => {
      if (key.includes(0x03) || key.includes(0x04)) process.exit(0);
    });
  }

  const state = { sawTask: false };
  let offset = 0;
  let partial = "";
  let waitingShown = false;
  let finished = false;

  const finish = (message) => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    process.stdin.removeAllListeners("data");
    waitForKey(message);
  };

  const drain = () => {
    let stat;
    try {
      stat = fs.statSync(opts.file);
    } catch {
      if (!waitingShown) {
        process.stdout.write(dim("waiting for the agent's first turn…\n\n"));
        waitingShown = true;
      }
      return;
    }
    if (stat.size < offset) {
      // The file was rewritten (compaction, garbage collection): start over.
      offset = 0;
      partial = "";
    }
    if (stat.size === offset) return;
    const fd = fs.openSync(opts.file, "r");
    try {
      const buffer = Buffer.alloc(stat.size - offset);
      fs.readSync(fd, buffer, 0, buffer.length, offset);
      offset = stat.size;
      partial += buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
    const lines = partial.split("\n");
    partial = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      for (const event of eventsOf(entry)) {
        if (event.kind === "end") {
          finish(green("— finished —") + dim("  press any key to close"));
          return;
        }
        const out = render(event, state);
        if (out.length > 0) process.stdout.write(`${out.join("\n")}\n`);
      }
    }
  };

  const tick = () => {
    if (finished) return;
    drain();
    if (finished) return;
    if (opts.done && fs.existsSync(opts.done)) {
      drain();
      finish(green("— finished —") + dim("  press any key to close"));
    } else if (!alive(opts.pid)) {
      drain();
      finish(dim("— the agent's process is gone —  press any key to close"));
    }
  };

  const timer = setInterval(tick, POLL_MS);
  tick();
}

const invoked = process.argv[1] && fs.existsSync(process.argv[1]) ? fs.realpathSync(process.argv[1]) : undefined;
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
