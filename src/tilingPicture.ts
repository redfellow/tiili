import { gridFor, type Grid, type TilingMode } from "./layout";

/** A tiling picture fits this box, in px. */
export const TILING_ICON_BOX = { width: 30, height: 18 };
/** The line box of a font with no measured metrics, in ems before the line height. */
const NORMAL_LINE_BOX = 1.2;

/** The window whose shape the Grid tile's picture follows: its inner size in px, and its terminal cell in px. */
export interface PictureWindow {
  width: number;
  height: number;
  cell: { width: number; height: number };
}

/**
 * The inner size, in px, of the terminal window the settings belong to: the `width` and `height` its settings
 * window's URL query `search` carries, else `inner`, the size of the window showing the dialogue.
 */
export function pictureWindowSize(search: string, inner: { width: number; height: number }): { width: number; height: number } {
  const params = new URLSearchParams(search);
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  return width > 0 && height > 0 ? { width, height } : inner;
}

/** A terminal cell of a font whose metrics are not known: half as wide as its line is high. */
export function fallbackCell(size: number, lineHeight: number): { width: number; height: number } {
  const line = size * NORMAL_LINE_BOX * lineHeight;
  return { width: line / 2, height: line };
}

/**
 * How seven panes tile in `mode`, and the box the picture is drawn in. With `shape`, Grid's grid is Grid mode's
 * choice for that window's size in cells, and the box has the window's shape, fitted within {@link TILING_ICON_BOX}.
 */
export function tilingPicture(mode: TilingMode, shape?: PictureWindow): { grid: Grid; width: number; height: number } {
  const fitted = mode === "grid" && shape && shape.width > 0 && shape.height > 0 ? shape : undefined;
  const area = fitted && { cols: fitted.width / fitted.cell.width, rows: fitted.height / fitted.cell.height };
  const grid = gridFor(7, mode, area);
  const aspect = fitted ? fitted.width / fitted.height : TILING_ICON_BOX.width / TILING_ICON_BOX.height;
  const wide = aspect >= TILING_ICON_BOX.width / TILING_ICON_BOX.height;
  const width = wide ? TILING_ICON_BOX.width : TILING_ICON_BOX.height * aspect;
  const height = wide ? TILING_ICON_BOX.width / aspect : TILING_ICON_BOX.height;
  return { grid, width, height };
}
