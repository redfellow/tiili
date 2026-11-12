// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  clipboardAction,
  paneAction,
  settingsShortcut,
  type ClipboardAction,
  type KeyChord,
  type PaneAction,
  type Platform,
} from "./keymap";

function chord(key: string, mods: Partial<Omit<KeyChord, "key">> = {}): KeyChord {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
}

const cases: [string, Platform, KeyChord, ClipboardAction | null][] = [
  ["macOS Edit menu: ⌘C copies", "macos", chord("c", { metaKey: true }), "copy"],
  ["macOS Edit menu: ⌘V pastes", "macos", chord("v", { metaKey: true }), "paste"],
  ["macOS Edit menu: ⌘A selects all", "macos", chord("a", { metaKey: true }), "selectAll"],
  ["macOS: Ctrl+Shift+C is not a clipboard key", "macos", chord("C", { ctrlKey: true, shiftKey: true }), null],
  ["Windows and Linux shortcuts: Ctrl+Shift+C copies on Windows", "windows", chord("C", { ctrlKey: true, shiftKey: true }), "copy"],
  ["Windows and Linux shortcuts: Ctrl+Shift+V pastes on Windows", "windows", chord("V", { ctrlKey: true, shiftKey: true }), "paste"],
  ["Windows and Linux shortcuts: Ctrl+Shift+C copies on Linux", "linux", chord("C", { ctrlKey: true, shiftKey: true }), "copy"],
  ["Windows and Linux shortcuts: Ctrl+Shift+V pastes on Linux", "linux", chord("V", { ctrlKey: true, shiftKey: true }), "paste"],
  ["Interrupt: Ctrl+C reaches the shell on macOS", "macos", chord("c", { ctrlKey: true }), null],
  ["Interrupt: Ctrl+C reaches the shell on Windows", "windows", chord("c", { ctrlKey: true }), null],
  ["Interrupt: Ctrl+C reaches the shell on Linux", "linux", chord("c", { ctrlKey: true }), null],
  ["Linux: Ctrl+V without Shift reaches the shell", "linux", chord("v", { ctrlKey: true }), null],
  ["Windows: Ctrl+Shift+A is not a clipboard key", "windows", chord("A", { ctrlKey: true, shiftKey: true }), null],
  ["Plain letters reach the shell", "linux", chord("c"), null],
];

describe("clipboardAction", () => {
  it.each(cases)("%s", (_name, platform, event, expected) => {
    expect(clipboardAction(event, platform)).toBe(expected);
  });
});

const NEW: PaneAction = { type: "new" };
const CLOSE: PaneAction = { type: "close" };
const focus = (index: number): PaneAction => ({ type: "focus", index });

const paneCases: [string, Platform, KeyChord, PaneAction | null][] = [
  ["Open and close: ⌘T opens a pane on macOS", "macos", chord("t", { metaKey: true }), NEW],
  ["Open and close: ⌘W closes the pane on macOS", "macos", chord("w", { metaKey: true }), CLOSE],
  ["Focus by number: ⌘1 focuses pane 1 on macOS", "macos", chord("1", { metaKey: true }), focus(0)],
  ["Focus by number: ⌘2 focuses pane 2 on macOS", "macos", chord("2", { metaKey: true }), focus(1)],
  ["Focus by number: ⌘9 focuses pane 9 on macOS", "macos", chord("9", { metaKey: true }), focus(8)],
  ["Open and close: Ctrl+Shift+T opens a pane on Windows", "windows", chord("T", { ctrlKey: true, shiftKey: true }), NEW],
  ["Open and close: Ctrl+Shift+W closes the pane on Windows", "windows", chord("W", { ctrlKey: true, shiftKey: true }), CLOSE],
  ["Open and close: Ctrl+Shift+T opens a pane on Linux", "linux", chord("T", { ctrlKey: true, shiftKey: true }), NEW],
  ["Open and close: Ctrl+Shift+W closes the pane on Linux", "linux", chord("W", { ctrlKey: true, shiftKey: true }), CLOSE],
  ["Focus by number: Alt+2 focuses pane 2 on Windows", "windows", chord("2", { altKey: true }), focus(1)],
  ["Focus by number: Alt+1 focuses pane 1 on Linux", "linux", chord("1", { altKey: true }), focus(0)],
  ["Focus by number: Alt+9 focuses pane 9 on Linux", "linux", chord("9", { altKey: true }), focus(8)],
  ["Ctrl+T reaches the shell on Linux", "linux", chord("t", { ctrlKey: true }), null],
  ["Ctrl+W reaches the shell on Windows", "windows", chord("w", { ctrlKey: true }), null],
  ["Ctrl+1 reaches the shell on Linux", "linux", chord("1", { ctrlKey: true }), null],
  ["Ctrl+T reaches the shell on macOS", "macos", chord("t", { ctrlKey: true }), null],
  ["Alt+0 is not a pane key", "linux", chord("0", { altKey: true }), null],
  ["⌘0 is not a pane key", "macos", chord("0", { metaKey: true }), null],
  ["macOS: Ctrl+Shift+T is not a pane key", "macos", chord("T", { ctrlKey: true, shiftKey: true }), null],
  ["macOS: Alt+1 is not a pane key", "macos", chord("1", { altKey: true }), null],
  ["macOS: ⌘⇧T is not a pane key", "macos", chord("T", { metaKey: true, shiftKey: true }), null],
  ["Windows: Meta+T is not a pane key", "windows", chord("t", { metaKey: true }), null],
  ["Linux: Meta+1 is not a pane key", "linux", chord("1", { metaKey: true }), null],
  ["Linux: Ctrl+Alt+1 is not a pane key", "linux", chord("1", { ctrlKey: true, altKey: true }), null],
  ["Windows and Linux shortcuts: Ctrl+Shift+C stays a clipboard key", "linux", chord("C", { ctrlKey: true, shiftKey: true }), null],
  ["Plain letters reach the shell", "macos", chord("t"), null],
];

describe("paneAction", () => {
  it.each(paneCases)("%s", (_name, platform, event, expected) => {
    expect(paneAction(event, platform)).toEqual(expected);
  });
});

const settingsCases: [string, Platform, KeyChord, "settings" | null][] = [
  ["Open by shortcut: ⌘, on macOS", "macos", chord(",", { metaKey: true }), "settings"],
  ["Open by shortcut: Ctrl+, on Windows", "windows", chord(",", { ctrlKey: true }), "settings"],
  ["Open by shortcut: Ctrl+, on Linux", "linux", chord(",", { ctrlKey: true }), "settings"],
  ["macOS: Ctrl+, reaches the shell", "macos", chord(",", { ctrlKey: true }), null],
  ["Windows: ⌘, (Win key) reaches the shell", "windows", chord(",", { metaKey: true }), null],
  ["Linux: Ctrl+Alt+, reaches the shell", "linux", chord(",", { ctrlKey: true, altKey: true }), null],
  ["A plain comma reaches the shell", "macos", chord(","), null],
  ["⌘C is not the settings shortcut", "macos", chord("c", { metaKey: true }), null],
];

describe("settingsShortcut", () => {
  it.each(settingsCases)("%s", (_name, platform, event, expected) => {
    expect(settingsShortcut(event, platform)).toBe(expected);
  });
});
