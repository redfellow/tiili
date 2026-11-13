/** Text never shrinks below this many pixels, however small the pane. */
export const MIN_RESPONSIVE_SIZE = 7;

/** Line height never shrinks below this: xterm refuses anything under 1 ("lineHeight cannot be less than 1"). */
export const MIN_RESPONSIVE_LINE_HEIGHT = 1;

/** A zoomed pane's font size stays within these pixels. */
export const ZOOM_SIZE = { min: 6, max: 48 } as const;

/** The font size `size` with a pane's zoom offset `zoom` added, kept within ZOOM_SIZE. */
export function zoomedSize(size: number, zoom: number): number {
  return Math.min(ZOOM_SIZE.max, Math.max(ZOOM_SIZE.min, size + zoom));
}

/** How strongly text shrinks with pane size: 0 not at all, 1 in proportion to the pane's width, 2 twice as fast. */
export const RESPONSIVE_STRENGTH = { min: 0, max: 2, step: 0.05 } as const;

export interface ResponsiveSettings {
  enabled: boolean;
  strength: number;
}

interface Dimensions {
  width: number;
  height: number;
}

/** The line height shrinks this much faster than the size, and letter spacing tightens by this many px per unit. */
const LINE_HEIGHT_BOOST = 1.3;
const LETTER_TIGHTEN = 0.4;

/**
 * The font size, line height and letter spacing for a pane of `pane` pixels in a tiled area of `area` pixels. A
 * pane that fills the area keeps the chosen values. A smaller pane has `drop = strength * (1 - r)`, where `r` is
 * the pane's linear scale (the square root of its share of the area). The size scales by `1 - drop`, down to
 * MIN_RESPONSIVE_SIZE px. The line height's excess over MIN_RESPONSIVE_LINE_HEIGHT (1) scales a little faster
 * (`1 - 1.3 * drop`), down to that minimum, the tightest line height xterm allows. Letter spacing scales by `1 - drop` and tightens
 * very slightly more (0.4 px per unit of drop), never below -2 px.
 */
export function responsiveFont(
  font: { size: number; lineHeight: number; letterSpacing: number },
  responsive: ResponsiveSettings,
  pane: Dimensions,
  area: Dimensions,
): { size: number; lineHeight: number; letterSpacing: number } {
  const fixed = { size: font.size, lineHeight: font.lineHeight, letterSpacing: font.letterSpacing };
  if (!responsive.enabled || pane.width <= 0 || pane.height <= 0 || area.width <= 0 || area.height <= 0) return fixed;
  const scale = Math.min(1, Math.sqrt((pane.width * pane.height) / (area.width * area.height)));
  const drop = responsive.strength * (1 - scale);
  const factor = Math.max(0, 1 - drop);
  const lineFactor = Math.max(0, 1 - LINE_HEIGHT_BOOST * drop);
  const floor = Math.min(font.size, MIN_RESPONSIVE_SIZE);
  return {
    size: Math.max(floor, Math.round(font.size * factor * 2) / 2),
    lineHeight: Math.max(
      Math.min(font.lineHeight, MIN_RESPONSIVE_LINE_HEIGHT),
      Math.round((MIN_RESPONSIVE_LINE_HEIGHT + (font.lineHeight - MIN_RESPONSIVE_LINE_HEIGHT) * lineFactor) * 100) / 100,
    ),
    letterSpacing: drop === 0 ? font.letterSpacing : Math.max(-2, Math.round((font.letterSpacing * factor - LETTER_TIGHTEN * drop) * 100) / 100),
  };
}
