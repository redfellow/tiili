import { gridFor } from "../layout";

export type PaneId = number;
export type Axis = "col" | "row";
export type Direction = "left" | "right" | "up" | "down";

/**
 * The tiled layout: panes in grid order (left to right, top to bottom) and the size of each grid column and
 * row as fractions that sum to 1. The panes of a short last row share its full width equally.
 */
export interface LayoutState {
  order: PaneId[];
  cols: number;
  rows: number;
  colSizes: number[];
  rowSizes: number[];
}

/** Where a pane sits, as fractions of the whole grid. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPSILON = 1e-9;

function equal(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

/** An empty layout. */
export function emptyLayout(): LayoutState {
  return { order: [], cols: 0, rows: 0, colSizes: [], rowSizes: [] };
}

/** `order` laid out on the automatic grid, keeping `prev`'s sizes for each axis whose track count is unchanged. */
function reflow(prev: LayoutState, order: PaneId[]): LayoutState {
  const { cols, rows } = gridFor(order.length);
  return {
    order,
    cols,
    rows,
    colSizes: cols === prev.cols ? prev.colSizes : equal(cols),
    rowSizes: rows === prev.rows ? prev.rowSizes : equal(rows),
  };
}

/** Adds pane `id` after the others. */
export function addPane(state: LayoutState, id: PaneId): LayoutState {
  return reflow(state, [...state.order, id]);
}

/** Removes pane `id`; the panes after it move up one place. */
export function removePane(state: LayoutState, id: PaneId): LayoutState {
  return reflow(
    state,
    state.order.filter((p) => p !== id),
  );
}

/** Every row and column back to equal sizes. */
export function reset(state: LayoutState): LayoutState {
  return { ...state, colSizes: equal(state.cols), rowSizes: equal(state.rows) };
}

/**
 * Moves the divider after track `dividerIndex` of `axis` by `delta` (a fraction of the whole), growing one
 * neighbour and shrinking the other; neither neighbour goes below `min`.
 */
export function resizeTrack(
  state: LayoutState,
  axis: Axis,
  dividerIndex: number,
  delta: number,
  min: number,
): LayoutState {
  const sizes = axis === "col" ? state.colSizes : state.rowSizes;
  if (dividerIndex < 0 || dividerIndex + 1 >= sizes.length) return state;
  const before = sizes[dividerIndex];
  const after = sizes[dividerIndex + 1];
  const lo = Math.min(0, min - before);
  const hi = Math.max(0, after - min);
  const d = Math.min(hi, Math.max(lo, delta));
  const next = [...sizes];
  next[dividerIndex] = before + d;
  next[dividerIndex + 1] = after - d;
  return axis === "col" ? { ...state, colSizes: next } : { ...state, rowSizes: next };
}

/** Panes `a` and `b` exchange places. */
export function swap(state: LayoutState, a: PaneId, b: PaneId): LayoutState {
  const i = state.order.indexOf(a);
  const j = state.order.indexOf(b);
  if (i < 0 || j < 0 || i === j) return state;
  const order = [...state.order];
  order[i] = b;
  order[j] = a;
  return { ...state, order };
}

/** The pane next to `id` in direction `dir`, or undefined at the edge of the grid. */
export function neighbour(state: LayoutState, id: PaneId, dir: Direction): PaneId | undefined {
  const i = state.order.indexOf(id);
  if (i < 0) return undefined;
  const n = state.order.length;
  const row = Math.floor(i / state.cols);
  const col = i % state.cols;
  let j: number | undefined;
  if (dir === "left" && col > 0) j = i - 1;
  else if (dir === "right" && col < state.cols - 1 && i + 1 < n) j = i + 1;
  else if (dir === "up" && row > 0) j = i - state.cols;
  // A short last row may have no pane straight below; its last pane is the one below then.
  else if (dir === "down" && row < state.rows - 1) j = Math.min(i + state.cols, n - 1);
  return j === undefined ? undefined : state.order[j];
}

/** Swaps pane `id` with its neighbour in direction `dir`; at the edge of the grid nothing changes. */
export function move(state: LayoutState, id: PaneId, dir: Direction): LayoutState {
  const other = neighbour(state, id, dir);
  return other === undefined ? state : swap(state, id, other);
}

function offset(sizes: number[], index: number): number {
  return sizes.slice(0, index).reduce((sum, s) => sum + s, 0);
}

/** Each pane's box, keyed by pane. */
export function boxes(state: LayoutState): Map<PaneId, Box> {
  const result = new Map<PaneId, Box>();
  const n = state.order.length;
  state.order.forEach((id, i) => {
    const row = Math.floor(i / state.cols);
    const col = i % state.cols;
    const y = offset(state.rowSizes, row);
    const h = state.rowSizes[row];
    const inRow = Math.min(state.cols, n - row * state.cols);
    if (inRow < state.cols) {
      result.set(id, { x: col / inRow, y, w: 1 / inRow, h });
    } else {
      result.set(id, { x: offset(state.colSizes, col), y, w: state.colSizes[col], h });
    }
  });
  return result;
}

/** The panes whose size differs between `before` and `after`: the ones whose terminal needs a new size. */
export function changedPanes(before: LayoutState, after: LayoutState): PaneId[] {
  const was = boxes(before);
  const now = boxes(after);
  return after.order.filter((id) => {
    const a = was.get(id);
    const b = now.get(id);
    return !a || !b || Math.abs(a.w - b.w) > EPSILON || Math.abs(a.h - b.h) > EPSILON;
  });
}
