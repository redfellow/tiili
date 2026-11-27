import type { Direction } from "./layout/model";

export type Platform = "macos" | "windows" | "linux";
export type ClipboardAction = "copy" | "paste" | "selectAll";
/** A layout shortcut: move the focused pane one place, or reset the grid to even sizes. */
export type LayoutAction = { move: Direction } | "reset";
/**
 * A pane shortcut: open a new pane, close the focused one, focus pane `index` (0-based), open a new window, or move
 * the focused pane to a new window. `heynote` opens (or focuses) the Heynote pane and has no shortcut of its own.
 */
export type PaneAction =
  | { type: "new" }
  | { type: "heynote" }
  | { type: "close" }
  | { type: "focus"; index: number }
  | { type: "newWindow" }
  | { type: "moveToNewWindow" };
/** A zoom shortcut: the focused pane's text one step larger, smaller, or back to the Settings size. */
export type ZoomAction = "in" | "out" | "reset";
/**
 * A tab shortcut: open a new tab beside the shown one, show the next or previous tab (wrapping), or move the focused
 * pane to the next or previous tab.
 */
export type TabAction = "new" | "next" | "previous" | "moveNext" | "movePrevious";
/** A find shortcut: open the focused pane's find bar, or go to the next or previous match. */
export type FindAction = "find" | "next" | "previous";

/** The Edit menu items' payloads on the clipboard event, as find actions; the other payloads are clipboard actions. */
export const FIND_MENU_ITEMS: Readonly<Record<string, FindAction>> = {
  find: "find",
  findNext: "next",
  findPrevious: "previous",
};

/** The parts of a keyboard event the shortcut mappings read. */
export interface KeyChord {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  /** The physical key, e.g. "Digit0"; read where Shift or Alt can change `key`. */
  code?: string;
}

/**
 * Which clipboard action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌘C, ⌘V, ⌘A. Windows and Linux: Ctrl+Shift+C and Ctrl+Shift+V; plain Ctrl+C stays an interrupt. With
 * `ctrlVPastes` (the Ctrl+V pastes setting), plain Ctrl+V pastes too on Windows and Linux instead of reaching the shell.
 */
export function clipboardAction(event: KeyChord, platform: Platform, ctrlVPastes = false): ClipboardAction | null {
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey || event.shiftKey) return null;
    if (key === "c") return "copy";
    if (key === "v") return "paste";
    if (key === "a") return "selectAll";
    return null;
  }
  if (!event.ctrlKey || event.metaKey) return null;
  if (!event.shiftKey) return ctrlVPastes && key === "v" ? "paste" : null;
  if (key === "c") return "copy";
  if (key === "v") return "paste";
  return null;
}

/**
 * Which pane action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌘T new, ⌘W close, ⌘1–⌘9 focus, ⌘N new window, ⌃⌘N move to new window. Windows and Linux: Ctrl+Shift+T
 * new, Ctrl+Shift+W close, Alt+1–Alt+9 focus, Ctrl+Shift+N new window, Ctrl+Alt+Shift+N move to new window; plain
 * Ctrl+T, Ctrl+W, Ctrl+N and Ctrl+1 stay with the shell.
 */
