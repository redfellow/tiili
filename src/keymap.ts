export type Platform = "macos" | "windows" | "linux";
export type ClipboardAction = "copy" | "paste" | "selectAll";
/** A pane shortcut: open a new pane, close the focused one, or focus pane `index` (0-based). */
export type PaneAction = { type: "new" } | { type: "close" } | { type: "focus"; index: number };

/** The parts of a keyboard event the shortcut mappings read. */
export interface KeyChord {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
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
 * macOS: ⌘T new, ⌘W close, ⌘1–⌘9 focus. Windows and Linux: Ctrl+Shift+T new, Ctrl+Shift+W close,
 * Alt+1–Alt+9 focus; plain Ctrl+T, Ctrl+W and Ctrl+1 stay with the shell.
 */
export function paneAction(event: KeyChord, platform: Platform): PaneAction | null {
  const key = event.key.toLowerCase();
  const digit = /^[1-9]$/.test(key) ? Number(key) - 1 : null;
  if (platform === "macos") {
    if (!event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    if (key === "t") return { type: "new" };
    if (key === "w") return { type: "close" };
    return digit === null ? null : { type: "focus", index: digit };
  }
  if (event.metaKey) return null;
  if (event.ctrlKey && event.shiftKey && !event.altKey) {
    if (key === "t") return { type: "new" };
    if (key === "w") return { type: "close" };
    return null;
  }
  if (event.altKey && !event.ctrlKey && !event.shiftKey && digit !== null) {
    return { type: "focus", index: digit };
  }
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
