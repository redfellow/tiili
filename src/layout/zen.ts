import { ZEN_WIDTH_RANGE } from "../settings";

/** The share of the window's pane area the Zen pane may take at most. */
export const ZEN_MAX_SHARE = 0.9;

/**
 * The Zen pane's width in CSS pixels: `columns` cells of `cellWidth` plus the pane's own `chrome` (padding and
 * border), never under 80 columns and never over 90% of `areaWidth`; the 90% cap wins in a narrow window.
 */
export function zenWidthPx(columns: number, cellWidth: number, areaWidth: number, chrome = 0): number {
  const cols = Math.max(ZEN_WIDTH_RANGE.min, columns);
  const wanted = cols * Math.max(0, cellWidth) + chrome;
  return Math.max(0, Math.min(wanted, ZEN_MAX_SHARE * areaWidth));
}

/** The Zen width in columns, 80–400, a pane `widthPx` wide holds at `cellWidth`: what an edge drag saves. */
export function zenColumns(widthPx: number, cellWidth: number, chrome = 0): number {
  if (!(cellWidth > 0)) return ZEN_WIDTH_RANGE.min;
  const cols = Math.round((widthPx - chrome) / cellWidth);
  return Math.min(ZEN_WIDTH_RANGE.max, Math.max(ZEN_WIDTH_RANGE.min, cols));
}
