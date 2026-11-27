/**
 * Every keyboard shortcut tiili handles, grouped for the docs. `npm run docs` writes the README and site tables from
 * this list, and `shortcuts.test.ts` holds it to the keymap functions in `keymap.ts`: a chord they accept without an
 * entry here, or an entry whose chords miss its action, fails the tests. Node loads this file as plain TypeScript
 * (type stripping), so keep it free of enums, namespaces and runtime imports.
 */

export type Modifier = "ctrl" | "shift" | "alt" | "meta";

/** One physical chord: the key's `code` (as in a keyboard event) and the modifiers held, no more and no fewer. */
export interface ChordSpec {
  code: string;
  mods: readonly Modifier[];
}

/**
 * A shortcut's keys on one platform. `keys` is what the docs show, with each key cap in braces: `{⌘1}–{⌘9}`.
 * `chords` lists every chord that triggers it, including ones the docs leave out (numpad keys, `⌘+` for `⌘=`).
 */
export interface Keys {
  keys: string;
  chords: readonly ChordSpec[];
}

export type ShortcutGroup = "Panes" | "Tabs" | "Find" | "View and edit";

/** The keymap's actions, tagged by the function that returns them, e.g. `pane:new` from `paneAction`. */
export type ShortcutAction =
  | "pane:new"
  | "pane:close"
  | "pane:focus"
  | "pane:newWindow"
  | "pane:moveToNewWindow"
  | "pane:heynote"
  | "minimize:pane"
  | "layout:move"
  | "layout:reset"
  | "attention:next"
  | "tab:new"
  | "tab:next"
  | "tab:previous"
  | "tab:moveNext"
  | "tab:movePrevious"
  | "find:find"
  | "find:next"
  | "find:previous"
  | "clipboard:copy"
  | "clipboard:paste"
  | "clipboard:selectAll"
  | "zoom:in"
  | "zoom:out"
  | "zoom:reset"
  | "zen"
  | "settings";

/**
 * One shortcut. `mac` is macOS, `other` Windows and Linux; null where the platform has no chord for it. An entry with
 * neither (Heynote) is listed so the list names every action, and left out of the tables.
 */
export interface Shortcut {
  action: ShortcutAction;
  group: ShortcutGroup;
  label: string;
  mac: Keys | null;
  other: Keys | null;
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["Panes", "Tabs", "Find", "View and edit"];

/** Parses `"ctrl+shift+KeyT"`: modifiers, then the key's code. */
function chord(spec: string): ChordSpec {
  const parts = spec.split("+");
  return { code: parts[parts.length - 1], mods: parts.slice(0, -1) as Modifier[] };
}

function on(keys: string, ...chords: string[]): Keys {
  return { keys, chords: chords.map(chord) };
}

/** `mods+Digit1` … `mods+Digit9` and the numpad's 1–9. */
function digits(mods: string): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [`${mods}+Digit${n}`, `${mods}+Numpad${n}`]);
}

function arrows(mods: string): string[] {
  return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((code) => `${mods}+${code}`);
}

