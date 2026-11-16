// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  attentionShortcut,
  clipboardAction,
  findAction,
  layoutAction,
  lineEditInput,
  paneAction,
  settingsShortcut,
  tabAction,
  type ClipboardAction,
  type FindAction,
  type KeyChord,
  type LayoutAction,
  type PaneAction,
  type Platform,
  type TabAction,
  type ZoomAction,
  zenAction,
  zoomAction,
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
const NEW_WINDOW: PaneAction = { type: "newWindow" };
const MOVE_TO_NEW_WINDOW: PaneAction = { type: "moveToNewWindow" };

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
  ["Open a second window: ⌘N is kept from the shell on macOS", "macos", chord("n", { metaKey: true }), NEW_WINDOW],
  ["Open a second window: Ctrl+Shift+N on Windows", "windows", chord("N", { ctrlKey: true, shiftKey: true }), NEW_WINDOW],
  ["Open a second window: Ctrl+Shift+N on Linux", "linux", chord("N", { ctrlKey: true, shiftKey: true }), NEW_WINDOW],
  ["Ctrl+N reaches the shell on Linux", "linux", chord("n", { ctrlKey: true }), null],
  ["macOS: ⌘⇧N is not a pane key", "macos", chord("N", { metaKey: true, shiftKey: true }), null],
  ["Move to a new window: ⌃⌘N on macOS", "macos", chord("n", { ctrlKey: true, metaKey: true }), MOVE_TO_NEW_WINDOW],
  ["Move to a new window: Ctrl+Alt+Shift+N on Windows", "windows", chord("N", { ctrlKey: true, altKey: true, shiftKey: true }), MOVE_TO_NEW_WINDOW],
  ["Move to a new window: Ctrl+Alt+Shift+N on Linux", "linux", chord("N", { ctrlKey: true, altKey: true, shiftKey: true }), MOVE_TO_NEW_WINDOW],
  ["macOS: ⌃⌘⇧N is not a pane key", "macos", chord("N", { ctrlKey: true, metaKey: true, shiftKey: true }), null],
  ["macOS: Ctrl+Alt+Shift+N is not a pane key", "macos", chord("N", { ctrlKey: true, altKey: true, shiftKey: true }), null],
  ["Linux: Ctrl+Alt+N reaches the shell", "linux", chord("n", { ctrlKey: true, altKey: true }), null],
  ["Windows: Ctrl+Meta+N is not a pane key", "windows", chord("n", { ctrlKey: true, metaKey: true }), null],
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

const attentionCases: [string, Platform, KeyChord, "next" | null][] = [
  ["Next pane in another window: ⌘J on macOS", "macos", chord("j", { metaKey: true }), "next"],
  ["Next pane in another window: Ctrl+Shift+J on Windows", "windows", chord("J", { ctrlKey: true, shiftKey: true }), "next"],
  ["Next pane in another window: Ctrl+Shift+J on Linux", "linux", chord("J", { ctrlKey: true, shiftKey: true }), "next"],
  ["macOS: Ctrl+J (newline) reaches the shell", "macos", chord("j", { ctrlKey: true }), null],
  ["Linux: Ctrl+J (newline) reaches the shell", "linux", chord("j", { ctrlKey: true }), null],
  ["Windows: Win+J is not the shortcut", "windows", chord("j", { metaKey: true }), null],
  ["macOS: ⌘⇧J is not the shortcut", "macos", chord("J", { metaKey: true, shiftKey: true }), null],
  ["A plain j reaches the shell", "linux", chord("j"), null],
];

