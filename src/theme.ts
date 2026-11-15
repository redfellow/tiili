import type { ITheme } from "@xterm/xterm";
import { blendHex } from "./search";

const ANSI_NAMES = [
  // tokens-allow: xterm's theme keys, not colours
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow",
  "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

/** Reads a CSS custom property, e.g. `--term-bg`. */
export type TokenReader = (name: string) => string;

/** How strongly taivas shows through `--term-bg` in the selection: a cool blue, apart from the brick search matches. */
const SELECTION_ALPHA = 0.45;

/**
 * The xterm theme from the tiili tokens: terminal colours, ANSI 0–15, a brick block cursor and a taivas selection,
 * which stays apart from the search highlights (accent and brick).
 */
export function terminalTheme(token: TokenReader): ITheme {
  const theme: ITheme = {
    background: token("--term-bg"),
    foreground: token("--term-fg"),
    cursor: token("--accent"),
    cursorAccent: token("--term-bg"),
    // The overview ruler's border melts into the ground; the ruler shows only the search matches' marks.
    overviewRulerBorder: token("--term-bg"),
    selectionBackground: blendHex(token("--tiili-taivas"), token("--term-bg"), SELECTION_ALPHA),
  };
  ANSI_NAMES.forEach((name, i) => {
    theme[name] = token(`--ansi-${i}`);
  });
  return theme;
}

/** The colour the shells give pasted text: the terminal selection's, as `#RRGGBB`, or undefined when it isn't hex. */
export function highlightColour(theme: ITheme): string | undefined {
  const colour = theme.selectionBackground;
  return colour !== undefined && /^#[0-9a-f]{6}$/i.test(colour) ? colour : undefined;
}

/** Reads tokens from the document's computed style. */
export function documentTokens(): TokenReader {
  const style = getComputedStyle(document.documentElement);
  return (name) => style.getPropertyValue(name).trim();
}

/** The part of a `MediaQueryList` the theme follower listens to. */
export interface ColorSchemeQuery {
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener?(type: "change", listener: () => void): void;
}

/**
 * Calls `apply` with the current theme now and again whenever the system switches light and dark, as long as
 * `followsSystem` says the chosen theme is System; a fixed theme keeps its colours. Returns a function that
 * stops following.
 */
export function followSystemTheme(
  apply: (theme: ITheme) => void,
  followsSystem: () => boolean,
  media: ColorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)"),
  tokens: () => TokenReader = documentTokens,
): () => void {
  apply(terminalTheme(tokens()));
  const onChange = () => {
    if (followsSystem()) apply(terminalTheme(tokens()));
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}
