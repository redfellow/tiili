// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { searchDecorations } from "./search";
import { followSystemTheme, highlightColour, terminalTheme } from "./theme";

const ANSI_NAMES = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

// Each token reads back as its own name, so the test sees which token fed which theme colour.
const theme = terminalTheme((name) => `value-of${name}`);

const cases: [string, string][] = [
  ["background", "--term-bg"],
  ["foreground", "--term-fg"],
  ["cursor", "--accent"],
  ["overviewRulerBorder", "--term-bg"],
  ...ANSI_NAMES.map((name, i): [string, string] => [name, `--ansi-${i}`]),
];

describe("terminalTheme", () => {
  it.each(cases)("Follows system appearance: %s comes from %s", (key, token) => {
    expect(theme[key as keyof typeof theme]).toBe(`value-of${token}`);
  });

  const themes: [string, Record<string, string>][] = [
    ["light", { "--accent": "#A4472B", "--tiili-tiili": "#A4472B", "--tiili-taivas": "#6F97B3", "--term-bg": "#F6F1E9" }],
    ["dark", { "--accent": "#A4472B", "--tiili-tiili": "#A4472B", "--tiili-taivas": "#6F97B3", "--term-bg": "#182023" }],
  ];
  it.each(themes)("Match highlights: the %s selection differs from both match colours", (_name, tokens) => {
    const read = (name: string) => tokens[name] ?? "";
    const selection = terminalTheme(read).selectionBackground;
    const { activeMatchBackground, matchBackground } = searchDecorations(read);
    expect(selection).toMatch(/^#[0-9A-F]{6}$/);
    expect([activeMatchBackground, matchBackground]).not.toContain(selection);
  });
});

describe("highlightColour", () => {
  it("Pasted text in the theme's colour: the shells get the selection's #RRGGBB", () => {
    const read = (name: string) => ({ "--tiili-taivas": "#6F97B3", "--term-bg": "#182023" })[name] ?? "";
    const theme = terminalTheme(read);
    expect(highlightColour(theme)).toBe(theme.selectionBackground);
    expect(highlightColour(theme)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it.each(["", "rgba(1, 2, 3, 0.5)", "#123", "#12345678", "value-of--tiili-taivas"])(
    "Pasted text in the theme's colour: a selection that isn't #RRGGBB (%j) sends the shells nothing",
    (colour) => {
      expect(highlightColour({ selectionBackground: colour })).toBeUndefined();
    },
  );
});

describe("followSystemTheme", () => {
  const followCases: [string, boolean, number][] = [
    ["Follows system appearance: System re-applies the tokens when the OS switches", true, 2],
    ["Fixed theme ignores the system: a fixed theme keeps its colours when the OS switches", false, 1],
  ];

  it.each(followCases)("%s", (_name, followsSystem, applied) => {
    let onChange = () => {};
    const apply = vi.fn();
    followSystemTheme(apply, () => followsSystem, {
      addEventListener: (_type, listener) => { onChange = listener; },
    }, () => (name) => `value-of${name}`);
    onChange();
    expect(apply).toHaveBeenCalledTimes(applied);
  });
});
