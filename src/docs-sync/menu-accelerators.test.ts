// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHORTCUTS, type Modifier, type ShortcutAction } from "../shortcuts";

const LIB_RS = readFileSync(new URL("../../src-tauri/src/lib.rs", import.meta.url), "utf8");

/**
 * The keymap action each macOS menu item carries out, by its id in lib.rs (as the frontend handles its event). Quit
 * is the one item the keymap has no action for: the menu alone ends the app.
 */
const MENU_ACTIONS: Record<string, ShortcutAction | "quit"> = {
  QUIT_ID: "quit",
  '"settings"': "settings",
  "windows::NEW_WINDOW_EVENT": "pane:newWindow",
  '"moveToNewWindow"': "pane:moveToNewWindow",
  '"new"': "pane:new",
  '"close"': "pane:close",
  '"tabNew"': "tab:new",
  '"tabNext"': "tab:next",
  '"tabPrevious"': "tab:previous",
  '"tabMoveNext"': "tab:moveNext",
  '"tabMovePrevious"': "tab:movePrevious",
  '"zen"': "zen",
  '"copy"': "clipboard:copy",
  '"paste"': "clipboard:paste",
  '"selectAll"': "clipboard:selectAll",
  '"find"': "find:find",
  '"findNext"': "find:next",
  '"findPrevious"': "find:previous",
};

const MODIFIERS: Record<string, Modifier> = { Cmd: "meta", Ctrl: "ctrl", Shift: "shift", Alt: "alt", Option: "alt" };
const KEY_CODES: Record<string, string> = { ",": "Comma", "=": "Equal", "-": "Minus", "[": "BracketLeft", "]": "BracketRight" };

/** An accelerator such as `Shift+Cmd+BracketRight` as a key code and modifiers. */
function parseAccelerator(accelerator: string): { code: string; mods: Modifier[] } {
  const parts = accelerator.split(/\+(?!$)/);
  const key = parts.pop()!;
  const mods = parts.map((m) => {
    const mod = MODIFIERS[m];
    if (!mod) throw new Error(`unknown modifier ${m} in ${accelerator}`);
    return mod;
  });
  const code = /^[A-Z]$/.test(key) ? `Key${key}` : /^\d$/.test(key) ? `Digit${key}` : (KEY_CODES[key] ?? key);
  return { code, mods };
}

const items = [...LIB_RS.matchAll(/MenuItemBuilder::with_id\(([^,]+),\s*"([^"]*)"\)\s*\.accelerator\("([^"]+)"\)/g)].map(
  ([, id, label, accelerator]) => ({ id: id.trim(), label, accelerator }),
);

describe("macOS menu accelerators", () => {
  it("finds every accelerator in lib.rs", () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBe(LIB_RS.match(/\.accelerator\(/g)?.length);
  });

  it.each(items)("$label ($accelerator) is the keymap's chord for the same action", ({ id, accelerator }) => {
    const action = MENU_ACTIONS[id];
    expect(action, `menu item ${id} has no keymap action in this test's table`).toBeDefined();
    if (action === "quit") return expect(accelerator).toBe("Cmd+Q");
    const { code, mods } = parseAccelerator(accelerator);
    const chords = SHORTCUTS.find((s) => s.action === action)?.mac?.chords ?? [];
    const match = chords.some(
      (c) => c.code === code && c.mods.length === mods.length && mods.every((m) => c.mods.includes(m)),
    );
    expect(match, `${accelerator} is not a macOS chord of ${action}`).toBe(true);
  });
});