export function paneAction(event: KeyChord, platform: Platform): PaneAction | null {
  const key = event.key.toLowerCase();
  const digit = /^[1-9]$/.test(key) ? Number(key) - 1 : null;
  if (platform === "macos") {
    if (event.metaKey && event.ctrlKey && !event.shiftKey && !event.altKey && key === "n") {
      return { type: "moveToNewWindow" };
    }
    if (!event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    if (key === "t") return { type: "new" };
    if (key === "w") return { type: "close" };
    if (key === "n") return { type: "newWindow" };
    return digit === null ? null : { type: "focus", index: digit };
  }
  if (event.metaKey) return null;
  if (event.ctrlKey && event.shiftKey && event.altKey && key === "n") return { type: "moveToNewWindow" };
  if (event.ctrlKey && event.shiftKey && !event.altKey) {
    if (key === "t") return { type: "new" };
    if (key === "w") return { type: "close" };
    if (key === "n") return { type: "newWindow" };
    return null;
  }
  if (event.altKey && !event.ctrlKey && !event.shiftKey && digit !== null) {
    return { type: "focus", index: digit };
  }
  return null;
}

const ARROWS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/**
 * Which layout action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌃⌘+arrow moves the focused pane, ⌃⌘0 resets the grid. Windows and Linux: Ctrl+Alt+Shift+arrow and
 * Ctrl+Alt+Shift+0, clear of readline's Ctrl+arrows, Ctrl+Shift+arrow selection, Snap and workspace keys.
 */
export function layoutAction(event: KeyChord, platform: Platform): LayoutAction | null {
  const chord =
    platform === "macos"
      ? event.ctrlKey && event.metaKey && !event.altKey && !event.shiftKey
      : event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey;
  if (!chord) return null;
  const dir = ARROWS[event.key];
  if (dir) return { move: dir };
  // With Shift held, the 0 key reads as ")" or "=" depending on the keyboard layout.
  if (event.key === "0" || event.code === "Digit0") return "reset";
  return null;
}

/**
 * Which zoom action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌘= or ⌘+ in, ⌘− out, ⌘0 reset. Windows and Linux: Ctrl+= or Ctrl++ in, Ctrl+− out, Ctrl+0 reset, numpad
 * keys too. Shift is allowed where it is needed to type `+`; Alt and ⌃⌘ belong to other shortcuts.
 */
export function zoomAction(event: KeyChord, platform: Platform): ZoomAction | null {
  if (event.altKey) return null;
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey) return null;
  } else if (!event.ctrlKey || event.metaKey) {
    return null;
  }
  const { key, code } = event;
  if (key === "=" || key === "+" || code === "Equal" || code === "NumpadAdd") return "in";
  if (platform === "macos" && event.shiftKey) return null;
  if (key === "-" || code === "Minus" || code === "NumpadSubtract") return "out";
  if (key === "0" || code === "Digit0" || code === "Numpad0") return "reset";
  return null;
}

/** Whether a key press opens the settings: ⌘, on macOS, Ctrl+, on Windows and Linux. Null when it belongs to the shell. */
export function settingsShortcut(event: KeyChord, platform: Platform): "settings" | null {
  if (event.key !== "," || event.altKey || event.shiftKey) return null;
  if (platform === "macos") return event.metaKey && !event.ctrlKey ? "settings" : null;
  return event.ctrlKey && !event.metaKey ? "settings" : null;
}

/**
 * Whether a key press focuses the oldest pane that needs you: ⌘J on macOS, Ctrl+Shift+J on Windows and Linux.
 * Null when it belongs to the shell.
 */
export function attentionShortcut(event: KeyChord, platform: Platform): "next" | null {
  const isJ = event.key.toLowerCase() === "j" || event.code === "KeyJ";
  if (!isJ || event.altKey) return null;
  if (platform === "macos") return event.metaKey && !event.ctrlKey && !event.shiftKey ? "next" : null;
  return event.ctrlKey && event.shiftKey && !event.metaKey ? "next" : null;
}

/**
 * Whether a key press toggles Zen mode: ⇧⌘Enter on macOS, Ctrl+Shift+Enter on Windows and Linux. Null when it
 * belongs to the shell.
 */
export function zenAction(event: KeyChord, platform: Platform): "zen" | null {
  if (event.key !== "Enter" || !event.shiftKey || event.altKey) return null;
  if (platform === "macos") return event.metaKey && !event.ctrlKey ? "zen" : null;
  return event.ctrlKey && !event.metaKey ? "zen" : null;
}

/**
 * Whether a key press minimizes the focused pane: ⇧⌘M on macOS, Ctrl+Shift+M on Windows and Linux. Null when it
 * belongs to the shell. ⌘M without Shift stays macOS's window minimize, and plain Ctrl+M stays the shell's Enter.
 */
