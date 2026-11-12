// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  clipboardAction,
  layoutAction,
  paneAction,
  settingsShortcut,
  type ClipboardAction,
  type KeyChord,
  type LayoutAction,
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

const mac = { ctrlKey: true, metaKey: true };
const pc = { ctrlKey: true, altKey: true, shiftKey: true };

const layoutCases: [string, Platform, KeyChord, LayoutAction | null][] = [
  ["Keyboard move: ⌃⌘→ moves right on macOS", "macos", chord("ArrowRight", mac), { move: "right" }],
  ["Keyboard move: ⌃⌘← moves left on macOS", "macos", chord("ArrowLeft", mac), { move: "left" }],
  ["Keyboard move: ⌃⌘↑ moves up on macOS", "macos", chord("ArrowUp", mac), { move: "up" }],
  ["Keyboard move: ⌃⌘↓ moves down on macOS", "macos", chord("ArrowDown", mac), { move: "down" }],
  ["Reset: ⌃⌘0 on macOS", "macos", chord("0", mac), "reset"],
  ["Keyboard move: Ctrl+Alt+Shift+→ moves right on Windows", "windows", chord("ArrowRight", pc), { move: "right" }],
  ["Keyboard move: Ctrl+Alt+Shift+↓ moves down on Linux", "linux", chord("ArrowDown", pc), { move: "down" }],
  ["Reset: Ctrl+Alt+Shift+0 on Windows", "windows", chord("0", pc), "reset"],
  ["Reset: Ctrl+Alt+Shift+0 on Linux, where Shift turns 0 into )", "linux", { ...chord(")", pc), code: "Digit0" }, "reset"],
  ["Ctrl+arrow reaches the shell on Linux", "linux", chord("ArrowLeft", { ctrlKey: true }), null],
  ["Ctrl+Shift+arrow reaches the shell on Windows", "windows", chord("ArrowRight", { ctrlKey: true, shiftKey: true }), null],
  ["Ctrl+Alt+arrow is not a layout key on Linux", "linux", chord("ArrowRight", { ctrlKey: true, altKey: true }), null],
  ["Win+Shift+arrow is not a layout key on Windows", "windows", chord("ArrowLeft", { metaKey: true, shiftKey: true }), null],
  ["macOS: Ctrl+Alt+Shift+arrow is not a layout key", "macos", chord("ArrowRight", pc), null],
  ["macOS: ⌘→ reaches the shell", "macos", chord("ArrowRight", { metaKey: true }), null],
  ["macOS: ⌃⌘⇧→ is not a layout key", "macos", chord("ArrowRight", { ...mac, shiftKey: true }), null],
  ["Windows: ⌃⌘-style Ctrl+Meta+0 is not a layout key", "windows", chord("0", mac), null],
  ["Clipboard keys are not layout keys: ⌘C", "macos", chord("c", { metaKey: true }), null],
  ["Clipboard keys are not layout keys: Ctrl+Shift+V", "linux", chord("V", { ctrlKey: true, shiftKey: true }), null],
  ["Other letters with the chord reach the shell", "linux", chord("T", pc), null],
];

describe("layoutAction", () => {
  it.each(layoutCases)("%s", (_name, platform, event, expected) => {
    expect(layoutAction(event, platform)).toEqual(expected);
  });

  it("Keyboard move: layout keys are neither pane nor clipboard keys", () => {
    for (const [, platform, event, expected] of layoutCases) {
      if (expected === null) continue;
      expect(paneAction(event, platform)).toBeNull();
      expect(clipboardAction(event, platform)).toBeNull();
    }
  });
});
