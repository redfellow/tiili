export type Platform = "macos" | "windows" | "linux";
export type ClipboardAction = "copy" | "paste" | "selectAll";

/** The parts of a keyboard event the clipboard mapping reads. */
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
