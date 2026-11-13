import type { ThemeId } from "./settings";

/** The tokens each fixed theme sets; anything else (spacing, type, tints) stays as tiili.css defines it. */
export const THEME_TOKENS = [
  "--bg", "--surface", "--fg", "--muted", "--line", "--accent",
  "--term-bg", "--term-fg", "--term-dim", "--term-gap", "--on-accent", "--focus",
  ...Array.from({ length: 16 }, (_, i) => `--ansi-${i}`),
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

export interface Theme {
  id: ThemeId;
  name: string;
  /** Whether the theme is light or dark: picks the brand set for the tokens a theme doesn't set itself. */
  kind: "light" | "dark" | "system";
  /** Empty for System, which leaves tiili.css and the OS to choose. */
  tokens: Partial<Record<ThemeToken, string>>;
}

/** ANSI 0–15 from a space-separated list of 16 colours. */
function ansi(colours: string): Record<string, string> {
  const list = colours.trim().split(/\s+/);
  if (list.length !== 16) throw new Error(`An ANSI set needs 16 colours, got ${list.length}`);
  return Object.fromEntries(list.map((colour, i) => [`--ansi-${i}`, colour]));
}

interface Chrome {
  bg: string; surface: string; fg: string; muted: string; line: string; accent: string;
  termBg: string; termFg: string; termDim: string; termGap: string;
}

function channels(colour: string): number[] {
  return [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
}

function luminance(colour: string): number {
  const [r, g, b] = channels(colour).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The label colour for text on an accent fill: white, or near-black when that reads better. */
function onAccent(accent: string): string {
  return contrast("#FFFFFF", accent) >= contrast("#1B1614", accent) ? "#FFFFFF" : "#1B1614";
}

/** The accent, moved towards white (dark grounds) or black (light) until it is 3:1 against both grounds: for focus rings. */
function focusRing(accent: string, grounds: string[]): string {
  const target = luminance(grounds[0]) < 0.3 ? 255 : 0;
  const base = channels(accent);
  for (let t = 0; t <= 1; t += 0.01) {
    const mixed =
      "#" + base.map((c) => Math.round(c + (target - c) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
    if (grounds.every((ground) => contrast(mixed, ground) >= 3)) return mixed;
  }
  return accent;
}

function tokens(chrome: Chrome, colours: string): Record<ThemeToken, string> {
  return {
    "--on-accent": onAccent(chrome.accent),
    "--focus": focusRing(chrome.accent, [chrome.bg, chrome.surface]),
    "--bg": chrome.bg,
    "--surface": chrome.surface,
    "--fg": chrome.fg,
    "--muted": chrome.muted,
    "--line": chrome.line,
    "--accent": chrome.accent,
    "--term-bg": chrome.termBg,
    "--term-fg": chrome.termFg,
    "--term-dim": chrome.termDim,
    "--term-gap": chrome.termGap,
    ...ansi(colours),
  } as Record<ThemeToken, string>;
}

// The brand sets, as in docs/brand/tiili.css.
const TIILI_LIGHT_ANSI =
  "#2A2321 #A4472B #4C7356 #8C5F0E #3C6680 #844B66 #3F6E6B #8D877D #5E5650 #C2512F #5E8A69 #A87414 #4D7C99 #9C5A7A #4F8481 #B9B1A6";
const TIILI_DARK_ANSI =
  "#222B2E #D05B3F #8DB596 #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC8BE #626C6A #E57A57 #A9CBB0 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F6F1E9";

// Solarized's published palette; light and dark share the accents and swap the base tones. A few of the accents
// and the bright black are nudged until they reach 3:1 on their ground.
const SOLARIZED_LIGHT_ANSI =
  "#073642 #DC322F #849700 #B38800 #268BD2 #D33682 #299E95 #EEE8D5 #002B36 #CB4B16 #586E75 #657B83 #809193 #6C71C4 #849191 #FDF6E3";
const SOLARIZED_DARK_ANSI =
  "#073642 #DC322F #859900 #B58900 #268BD2 #D33682 #2AA198 #EEE8D5 #59757C #CB4B16 #5F747B #657B83 #839496 #6C71C4 #93A1A1 #FDF6E3";

export const THEMES: readonly Theme[] = [
  { id: "system", name: "System", kind: "system", tokens: {} },
  {
    id: "tiili-light", name: "tiili Light", kind: "light",
    tokens: tokens({
      bg: "#F6F1E9", surface: "#FFFDF9", fg: "#2A2321", muted: "#6B625C", line: "#DCD2C5", accent: "#A4472B",
      termBg: "#F6F1E9", termFg: "#2A2321", termDim: "#8D877D", termGap: "#D8CEC0",
    }, TIILI_LIGHT_ANSI),
  },
  {
    id: "tiili-dark", name: "tiili Dark", kind: "dark",
    tokens: tokens({
      bg: "#111617", surface: "#182023", fg: "#EFE7DE", muted: "#A0978F", line: "#2A3437", accent: "#A4472B",
      termBg: "#182023", termFg: "#D9D3CA", termDim: "#6E7876", termGap: "#0B0F10",
    }, TIILI_DARK_ANSI),
  },
  {
    // Warm light grounds with savi as the accent; ANSI from the brand light set, warmed towards savi and sammal.
    id: "savi", name: "Savi", kind: "light",
    tokens: tokens({
      bg: "#F3EEE7", surface: "#FBF8F4", fg: "#2A2321", muted: "#6F6560", line: "#DDD3C8", accent: "#C9764F",
      termBg: "#F3EEE7", termFg: "#2A2321", termDim: "#8D877D", termGap: "#DDD3C8",
    }, "#2A2321 #A4472B #5A7340 #8C5F0E #3C6680 #844B66 #3F6E6B #8D877D #5E5650 #C5744D #6E7F4E #A87414 #4D7C99 #9C5A7A #4F8481 #B9B1A6"),
  },
  {
    // Warm dark grounds; muratti for the accent and red, koivu for yellow, the warm off-white for the text.
    id: "muratti", name: "Muratti", kind: "dark",
    tokens: tokens({
      bg: "#151112", surface: "#1E1919", fg: "#EFE7DE", muted: "#A0948C", line: "#342B29", accent: "#861B22",
      termBg: "#1E1919", termFg: "#F3E7DC", termDim: "#6F6560", termGap: "#0E0B0B",
    }, "#2A2222 #C0444B #9AAE7A #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC4B8 #6F6563 #D9625F #B5C792 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F3E7DC"),
  },
  {
    // Rapids at night: koski panes on a darker window, savi cursor, ikkuna for cyan.
    id: "koski", name: "Koski", kind: "dark",
    tokens: tokens({
      bg: "#0F1516", surface: "#182023", fg: "#C9CFCD", muted: "#8A9492", line: "#24302F", accent: "#C9764F",
      termBg: "#182023", termFg: "#C9CFCD", termDim: "#6E7876", termGap: "#0B0F10",
    }, "#222B2E #D05B3F #8FB59A #D9A43A #7FA2B8 #B97C92 #8FA6A4 #C9CFCD #626C6A #C9764F #A9CBB0 #EDC066 #9DBCD0 #D198AC #B3C7C5 #EEF1EF"),
  },
  {
    // The mortar grid: tiili, klinkkeri, savi and rauta on laasti.
    id: "laasti", name: "Laasti", kind: "light",
    tokens: tokens({
      bg: "#E8DECD", surface: "#F6F1E9", fg: "#2A2321", muted: "#5E5650", line: "#D0C3AE", accent: "#A4472B",
      termBg: "#E8DECD", termFg: "#2A2321", termDim: "#7A746B", termGap: "#CFC2AC",
    }, "#2A2321 #A4472B #4C7356 #7E5508 #3C6680 #6B2A1E #3F6E6B #7A746B #3A3F45 #B5532F #557E5F #96680F #4D7C99 #9C5A7A #4F8481 #A89F92"),
  },
  {
    id: "solarized-light", name: "Solarized Light", kind: "light",
    tokens: tokens({
      bg: "#FDF6E3", surface: "#EEE8D5", fg: "#586B72", muted: "#616A6A", line: "#DDD6C1", accent: "#268BD2",
      termBg: "#FDF6E3", termFg: "#5F747B", termDim: "#849191", termGap: "#EEE8D5",
    }, SOLARIZED_LIGHT_ANSI),
  },
  {
    id: "solarized-dark", name: "Solarized Dark", kind: "dark",
    tokens: tokens({
      bg: "#002B36", surface: "#073642", fg: "#8C9B9D", muted: "#8C9BA0", line: "#0B4050", accent: "#268BD2",
      termBg: "#002B36", termFg: "#839496", termDim: "#5F747B", termGap: "#00212B",
    }, SOLARIZED_DARK_ANSI),
  },
  {
    id: "gruvbox-dark", name: "Gruvbox Dark", kind: "dark",
    tokens: tokens({
      bg: "#282828", surface: "#3C3836", fg: "#EBDBB2", muted: "#AEA08D", line: "#504945", accent: "#FE8019",
      termBg: "#282828", termFg: "#EBDBB2", termDim: "#928374", termGap: "#1D2021",
    }, "#282828 #D13831 #98971A #D79921 #458588 #B16286 #689D6A #A89984 #928374 #FB4934 #B8BB26 #FABD2F #83A598 #D3869B #8EC07C #EBDBB2"),
  },
  {
    id: "nord", name: "Nord", kind: "dark",
    tokens: tokens({
      bg: "#2E3440", surface: "#3B4252", fg: "#D8DEE9", muted: "#A6AEBB", line: "#434C5E", accent: "#88C0D0",
      termBg: "#2E3440", termFg: "#D8DEE9", termDim: "#757D8C", termGap: "#242933",
    }, "#3B4252 #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #88C0D0 #E5E9F0 #757D8C #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #8FBCBB #ECEFF4"),
  },
  {
    id: "dracula", name: "Dracula", kind: "dark",
    tokens: tokens({
      bg: "#282A36", surface: "#44475A", fg: "#F8F8F2", muted: "#ADB6D0", line: "#3A3C4E", accent: "#BD93F9",
      termBg: "#282A36", termFg: "#F8F8F2", termDim: "#6272A4", termGap: "#21222C",
    }, "#21222C #FF5555 #50FA7B #F1FA8C #BD93F9 #FF79C6 #8BE9FD #F8F8F2 #6272A4 #FF6E6E #69FF94 #FFFFA5 #D6ACFF #FF92DF #A4FFFF #FFFFFF"),
  },
];

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

/**
 * Applies a theme to the app: a fixed theme sets its tokens inline on `root` and pins the brand light or dark set
 * for everything else; System clears them so tiili.css follows the OS.
 */
export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement): void {
  const theme = themeById(id);
  for (const name of THEME_TOKENS) root.style.removeProperty(name);
  if (theme.kind === "system") {
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = theme.kind;
  for (const [name, value] of Object.entries(theme.tokens)) {
    if (value) root.style.setProperty(name, value);
  }
}
