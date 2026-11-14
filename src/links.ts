import type { Platform } from "./keymap";

/** A printed path that may name a file or folder: where it sits in its line and its line and column, if any. */
export interface PathCandidate {
  /** The whole match, suffix included, as printed. */
  text: string;
  /** The path alone, without a `:line[:col]` or `(line,col)` suffix. */
  path: string;
  /** Index of the first character in the line. */
  start: number;
  /** Index just after the last character. */
  end: number;
  line?: number;
  col?: number;
}

/** Characters a path segment never holds: blanks, quotes, brackets, separators and the line suffix's colon. */
const SEGMENT = String.raw`[^\s"'\`<>|()\[\]{},;:*?\\/]`;
const PATH = new RegExp(
  String.raw`(?:[A-Za-z]:[\\/]|~[\\/]|\.\.?[\\/]|[\\/])?` +
    String.raw`${SEGMENT}+(?:[\\/]${SEGMENT}*)*` +
    String.raw`(?::(\d+)(?::(\d+))?|\((\d+)(?:,\s*(\d+))?\))?`,
  "g",
);
const LINE_SUFFIX = /(?::\d+(?::\d+)?|\(\d+(?:,\s*\d+)?\))$/;
/** A URL with an authority (`scheme://…`): its text is never a path. */
const URL_LIKE = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/\S*/g;

/** Whether `path` looks like a path rather than a word: it has a folder part, a leading `~`/`.`, or an extension. */
function looksLikePath(path: string): boolean {
  if (/[\\/]/.test(path)) return /[^\\/.~]/.test(path);
  return /^[^.]+(?:\.[^.]+)*\.[A-Za-z][\w-]*$/.test(path);
}

/**
 * Every stretch of `line` that may name a file or folder: relative (`src/a.ts`, `a.ts`), `./`, `../`, `~/`, absolute
 * and Windows drive paths, each with an optional `:line[:col]` or `(line,col)`. Text inside a `scheme://` URL is
 * left out, and a sentence's trailing full stop is not part of the path.
 */
export function findPathCandidates(line: string): PathCandidate[] {
  const urls = [...line.matchAll(URL_LIKE)].map((m) => [m.index, m.index + m[0].length] as const);
  const inUrl = (start: number, end: number) => urls.some(([from, to]) => start < to && end > from);
  const found: PathCandidate[] = [];
  for (const match of line.matchAll(PATH)) {
    const start = match.index;
    let text = match[0];
    const lineText = match[1] ?? match[3];
    const colText = match[2] ?? match[4];
    let path = text;
    if (lineText !== undefined) {
      path = text.replace(LINE_SUFFIX, "");
    } else {
      // "See src/a.ts." ends the sentence, not the path.
      const trimmed = path.replace(/\.+$/, "");
      if (trimmed !== "" && !/[\\/]$/.test(trimmed) && !/^\.+$/.test(path)) path = text = trimmed;
    }
    const end = start + text.length;
    if (!looksLikePath(path) || inUrl(start, end)) continue;
    found.push({
      text,
      path,
      start,
      end,
      ...(lineText !== undefined ? { line: Number(lineText) } : {}),
      ...(colText !== undefined ? { col: Number(colText) } : {}),
    });
  }
  return found;
}

/** The modifier keys and button of a mouse event. */
export interface ClickChord {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
}

/** Whether a click opens a link: ⌘-click on macOS, Ctrl-click on Windows and Linux; never a plain click. */
export function isOpenGesture(event: ClickChord, platform: Platform): boolean {
  if (event.button !== 0) return false;
  return platform === "macos" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** `text` cut to at most `max` characters by replacing its middle with `…`, keeping its start and end. */
export function truncateMiddle(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  if (max <= 1) return "…".slice(0, max);
  const head = Math.ceil((max - 1) / 2);
  const tail = max - 1 - head;
  return chars.slice(0, head).join("") + "…" + (tail > 0 ? chars.slice(-tail).join("") : "");
}

/** An existing file or folder a printed path names, as the core resolved it. */
export interface ResolvedPath {
  abs: string;
  isDir: boolean;
  /** An executable or launcher: it may be revealed, never opened. */
  revealOnly: boolean;
}

/** A link under the pointer: a URL or OSC 8 target, or an existing file or folder. */
export type HoveredLink =
  | { kind: "url"; uri: string; /** The printed text, when it differs from the target (OSC 8). */ label?: string }
  | { kind: "path"; abs: string; isDir: boolean; revealOnly: boolean; line?: number };

/** The platform's file manager, as its reveal item names it. */
export function revealLabel(platform: Platform): string {
  if (platform === "macos") return "Reveal in Finder";
  if (platform === "windows") return "Show in Explorer";
  return "Show in Folder";
}

/** The gesture, as the hover hint names it. */
function gesture(platform: Platform): string {
  return platform === "macos" ? "⌘-click" : "Ctrl-click";
}

/** The hint shown while `link` is hovered; an OSC 8 link's target is shown cut to `max` characters. */
export function hintText(link: HoveredLink, platform: Platform, max = 60): string {
  const click = gesture(platform);
  if (link.kind === "url") {
    return link.label !== undefined ? `${click} to open ${truncateMiddle(link.uri, max)}` : `${click} to open`;
  }
  if (link.revealOnly) {
    const label = revealLabel(platform);
    return `${click} to ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
  if (link.isDir) {
    const manager = platform === "macos" ? "Finder" : platform === "windows" ? "Explorer" : "the file manager";
    return `${click} to open in ${manager}`;
  }
  return link.line !== undefined ? `${click} to open in default app (line ignored)` : `${click} to open in default app`;
}

/** The scheme of `uri`, lower-cased, or an empty string when it has none. */
export function schemeOf(uri: string): string {
  return /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(uri)?.[1].toLowerCase() ?? "";
}

/** Whether `uri` opens without asking (`http`, `https`, `mailto`); the core enforces this too. */
export function opensDirectly(uri: string): boolean {
  return ["http", "https", "mailto"].includes(schemeOf(uri));
}

/** Whether `uri` never opens (`javascript:`, `data:`, `blob:`, `vbscript:` or no scheme); the core enforces this too. */
export function neverOpens(uri: string): boolean {
  return ["", "javascript", "vbscript", "data", "blob"].includes(schemeOf(uri));
}
