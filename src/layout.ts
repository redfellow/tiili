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
 * The grid for `n` panes: columns = ceil(sqrt(n)), rows = ceil(n / columns), filled left to right,
 * top to bottom. The panes of an unfilled last row share the full width between them.
 */
export function gridFor(n: number): Grid {
  if (n <= 0) return { cols: 0, rows: 0, cells: [] };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    cells.push({ row, col: i % cols, colSpan: cols / inRow });
  }
  return { cols, rows, cells };
}

/** The panes of each row, in order: the shape the DOM renders, one flex row per grid row. */
export function rowsOf<T>(items: T[]): T[][] {
  const { cols, rows } = gridFor(items.length);
  return Array.from({ length: rows }, (_, r) => items.slice(r * cols, (r + 1) * cols));
}
