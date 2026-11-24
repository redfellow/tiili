/** Where one pane sits in the grid. `colSpan` is in grid columns; a short last row spans wider. */
export interface Cell {
  row: number;
  col: number;
  colSpan: number;
}

export interface Grid {
  cols: number;
  rows: number;
  /** One cell per pane, in pane order: left to right, top to bottom. */
  cells: Cell[];
}

/**
 * How panes are tiled: `grid` is as square as it gets, `wide` and `tall` lean towards more columns or more rows,
 * `columns` puts the panes side by side and `rows` stacks them.
 */
export const TILING_MODES = ["grid", "wide", "tall", "columns", "rows"] as const;
export type TilingMode = (typeof TILING_MODES)[number];

/** How many grid columns `n` panes get in `mode` when the pane area's size is not known. */
function columnsFor(n: number, mode: TilingMode): number {
  switch (mode) {
    case "columns":
      return n;
    case "rows":
      return 1;
    case "wide":
      return Math.ceil(n / Math.max(1, Math.floor(Math.sqrt(n))));
    case "tall":
      return Math.max(1, Math.floor(Math.sqrt(n)));
    default:
      return Math.ceil(Math.sqrt(n));
  }
}

/** The pane area's size in character cells, and the column count Grid mode chose for it last. */
export interface GridArea {
  cols: number;
  rows: number;
  /** Grid's current column count, kept unless another count is clearly better (hysteresis). */
  prev?: number;
}

/** The terminal shape a Grid pane aims for, in cells: 80 columns by 24 rows. */
const TARGET_ASPECT = 80 / 24;
/** Panes narrower than this many columns are avoided whenever another layout is possible. */
const MIN_PANE_COLS = 60;
/** What each empty grid cell adds to a layout's score. */
const EMPTY_CELL_PENALTY = 0.15;
/** How much better another column count must score before Grid leaves its current one: the shape is 15% past. */
const HYSTERESIS = Math.log(1.15);

/**
 * Grid mode's column count for `n` panes in `area`: each count c gives panes of area.cols / c by area.rows /
 * ceil(n / c) cells, scored by how far their shape is from 80×24 (|ln(aspect / (80 / 24))|) plus 0.15 per empty
 * cell; the lowest score wins. Counts that make panes under 60 columns wide are left out unless every count does.
 * `area.prev`, when it is still a candidate, is kept unless the best count scores better by more than ln(1.15).
 * An area with no size gives ceil(sqrt(n)).
 */
export function chooseGridColumns(n: number, area: GridArea): number {
  if (n <= 1 || !(area.cols > 0) || !(area.rows > 0)) return Math.max(1, Math.ceil(Math.sqrt(n)));
  const all = Array.from({ length: n }, (_, i) => i + 1);
  const wide = all.filter((c) => area.cols / c >= MIN_PANE_COLS);
  const candidates = wide.length > 0 ? wide : all;
  const score = (c: number) => {
    const r = Math.ceil(n / c);
    const aspect = area.cols / c / (area.rows / r);
    return Math.abs(Math.log(aspect / TARGET_ASPECT)) + EMPTY_CELL_PENALTY * (r * c - n);
  };
  let best = candidates[0];
  for (const c of candidates) if (score(c) < score(best)) best = c;
  const prev = area.prev;
  if (prev !== undefined && prev !== best && candidates.includes(prev) && score(prev) - score(best) <= HYSTERESIS) {
    return prev;
  }
  return best;
}

/**
 * The grid for `n` panes in `mode`, rows = ceil(n / columns), filled left to right, top to bottom. The panes of an
 * unfilled last row share the full width between them. In `grid` mode (the default) the columns fit `area`, the
 * pane area in cells (see {@link chooseGridColumns}), and are ceil(sqrt(n)) without it; the other modes ignore it.
 */
export function gridFor(n: number, mode: TilingMode = "grid", area?: GridArea): Grid {
  if (n <= 0) return { cols: 0, rows: 0, cells: [] };
  const cols = mode === "grid" && area ? chooseGridColumns(n, area) : columnsFor(n, mode);
  const rows = Math.ceil(n / cols);
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    cells.push({ row, col: i % cols, colSpan: cols / inRow });
  }
  return { cols, rows, cells };
}
