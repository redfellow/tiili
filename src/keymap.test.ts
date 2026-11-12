// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { clipboardAction, settingsShortcut, type ClipboardAction, type KeyChord, type Platform } from "./keymap";

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
