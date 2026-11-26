// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  attentionShortcut,
  clipboardAction,
  findAction,
  layoutAction,
  minimizeAction,
  paneAction,
  settingsShortcut,
  tabAction,
  zenAction,
  zoomAction,
  type KeyChord,
  type Platform,
} from "./keymap";
import { SHORTCUTS, type ChordSpec, type Modifier, type ShortcutAction } from "./shortcuts";

/**
 * The action a key press gets, tagged like the list's actions, in the order `Panes.shortcut` and then the clipboard
 * hook try the keymap functions.
 */
function keymapAction(event: KeyChord, platform: Platform): ShortcutAction | null {
  const layout = layoutAction(event, platform);
  if (layout) return layout === "reset" ? "layout:reset" : "layout:move";
  const tab = tabAction(event, platform);
  if (tab) return `tab:${tab}`;
  if (attentionShortcut(event, platform)) return "attention:next";
  if (settingsShortcut(event, platform)) return "settings";
  if (zenAction(event, platform)) return "zen";
  if (minimizeAction(event, platform)) return "minimize:pane";
  const pane = paneAction(event, platform);
  if (pane) return `pane:${pane.type}`;
  const zoom = zoomAction(event, platform);
  if (zoom) return `zoom:${zoom}`;
  const find = findAction(event, platform);
  if (find) return `find:${find}`;
  const clipboard = clipboardAction(event, platform);
  if (clipboard) return `clipboard:${clipboard}`;
  return null;
}

/** Every key the test tries: its `code`, and its `key` without and with Shift on a US layout. */
const KEYS: [code: string, key: string, shifted: string][] = [
  ...[..."abcdefghijklmnopqrstuvwxyz"].map((c): [string, string, string] => [`Key${c.toUpperCase()}`, c, c.toUpperCase()]),
  ...[..."0123456789"].map((d, i): [string, string, string] => [`Digit${d}`, d, ")!@#$%^&*("[i]]),
  ...(
    [
      ["Minus", "-", "_"],
      ["Equal", "=", "+"],
      ["BracketLeft", "[", "{"],
      ["BracketRight", "]", "}"],
      ["Backslash", "\\", "|"],
      ["Semicolon", ";", ":"],
      ["Quote", "'", '"'],
      ["Comma", ",", "<"],
      ["Period", ".", ">"],
      ["Slash", "/", "?"],
      ["Backquote", "`", "~"],
    ] as [string, string, string][]
  ),
  ...Array.from({ length: 12 }, (_, i): [string, string, string] => [`F${i + 1}`, `F${i + 1}`, `F${i + 1}`]),
  ...["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Tab", "PageUp", "PageDown", "Escape", "Space"].map(
    (k): [string, string, string] => [k, k === "Space" ? " " : k, k === "Space" ? " " : k],
  ),
  ...[..."0123456789"].map((d): [string, string, string] => [`Numpad${d}`, d, d]),
  ...(
    [
      ["NumpadAdd", "+"],
      ["NumpadSubtract", "-"],
      ["NumpadMultiply", "*"],
      ["NumpadDivide", "/"],
      ["NumpadDecimal", "."],
      ["NumpadEnter", "Enter"],
    ] as [string, string][]
  ).map(([code, key]): [string, string, string] => [code, key, key]),
];

const MODIFIERS: Modifier[] = ["ctrl", "shift", "alt", "meta"];
const MODIFIER_SETS: Modifier[][] = Array.from({ length: 16 }, (_, bits) => MODIFIERS.filter((_, i) => bits & (1 << i)));
const PLATFORMS: Platform[] = ["macos", "windows", "linux"];

function event(code: string, mods: readonly Modifier[]): KeyChord {
  const entry = KEYS.find(([c]) => c === code);
  if (!entry) throw new Error(`no key with code ${code} in the test's key list`);
  return {
    code,
    key: mods.includes("shift") ? entry[2] : entry[1],
    ctrlKey: mods.includes("ctrl"),
    shiftKey: mods.includes("shift"),
    altKey: mods.includes("alt"),
    metaKey: mods.includes("meta"),
  };
}

function sameChord(a: ChordSpec, code: string, mods: readonly Modifier[]): boolean {
  return a.code === code && a.mods.length === mods.length && mods.every((m) => a.mods.includes(m));
}

function keysFor(platform: Platform) {
  return SHORTCUTS.map((s) => ({ action: s.action, keys: platform === "macos" ? s.mac : s.other }));
}

describe("SHORTCUTS against the keymap", () => {
  it.each(PLATFORMS)("A keymap chord without a list entry: every chord the keymap accepts on %s is listed under its action", (platform) => {
    const missing: string[] = [];
    for (const [code] of KEYS) {
      for (const mods of MODIFIER_SETS) {
        const action = keymapAction(event(code, mods), platform);
        if (action === null) continue;
        const listed = keysFor(platform).some(
          (s) => s.action === action && s.keys?.chords.some((c) => sameChord(c, code, mods)),
        );
        if (!listed) missing.push(`${[...mods, code].join("+")} → ${action}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(PLATFORMS)("every listed chord on %s triggers its entry's action", (platform) => {
    const wrong: string[] = [];
    for (const { action, keys } of keysFor(platform)) {
      for (const c of keys?.chords ?? []) {
        const got = keymapAction(event(c.code, c.mods), platform);
        if (got !== action) wrong.push(`${[...c.mods, c.code].join("+")}: listed ${action}, keymap ${got}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("lists each action once, and only Heynote without any chord", () => {
    const actions = SHORTCUTS.map((s) => s.action);
    expect(new Set(actions).size).toBe(actions.length);
    expect(SHORTCUTS.filter((s) => !s.mac && !s.other).map((s) => s.action)).toEqual(["pane:heynote"]);
  });
});