export const SHORTCUTS: readonly Shortcut[] = [
  { action: "pane:new", group: "Panes", label: "New terminal", mac: on("{⌘T}", "meta+KeyT"), other: on("{Ctrl+Shift+T}", "ctrl+shift+KeyT") },
  { action: "pane:close", group: "Panes", label: "Close terminal", mac: on("{⌘W}", "meta+KeyW"), other: on("{Ctrl+Shift+W}", "ctrl+shift+KeyW") },
  {
    action: "pane:focus",
    group: "Panes",
    label: "Focus terminal 1–9",
    mac: on("{⌘1}–{⌘9}", ...digits("meta")),
    other: on("{Alt+1}–{Alt+9}", ...digits("alt")),
  },
  {
    action: "attention:next",
    group: "Panes",
    label: "Focus the terminal that needs you",
    mac: on("{⌘J}", "meta+KeyJ"),
    other: on("{Ctrl+Shift+J}", "ctrl+shift+KeyJ"),
  },
  {
    action: "layout:move",
    group: "Panes",
    label: "Move pane",
    mac: on("{⌃⌘} + arrow", ...arrows("ctrl+meta")),
    other: on("{Ctrl+Alt+Shift} + arrow", ...arrows("ctrl+shift+alt")),
  },
  {
    action: "layout:reset",
    group: "Panes",
    label: "Reset grid",
    mac: on("{⌃⌘0}", "ctrl+meta+Digit0", "ctrl+meta+Numpad0"),
    other: on("{Ctrl+Alt+Shift+0}", "ctrl+shift+alt+Digit0", "ctrl+shift+alt+Numpad0"),
  },
  {
    action: "minimize:pane",
    group: "Panes",
    label: "Minimize pane",
    mac: on("{⇧⌘M}", "shift+meta+KeyM"),
    other: on("{Ctrl+Shift+M}", "ctrl+shift+KeyM"),
  },
  { action: "pane:newWindow", group: "Panes", label: "New window", mac: on("{⌘N}", "meta+KeyN"), other: on("{Ctrl+Shift+N}", "ctrl+shift+KeyN") },
  {
    action: "pane:moveToNewWindow",
    group: "Panes",
    label: "Move pane to a new window",
    mac: on("{⌃⌘N}", "ctrl+meta+KeyN"),
    other: on("{Ctrl+Alt+Shift+N}", "ctrl+shift+alt+KeyN"),
  },
  { action: "pane:heynote", group: "Panes", label: "Open Heynote", mac: null, other: null },

  { action: "tab:new", group: "Tabs", label: "New tab", mac: on("{⇧⌘T}", "shift+meta+KeyT"), other: on("{Ctrl+Alt+Shift+T}", "ctrl+shift+alt+KeyT") },
  {
    action: "tab:next",
    group: "Tabs",
    label: "Next tab",
    mac: on("{⇧⌘]} or {⌃Tab}", "shift+meta+BracketRight", "ctrl+Tab"),
    other: on("{Ctrl+PageDown}", "ctrl+PageDown"),
  },
  {
    action: "tab:previous",
    group: "Tabs",
    label: "Previous tab",
    mac: on("{⇧⌘[} or {⌃⇧Tab}", "shift+meta+BracketLeft", "ctrl+shift+Tab"),
    other: on("{Ctrl+PageUp}", "ctrl+PageUp"),
  },
  {
    action: "tab:moveNext",
    group: "Tabs",
    label: "Move pane to the next tab",
    mac: on("{⌃⇧⌘]}", "ctrl+shift+meta+BracketRight"),
    other: on("{Ctrl+Shift+PageDown}", "ctrl+shift+PageDown"),
  },
  {
    action: "tab:movePrevious",
    group: "Tabs",
    label: "Move pane to the previous tab",
    mac: on("{⌃⇧⌘[}", "ctrl+shift+meta+BracketLeft"),
    other: on("{Ctrl+Shift+PageUp}", "ctrl+shift+PageUp"),
  },

  { action: "find:find", group: "Find", label: "Find", mac: on("{⌘F}", "meta+KeyF"), other: on("{Ctrl+Shift+F}", "ctrl+shift+KeyF") },
  { action: "find:next", group: "Find", label: "Next match", mac: on("{⌘G}", "meta+KeyG"), other: on("{F3}", "F3") },
  { action: "find:previous", group: "Find", label: "Previous match", mac: on("{⇧⌘G}", "shift+meta+KeyG"), other: on("{Shift+F3}", "shift+F3") },

  { action: "clipboard:copy", group: "View and edit", label: "Copy", mac: on("{⌘C}", "meta+KeyC"), other: on("{Ctrl+Shift+C}", "ctrl+shift+KeyC") },
  { action: "clipboard:paste", group: "View and edit", label: "Paste", mac: on("{⌘V}", "meta+KeyV"), other: on("{Ctrl+Shift+V}", "ctrl+shift+KeyV") },
  { action: "clipboard:selectAll", group: "View and edit", label: "Select all", mac: on("{⌘A}", "meta+KeyA"), other: null },
  {
    action: "zoom:in",
    group: "View and edit",
    label: "Larger text",
    mac: on("{⌘=}", "meta+Equal", "shift+meta+Equal", "meta+NumpadAdd", "shift+meta+NumpadAdd"),
    other: on("{Ctrl+=}", "ctrl+Equal", "ctrl+shift+Equal", "ctrl+NumpadAdd", "ctrl+shift+NumpadAdd"),
  },
  {
    action: "zoom:out",
    group: "View and edit",
    label: "Smaller text",
    mac: on("{⌘−}", "meta+Minus", "meta+NumpadSubtract"),
    other: on("{Ctrl+−}", "ctrl+Minus", "ctrl+shift+Minus", "ctrl+NumpadSubtract", "ctrl+shift+NumpadSubtract"),
  },
  {
    action: "zoom:reset",
    group: "View and edit",
    label: "Reset text size",
    mac: on("{⌘0}", "meta+Digit0", "meta+Numpad0"),
    other: on("{Ctrl+0}", "ctrl+Digit0", "ctrl+shift+Digit0", "ctrl+Numpad0", "ctrl+shift+Numpad0"),
  },
  {
    action: "zen",
    group: "View and edit",
    label: "Zen mode",
    mac: on("{⇧⌘Enter}", "shift+meta+Enter", "shift+meta+NumpadEnter"),
    other: on("{Ctrl+Shift+Enter}", "ctrl+shift+Enter", "ctrl+shift+NumpadEnter"),
  },
  { action: "settings", group: "View and edit", label: "Settings", mac: on("{⌘,}", "meta+Comma"), other: on("{Ctrl+,}", "ctrl+Comma") },
];