describe("attentionShortcut", () => {
  it.each(attentionCases)("%s", (_name, platform, event, expected) => {
    expect(attentionShortcut(event, platform)).toBe(expected);
  });

  it("Next pane: the shortcut is not a pane, layout, settings or clipboard key", () => {
    for (const [, platform, event, expected] of attentionCases) {
      if (expected === null) continue;
      expect(paneAction(event, platform)).toBeNull();
      expect(layoutAction(event, platform)).toBeNull();
      expect(settingsShortcut(event, platform)).toBeNull();
      expect(clipboardAction(event, platform)).toBeNull();
    }
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

const zoomCases: [string, Platform, KeyChord, ZoomAction | null][] = [
  ["Zoom in one pane: ⌘= zooms in on macOS", "macos", { ...chord("=", { metaKey: true }), code: "Equal" }, "in"],
  ["Zoom in one pane: ⌘+ zooms in on macOS", "macos", { ...chord("+", { metaKey: true, shiftKey: true }), code: "Equal" }, "in"],
  ["Zoom in one pane: ⌘− zooms out on macOS", "macos", { ...chord("-", { metaKey: true }), code: "Minus" }, "out"],
  ["Reset zoom: ⌘0 on macOS", "macos", { ...chord("0", { metaKey: true }), code: "Digit0" }, "reset"],
  ["Zoom in one pane: Ctrl+= zooms in on Windows", "windows", { ...chord("=", { ctrlKey: true }), code: "Equal" }, "in"],
  ["Zoom in one pane: Ctrl++ zooms in on Windows", "windows", { ...chord("+", { ctrlKey: true, shiftKey: true }), code: "Equal" }, "in"],
  ["Zoom in one pane: Ctrl+− zooms out on Windows", "windows", { ...chord("-", { ctrlKey: true }), code: "Minus" }, "out"],
  ["Reset zoom: Ctrl+0 on Windows", "windows", { ...chord("0", { ctrlKey: true }), code: "Digit0" }, "reset"],
  ["Zoom in one pane: Ctrl+numpad + zooms in on Linux", "linux", { ...chord("+", { ctrlKey: true }), code: "NumpadAdd" }, "in"],
  ["Zoom in one pane: Ctrl+numpad − zooms out on Linux", "linux", { ...chord("-", { ctrlKey: true }), code: "NumpadSubtract" }, "out"],
  ["Reset zoom: Ctrl+numpad 0 on Linux", "linux", { ...chord("0", { ctrlKey: true }), code: "Numpad0" }, "reset"],
  ["Layout reset ⌃⌘0 is not a zoom key", "macos", { ...chord("0", mac), code: "Digit0" }, null],
  ["Layout reset Ctrl+Alt+Shift+0 is not a zoom key", "windows", { ...chord(")", pc), code: "Digit0" }, null],
  ["Alt+− is not a zoom key", "linux", { ...chord("-", { altKey: true }), code: "Minus" }, null],
  ["Windows: ⌘− is not a zoom key", "windows", { ...chord("-", { metaKey: true }), code: "Minus" }, null],
  ["macOS: Ctrl+− reaches the shell", "macos", { ...chord("-", { ctrlKey: true }), code: "Minus" }, null],
  ["Plain − reaches the shell", "linux", { ...chord("-"), code: "Minus" }, null],
];

describe("zoomAction", () => {
  it.each(zoomCases)("%s", (_name, platform, event, expected) => {
    expect(zoomAction(event, platform)).toBe(expected);
  });

  it("Zoom in one pane: zoom keys are not layout, pane, settings or clipboard keys", () => {
    for (const [, platform, event, expected] of zoomCases) {
      if (expected === null) continue;
      expect(layoutAction(event, platform)).toBeNull();
      expect(paneAction(event, platform)).toBeNull();
      expect(settingsShortcut(event, platform)).toBeNull();
      expect(clipboardAction(event, platform)).toBeNull();
    }
  });
});

const findCases: [string, Platform, KeyChord, FindAction | null][] = [
  ["macOS Edit menu: ⌘F finds", "macos", chord("f", { metaKey: true }), "find"],
  ["macOS Edit menu: ⌘G finds the next match", "macos", chord("g", { metaKey: true }), "next"],
  ["macOS Edit menu: ⇧⌘G finds the previous match", "macos", chord("G", { metaKey: true, shiftKey: true }), "previous"],
  ["macOS: Ctrl+F reaches the shell", "macos", chord("f", { ctrlKey: true }), null],
  ["Open with a selection: Ctrl+Shift+F finds on Windows", "windows", chord("F", { ctrlKey: true, shiftKey: true }), "find"],
  ["Open with a selection: Ctrl+Shift+F finds on Linux", "linux", chord("F", { ctrlKey: true, shiftKey: true }), "find"],
  ["Navigate and close: F3 finds the next match on Linux", "linux", chord("F3"), "next"],
  ["Navigate and close: Shift+F3 finds the previous match on Windows", "windows", chord("F3", { shiftKey: true }), "previous"],
  ["Ctrl+F on Linux: the shell receives it", "linux", chord("f", { ctrlKey: true }), null],
  ["Ctrl+F on Windows: the shell receives it", "windows", chord("f", { ctrlKey: true }), null],
  ["Linux: plain F reaches the shell", "linux", chord("f"), null],
  ["macOS: F3 is not a find key", "macos", chord("F3"), null],
];

describe("findAction", () => {
  it.each(findCases)("%s", (_name, platform, event, expected) => {
    expect(findAction(event, platform)).toBe(expected);
  });

  it("Find keys are not pane, layout, settings, zoom or clipboard keys", () => {
    for (const [, platform, event, expected] of findCases) {
      if (expected === null) continue;
      expect(clipboardAction(event, platform)).toBeNull();
      expect(paneAction(event, platform)).toBeNull();
      expect(layoutAction(event, platform)).toBeNull();
      expect(settingsShortcut(event, platform)).toBeNull();
      expect(zoomAction(event, platform)).toBeNull();
      expect(attentionShortcut(event, platform)).toBeNull();
    }
  });
});

const macBracket = (code: "BracketRight" | "BracketLeft", mods: Partial<Omit<KeyChord, "key">>): KeyChord => ({
  ...chord(code === "BracketRight" ? "}" : "{", { metaKey: true, shiftKey: true, ...mods }),
  code,
});

const tabCases: [string, Platform, KeyChord, TabAction | null][] = [
  ["Tab shortcuts: ⇧⌘T opens a new tab on macOS", "macos", { ...chord("T", { metaKey: true, shiftKey: true }), code: "KeyT" }, "new"],
  ["Tab shortcuts: Ctrl+Alt+Shift+T opens a new tab on Windows", "windows", { ...chord("T", pc), code: "KeyT" }, "new"],
  ["Tab shortcuts: Ctrl+Alt+Shift+T opens a new tab on Linux", "linux", { ...chord("T", pc), code: "KeyT" }, "new"],
  ["Next tab: ⇧⌘] shows the next tab on macOS", "macos", macBracket("BracketRight", {}), "next"],
  ["Next tab: ⇧⌘[ shows the previous tab on macOS", "macos", macBracket("BracketLeft", {}), "previous"],
  ["Next tab: Ctrl+Tab shows the next tab on macOS", "macos", chord("Tab", { ctrlKey: true }), "next"],
  ["Next tab: Ctrl+Shift+Tab shows the previous tab on macOS", "macos", chord("Tab", { ctrlKey: true, shiftKey: true }), "previous"],
  ["Next tab: Ctrl+PageDown shows the next tab on Linux", "linux", chord("PageDown", { ctrlKey: true }), "next"],
  ["Next tab: Ctrl+PageUp shows the previous tab on Windows", "windows", chord("PageUp", { ctrlKey: true }), "previous"],
  ["Move pane to next tab: ⌃⇧⌘] on macOS", "macos", macBracket("BracketRight", { ctrlKey: true }), "moveNext"],
  ["Move pane to next tab: ⌃⇧⌘[ moves to the previous tab on macOS", "macos", macBracket("BracketLeft", { ctrlKey: true }), "movePrevious"],
  ["Move pane to next tab: Ctrl+Shift+PageDown on Linux", "linux", chord("PageDown", { ctrlKey: true, shiftKey: true }), "moveNext"],
  ["Move pane to next tab: Ctrl+Shift+PageUp moves to the previous tab on Windows", "windows", chord("PageUp", { ctrlKey: true, shiftKey: true }), "movePrevious"],
  ["Linux: Ctrl+Shift+T stays the new pane key", "linux", chord("T", { ctrlKey: true, shiftKey: true }), null],
  ["macOS: ⌘T stays the new pane key", "macos", { ...chord("t", { metaKey: true }), code: "KeyT" }, null],
  ["macOS: ⌘] without Shift reaches the shell", "macos", { ...chord("]", { metaKey: true }), code: "BracketRight" }, null],
  ["Linux: Ctrl+Tab is not a tab key", "linux", chord("Tab", { ctrlKey: true }), null],
  ["macOS: Ctrl+PageDown is not a tab key", "macos", chord("PageDown", { ctrlKey: true }), null],
  ["Linux: plain PageDown reaches the shell", "linux", chord("PageDown"), null],
  ["Linux: Ctrl+Alt+PageDown is not a tab key", "linux", chord("PageDown", { ctrlKey: true, altKey: true }), null],
  ["Windows: Win+Shift+T is not a tab key", "windows", chord("T", { metaKey: true, shiftKey: true }), null],
];

describe("tabAction", () => {
  it.each(tabCases)("%s", (_name, platform, event, expected) => {
    expect(tabAction(event, platform)).toBe(expected);
  });

  it("Tab shortcuts: tab keys are not pane, layout, settings, zoom, find, attention or clipboard keys", () => {
    for (const [, platform, event, expected] of tabCases) {
      if (expected === null) continue;
      expect(paneAction(event, platform)).toBeNull();
      expect(layoutAction(event, platform)).toBeNull();
      expect(settingsShortcut(event, platform)).toBeNull();
      expect(zoomAction(event, platform)).toBeNull();
      expect(findAction(event, platform)).toBeNull();
      expect(attentionShortcut(event, platform)).toBeNull();
      expect(clipboardAction(event, platform)).toBeNull();
    }
  });

  it("Tab shortcuts: pane and layout keys are not tab keys", () => {
    for (const [, platform, event, expected] of [...paneCases, ...layoutCases]) {
      if (expected === null) continue;
      expect(tabAction(event, platform)).toBeNull();
    }
  });
});

const zenCases: [string, Platform, KeyChord, "zen" | null][] = [
  ["Zen toggle: ⇧⌘Enter on macOS", "macos", chord("Enter", { metaKey: true, shiftKey: true }), "zen"],
  ["Shortcut toggles: Ctrl+Shift+Enter on Linux", "linux", chord("Enter", { ctrlKey: true, shiftKey: true }), "zen"],
  ["Zen toggle: Ctrl+Shift+Enter on Windows", "windows", chord("Enter", { ctrlKey: true, shiftKey: true }), "zen"],
  ["macOS: Ctrl+Shift+Enter reaches the shell", "macos", chord("Enter", { ctrlKey: true, shiftKey: true }), null],
  ["macOS: ⌘Enter reaches the shell", "macos", chord("Enter", { metaKey: true }), null],
  ["Linux: Ctrl+Enter reaches the shell", "linux", chord("Enter", { ctrlKey: true }), null],
  ["Linux: Shift+Enter reaches the shell", "linux", chord("Enter", { shiftKey: true }), null],
  ["Windows: Win+Shift+Enter is not the shortcut", "windows", chord("Enter", { metaKey: true, shiftKey: true }), null],
  ["Linux: Ctrl+Alt+Shift+Enter is not the shortcut", "linux", chord("Enter", { ctrlKey: true, altKey: true, shiftKey: true }), null],
  ["A plain Enter reaches the shell", "macos", chord("Enter"), null],
];

describe("zenAction", () => {
  it.each(zenCases)("%s", (_name, platform, event, expected) => {
    expect(zenAction(event, platform)).toBe(expected);
  });

  it("Zen keys are not pane, layout, zoom, find or clipboard keys", () => {
    for (const [, platform, event, expected] of zenCases) {
      if (expected === null) continue;
      expect(clipboardAction(event, platform)).toBeNull();
      expect(paneAction(event, platform)).toBeNull();
      expect(layoutAction(event, platform)).toBeNull();
      expect(zoomAction(event, platform)).toBeNull();
      expect(findAction(event, platform)).toBeNull();
    }
  });
});

const lineEditCases: [string, Platform, KeyChord, string | null][] = [
  ["Command and Option arrows edit the line: ⌘← sends ^A", "macos", chord("ArrowLeft", { metaKey: true }), "\x01"],
  ["Command and Option arrows edit the line: ⌘→ sends ^E", "macos", chord("ArrowRight", { metaKey: true }), "\x05"],
  ["Command and Option arrows edit the line: ⌥← sends ESC b", "macos", chord("ArrowLeft", { altKey: true }), "\x1bb"],
  ["Command and Option arrows edit the line: ⌥→ sends ESC f", "macos", chord("ArrowRight", { altKey: true }), "\x1bf"],
  ["Command and Option arrows edit the line: ⌘⌫ sends ^U", "macos", chord("Backspace", { metaKey: true }), "\x15"],
  ["Command and Option arrows edit the line: ⌥⌫ sends ^W", "macos", chord("Backspace", { altKey: true }), "\x17"],
  ["Layout keys and other platforms untouched: ⌃⌘← passes through", "macos", chord("ArrowLeft", { ctrlKey: true, metaKey: true }), null],
  ["Layout keys and other platforms untouched: ⇧⌘← passes through", "macos", chord("ArrowLeft", { shiftKey: true, metaKey: true }), null],
  ["Layout keys and other platforms untouched: ⇧⌥← passes through", "macos", chord("ArrowLeft", { shiftKey: true, altKey: true }), null],
  ["Layout keys and other platforms untouched: ⌘⌥← passes through", "macos", chord("ArrowLeft", { metaKey: true, altKey: true }), null],
  ["Layout keys and other platforms untouched: plain ← passes through", "macos", chord("ArrowLeft"), null],
  ["Layout keys and other platforms untouched: ⌘↑ passes through", "macos", chord("ArrowUp", { metaKey: true }), null],
  ["Layout keys and other platforms untouched: Ctrl+← on Windows", "windows", chord("ArrowLeft", { ctrlKey: true }), null],
  ["Layout keys and other platforms untouched: Alt+← on Windows", "windows", chord("ArrowLeft", { altKey: true }), null],
  ["Layout keys and other platforms untouched: Ctrl+← on Linux", "linux", chord("ArrowLeft", { ctrlKey: true }), null],
  ["Layout keys and other platforms untouched: Alt+← on Linux", "linux", chord("ArrowLeft", { altKey: true }), null],
];

describe("lineEditInput", () => {
  it.each(lineEditCases)("%s", (_name, platform, event, expected) => {
    expect(lineEditInput(event, platform)).toBe(expected);
  });
});
