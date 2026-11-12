import type { ITheme } from "@xterm/xterm";

const ANSI_NAMES = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

/** Reads a CSS custom property, e.g. `--term-bg`. */
export type TokenReader = (name: string) => string;

/** The xterm theme from the tiili tokens: terminal colours, ANSI 0–15 and a brick block cursor. */
export function terminalTheme(token: TokenReader): ITheme {
  const theme: ITheme = {
    background: token("--term-bg"),
    foreground: token("--term-fg"),
    cursor: token("--accent"),
    cursorAccent: token("--term-bg"),
  };
  ANSI_NAMES.forEach((name, i) => {
    theme[name] = token(`--ansi-${i}`);
  });
  return theme;
}

/** Reads tokens from the document's computed style. */
export function documentTokens(): TokenReader {
  const style = getComputedStyle(document.documentElement);
  return (name) => style.getPropertyValue(name).trim();
}

/** Calls `apply` with the current theme now and again whenever the system switches light and dark. */
export function followSystemTheme(apply: (theme: ITheme) => void): void {
  const update = () => apply(terminalTheme(documentTokens()));
  update();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
}
