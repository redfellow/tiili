// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { followSystemTheme, terminalTheme } from "./theme";

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
  ...ANSI_NAMES.map((name, i): [string, string] => [name, `--ansi-${i}`]),
];

describe("terminalTheme", () => {
  it.each(cases)("Follows system appearance: %s comes from %s", (key, token) => {
    expect(theme[key as keyof typeof theme]).toBe(`value-of${token}`);
  });
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