export function minimizeAction(event: KeyChord, platform: Platform): "minimize" | null {
  const isM = event.key.toLowerCase() === "m" || event.code === "KeyM";
  if (!isM || !event.shiftKey || event.altKey) return null;
  if (platform === "macos") return event.metaKey && !event.ctrlKey ? "minimize" : null;
  return event.ctrlKey && !event.metaKey ? "minimize" : null;
}

/**
 * Which find action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌘F find, ⌘G next, ⇧⌘G previous. Windows and Linux: Ctrl+Shift+F find, F3 next, Shift+F3 previous; plain
 * Ctrl+F stays with the shell.
 */
export function findAction(event: KeyChord, platform: Platform): FindAction | null {
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey) return null;
    if (key === "f" && !event.shiftKey) return "find";
    if (key === "g") return event.shiftKey ? "previous" : "next";
    return null;
  }
  if (event.metaKey) return null;
  if (event.ctrlKey) return event.shiftKey && (key === "f" || event.code === "KeyF") ? "find" : null;
  if (event.key === "F3") return event.shiftKey ? "previous" : "next";
  return null;
}

/**
 * Which tab action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⇧⌘T new, ⇧⌘] / ⇧⌘[ and Ctrl+Tab / Ctrl+Shift+Tab next and previous, ⌃⇧⌘] / ⌃⇧⌘[ move the pane. Windows
 * and Linux: Ctrl+Alt+Shift+T new, Ctrl+PageDown / Ctrl+PageUp next and previous, Ctrl+Shift+PageDown /
 * Ctrl+Shift+PageUp move the pane. The brackets are read by `code`, since Shift turns them into braces.
 */
export function tabAction(event: KeyChord, platform: Platform): TabAction | null {
  const key = event.key.toLowerCase();
  if (platform === "macos") {
    if (event.altKey) return null;
    const bracket = event.code === "BracketRight" ? 1 : event.code === "BracketLeft" ? -1 : 0;
    if (event.metaKey && event.shiftKey) {
      if (!event.ctrlKey && (key === "t" || event.code === "KeyT")) return "new";
      if (bracket === 0) return null;
      if (event.ctrlKey) return bracket > 0 ? "moveNext" : "movePrevious";
      return bracket > 0 ? "next" : "previous";
    }
    if (event.ctrlKey && !event.metaKey && event.key === "Tab") return event.shiftKey ? "previous" : "next";
    return null;
  }
  if (event.metaKey || !event.ctrlKey) return null;
  if (event.altKey) return event.shiftKey && (key === "t" || event.code === "KeyT") ? "new" : null;
  const page = event.key === "PageDown" ? 1 : event.key === "PageUp" ? -1 : 0;
  if (page === 0) return null;
  if (event.shiftKey) return page > 0 ? "moveNext" : "movePrevious";
  return page > 0 ? "next" : "previous";
}

const LINE_EDIT_META: Readonly<Record<string, string>> = { ArrowLeft: "\x01", ArrowRight: "\x05", Backspace: "\x15" };
const LINE_EDIT_ALT: Readonly<Record<string, string>> = { ArrowLeft: "\x1bb", ArrowRight: "\x1bf", Backspace: "\x17" };

/**
 * The bytes a line-editing key sends to the shell instead of xterm's own sequence, or null when the key passes
 * through. macOS only: ⌘← `^A`, ⌘→ `^E`, ⌘⌫ `^U`, ⌥← `ESC b`, ⌥→ `ESC f`, ⌥⌫ `^W`. Exactly one of ⌘ or ⌥ is
 * held, with no Ctrl or Shift, so ⌃⌘arrows (the layout keys) and Shift selection are untouched.
 */
export function lineEditInput(event: KeyChord, platform: Platform): string | null {
  if (platform !== "macos" || event.ctrlKey || event.shiftKey || event.metaKey === event.altKey) return null;
  return (event.metaKey ? LINE_EDIT_META : LINE_EDIT_ALT)[event.key] ?? null;
}

/** The platform the webview runs on. */
export function currentPlatform(userAgent: string = navigator.userAgent): Platform {
  if (/Mac/.test(userAgent)) return "macos";
  if (/Windows/.test(userAgent)) return "windows";
  return "linux";
}
