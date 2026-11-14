import type { Direction } from "./layout/model";

export type Platform = "macos" | "windows" | "linux";
export type ClipboardAction = "copy" | "paste" | "selectAll";
/** A layout shortcut: move the focused pane one place, or reset the grid to even sizes. */
export type LayoutAction = { move: Direction } | "reset";
/**
 * A pane shortcut: open a new pane, close the focused one, focus pane `index` (0-based), or open a new window.
 * `heynote` opens (or focuses) the Heynote pane and has no shortcut of its own.
 */
export type PaneAction =
  | { type: "new" }
  | { type: "heynote" }
  | { type: "close" }
  | { type: "focus"; index: number }
  | { type: "newWindow" };
/** A zoom shortcut: the focused pane's text one step larger, smaller, or back to the Settings size. */
export type ZoomAction = "in" | "out" | "reset";

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
 * macOS: ⌘C, ⌘V, ⌘A. Windows and Linux: Ctrl+Shift+C and Ctrl+Shift+V; plain Ctrl+C stays an interrupt.
 */
export function clipboardAction(event: KeyChord, platform: Platform): ClipboardAction | null {
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey || event.shiftKey) return null;
    if (key === "c") return "copy";
    if (key === "v") return "paste";
    if (key === "a") return "selectAll";
    return null;
  }
  if (!event.ctrlKey || !event.shiftKey || event.metaKey) return null;
  if (key === "c") return "copy";
  if (key === "v") return "paste";
  return null;
}

/**
 * Which pane action a key press asks for, or null when the key belongs to the shell.
 * macOS: ⌘T new, ⌘W close, ⌘1–⌘9 focus, ⌘N new window. Windows and Linux: Ctrl+Shift+T new, Ctrl+Shift+W close,
 * Alt+1–Alt+9 focus, Ctrl+Shift+N new window; plain Ctrl+T, Ctrl+W, Ctrl+N and Ctrl+1 stay with the shell.
 */
export function paneAction(event: KeyChord, platform: Platform): PaneAction | null {
  const key = event.key.toLowerCase();
  const digit = /^[1-9]$/.test(key) ? Number(key) - 1 : null;
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    if (key === "t") return { type: "new" };
    if (key === "w") return { type: "close" };
    if (key === "n") return { type: "newWindow" };
    return digit === null ? null : { type: "focus", index: digit };
  }
  if (event.metaKey) return null;
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

/** The platform the webview runs on. */
export function currentPlatform(userAgent: string = navigator.userAgent): Platform {
  if (/Mac/.test(userAgent)) return "macos";
  if (/Windows/.test(userAgent)) return "windows";
  return "linux";
}
