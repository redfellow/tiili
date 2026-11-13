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

/** How many grid columns `n` panes get in `mode`. */
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

/**
 * The grid for `n` panes in `mode` (default `grid`: columns = ceil(sqrt(n))), rows = ceil(n / columns), filled
 * left to right, top to bottom. The panes of an unfilled last row share the full width between them.
 */
export function gridFor(n: number, mode: TilingMode = "grid"): Grid {
  if (n <= 0) return { cols: 0, rows: 0, cells: [] };
  const cols = columnsFor(n, mode);
  const rows = Math.ceil(n / cols);
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    cells.push({ row, col: i % cols, colSpan: cols / inRow });
  }
  return { cols, rows, cells };
}
