/** Every theme a user can choose; `system` follows the OS between tiili Light and tiili Dark. */
export const THEME_IDS = [
  "system",
  "tiili-light",
  "tiili-dark",
  "savi",
  "muratti",
  "koski",
  "laasti",
  "solarized-light",
  "solarized-dark",
  "gruvbox-dark",
  "nord",
  "dracula",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface FontSettings {
  /** An installed font's name; Geist Mono stands in when it is missing. */
  family: string;
  /** Pixels, 8–32. */
  size: number;
  /** 100–900 in steps of 10. */
  weight: number;
  /** 100–900 in steps of 10. */
  weightBold: number;
  ligatures: boolean;
  /** 1.0–2.0. */
  lineHeight: number;
  /** Pixels, -2–5. */
  letterSpacing: number;
}

/** The cursor's shape: the brick block, an underline or a bar. */
export const CURSOR_STYLES = ["block", "underline", "bar"] as const;
export type CursorStyle = (typeof CURSOR_STYLES)[number];

export interface CursorSettings {
  style: CursorStyle;
  blink: boolean;
}

export interface Settings {
  theme: ThemeId;
  font: FontSettings;
  cursor: CursorSettings;
}

export const DEFAULT_FONT_FAMILY = "Geist Mono";

/** The CSS font-family list for a chosen font: the font, then Geist Mono when it isn't installed. */
export function fontFamilyList(family: string): string {
  return family === DEFAULT_FONT_FAMILY
    ? `"${DEFAULT_FONT_FAMILY}", monospace`
    : `"${family}", "${DEFAULT_FONT_FAMILY}", monospace`;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "koski",
  font: {
    family: DEFAULT_FONT_FAMILY,
    size: 14,
    weight: 100,
    weightBold: 700,
    ligatures: false,
    lineHeight: 1.0,
    letterSpacing: 0,
  },
  cursor: { style: "block", blink: true },
};

/** Allowed range of each numeric font setting and the step values snap to. */
export const FONT_RANGES = {
  size: { min: 8, max: 32, step: 1 },
  weight: { min: 100, max: 900, step: 10 },
  weightBold: { min: 100, max: 900, step: 10 },
  lineHeight: { min: 1.0, max: 2.0, step: 0.05 },
  letterSpacing: { min: -2, max: 5, step: 0.1 },
} as const;

const MAX_FAMILY_LENGTH = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function number(value: unknown, fallback: number, range: { min: number; max: number; step: number }): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const snapped = Math.round(clamped / range.step) * range.step;
  // Round away floating-point noise from the snap, e.g. 1.2000000000000002.
  return Number(snapped.toFixed(2));
}

function family(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_FONT_FAMILY;
  // The name is quoted inside a CSS font-family list, so quotes and backslashes can't be part of it.
  const name = value.replace(/["\\]/g, "").trim().slice(0, MAX_FAMILY_LENGTH);
  return name || DEFAULT_FONT_FAMILY;
}

/**
 * Settings from anything read back from disk or a form: each field that is missing or of the wrong type gets its
 * default, numbers are clamped to their range and snapped to their step, and an unknown theme becomes Koski.
 */
export function normalize(value: unknown): Settings {
  const raw = isRecord(value) ? value : {};
  const font = isRecord(raw.font) ? raw.font : {};
  const defaults = DEFAULT_SETTINGS.font;
  const cursor = isRecord(raw.cursor) ? raw.cursor : {};
  return {
    theme: THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : DEFAULT_SETTINGS.theme,
    font: {
      family: family(font.family),
      size: number(font.size, defaults.size, FONT_RANGES.size),
      weight: number(font.weight, defaults.weight, FONT_RANGES.weight),
      weightBold: number(font.weightBold, defaults.weightBold, FONT_RANGES.weightBold),
      ligatures: typeof font.ligatures === "boolean" ? font.ligatures : defaults.ligatures,
      lineHeight: number(font.lineHeight, defaults.lineHeight, FONT_RANGES.lineHeight),
      letterSpacing: number(font.letterSpacing, defaults.letterSpacing, FONT_RANGES.letterSpacing),
    },
    cursor: {
      style: CURSOR_STYLES.includes(cursor.style as CursorStyle)
        ? (cursor.style as CursorStyle)
        : DEFAULT_SETTINGS.cursor.style,
      blink: typeof cursor.blink === "boolean" ? cursor.blink : DEFAULT_SETTINGS.cursor.blink,
    },
  };
}
