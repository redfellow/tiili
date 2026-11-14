import type { ISearchOptions } from "@xterm/addon-search";
import type { TokenReader } from "./theme";

/** The most matches the search addon highlights and counts; past it the count reads `1000+`. */
export const SEARCH_LIMIT = 1000;

/** How strongly brick shows through `--term-bg` on matches other than the active one. */
const MATCH_ALPHA = 0.4;

/** The decoration colours the search addon draws matches and their overview-ruler marks with. */
export type SearchDecorations = NonNullable<ISearchOptions["decorations"]>;

/**
 * The find bar's count: `<active>/<total>` with the 0-based `index` of the active match (`0/<total>` when none is
 * active), `0/0` with no match and `1000+` once the addon stopped counting at its limit.
 */
export function matchCountLabel(index: number, total: number, limitReached: boolean): string {
  if (limitReached) return `${SEARCH_LIMIT}+`;
  if (total <= 0) return "0/0";
  return `${index < 0 ? 0 : Math.min(index + 1, total)}/${total}`;
}

/** Whether `query` compiles as a regular expression, so a regex search can't throw. */
export function validRegex(query: string): boolean {
  try {
    new RegExp(query, "g");
    return true;
  } catch {
    return false;
  }
}

/** A `#RGB` or `#RRGGBB` colour as red, green and blue channels, or undefined for anything else. */
function channels(colour: string): [number, number, number] | undefined {
  const value = colour.trim();
  let hex: string;
  if (/^#[0-9a-f]{3}$/i.test(value)) hex = [...value.slice(1)].map((c) => c + c).join("");
  else if (/^#[0-9a-f]{6}$/i.test(value)) hex = value.slice(1);
  else return undefined;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function hex(rgb: number[]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * `fg` laid over `bg` at opacity `alpha` (0–1), as an opaque `#RRGGBB`, which the search addon needs. A colour that
 * isn't hex is returned as it came (`fg`), so a missing token never throws.
 */
export function blendHex(fg: string, bg: string, alpha: number): string {
  const top = channels(fg);
  const ground = channels(bg);
  if (!top || !ground) return fg;
  const a = Math.min(1, Math.max(0, alpha));
  return hex(top.map((c, i) => c * a + ground[i] * (1 - a)));
}

/** A hex colour as `#RRGGBB`, or the colour as it came when it isn't hex. */
function opaque(colour: string): string {
  const rgb = channels(colour);
  return rgb ? hex(rgb) : colour;
}

/**
 * The search highlights from the theme tokens: the active match in `--accent`, other matches in brick
 * (`--tiili-tiili`) blended into `--term-bg`, and overview-ruler marks in the same colours.
 */
export function searchDecorations(token: TokenReader): SearchDecorations {
  const active = opaque(token("--accent"));
  const match = blendHex(token("--tiili-tiili"), token("--term-bg"), MATCH_ALPHA);
  return {
    activeMatchBackground: active,
    activeMatchBorder: active,
    activeMatchColorOverviewRuler: active,
    matchBackground: match,
    matchOverviewRuler: match,
  };
}
