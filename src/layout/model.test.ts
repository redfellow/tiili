// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  addPane,
  changedPanes,
  emptyLayout,
  move,
  removePane,
  reset,
  resizeTrack,
  setMode,
  swap,
  type Axis,
  type Direction,
  type LayoutState,
} from "./model";

/** A layout with panes 1..n opened in order. */
function opened(n: number): LayoutState {
  let state = emptyLayout();
  for (let id = 1; id <= n; id++) state = addPane(state, id);
  return state;
}

function sizes(values: number[]) {
  return values.map((v) => expect.closeTo(v, 9));
}

describe("resizeTrack", () => {
  // [name, axis, divider, delta, min, expected sizes of that axis] on a 3×3 grid
  const cases: [string, Axis, number, number, number, number[]][] = [
    ["Divider drag resizes PTYs on release: column divider grows the left column", "col", 0, 0.1, 0.05, [1 / 3 + 0.1, 1 / 3 - 0.1, 1 / 3]],
    ["Divider drag resizes PTYs on release: row divider grows the lower row", "row", 1, -0.1, 0.05, [1 / 3, 1 / 3 - 0.1, 1 / 3 + 0.1]],
    ["Minimum size: dragging right stops at the right neighbour's minimum", "col", 1, 0.5, 0.1, [1 / 3, 1 / 3 + 1 / 3 - 0.1, 0.1]],
    ["Minimum size: dragging left stops at the left neighbour's minimum", "col", 0, -0.5, 0.1, [0.1, 2 / 3 - 0.1, 1 / 3]],
    ["A divider that does not exist changes nothing", "col", 2, 0.1, 0.05, [1 / 3, 1 / 3, 1 / 3]],
  ];
  it.each(cases)("%s", (_name, axis, divider, delta, min, expected) => {
    const next = resizeTrack(opened(9), axis, divider, delta, min);
    expect(axis === "col" ? next.colSizes : next.rowSizes).toEqual(sizes(expected));
    const other = axis === "col" ? next.rowSizes : next.colSizes;
    expect(other).toEqual(sizes([1 / 3, 1 / 3, 1 / 3]));
  });
});

describe("swap and move", () => {
  it("Drag swap: A and B exchange grid positions", () => {
    expect(swap(opened(4), 1, 4).order).toEqual([4, 2, 3, 1]);
  });

  // [name, panes, pane, direction, expected order]
  const cases: [string, number, number, Direction, number[]][] = [
    ["Keyboard move: right swaps with the right-hand neighbour", 4, 1, "right", [2, 1, 3, 4]],
    ["Keyboard move: down swaps with the pane below", 4, 2, "down", [1, 4, 3, 2]],
    ["Keyboard move: up swaps with the pane above", 4, 3, "up", [3, 2, 1, 4]],
    ["Keyboard move: left swaps with the left-hand neighbour", 4, 4, "left", [1, 2, 4, 3]],
    ["Edge of grid: left in the leftmost column does nothing", 4, 3, "left", [1, 2, 3, 4]],
    ["Edge of grid: right in the rightmost column does nothing", 4, 2, "right", [1, 2, 3, 4]],
    ["Edge of grid: up in the top row does nothing", 4, 1, "up", [1, 2, 3, 4]],
    ["Edge of grid: down in the bottom row does nothing", 4, 4, "down", [1, 2, 3, 4]],
    ["Edge of grid: right at the end of a short last row does nothing", 5, 5, "right", [1, 2, 3, 4, 5]],
    ["Short last row: down with no pane straight below swaps with its last pane", 5, 3, "down", [1, 2, 5, 4, 3]],
  ];
  it.each(cases)("%s", (_name, n, id, dir, expected) => {
    expect(move(opened(n), id, dir).order).toEqual(expected);
  });
});

describe("reset", () => {
  it("Reset: all rows and columns return to equal sizes", () => {
    let state = resizeTrack(opened(6), "col", 0, 0.2, 0.05);
    state = resizeTrack(state, "row", 0, -0.1, 0.05);
    const next = reset(state);
    expect(next.colSizes).toEqual(sizes([1 / 3, 1 / 3, 1 / 3]));
    expect(next.rowSizes).toEqual(sizes([0.5, 0.5]));
    expect(next.order).toEqual(state.order);
  });
});

describe("re-flow", () => {
  const resized = (n: number) => resizeTrack(resizeTrack(opened(n), "col", 0, 0.2, 0.05), "row", 0, 0.1, 0.05);

  // [name, panes before, change, expected cols, rows, column sizes, row sizes]
  const cases: [string, number, (s: LayoutState) => LayoutState, number, number, number[], number[]][] = [
    ["Same shape: a 2×2 grid gaining a pane keeps both axes", 3, (s) => addPane(s, 9), 2, 2, [0.7, 0.3], [0.6, 0.4]],
    ["Same shape: a 2×2 grid losing a pane keeps both axes", 4, (s) => removePane(s, 2), 2, 2, [0.7, 0.3], [0.6, 0.4]],
    ["Shape changes: 2×1 to 2×2 keeps the columns and evens the rows", 2, (s) => addPane(s, 9), 2, 2, [0.7, 0.3], [0.5, 0.5]],
    ["Shape changes: 2×2 to 3×2 evens the columns and keeps the rows", 4, (s) => addPane(s, 9), 3, 2, [1 / 3, 1 / 3, 1 / 3], [0.6, 0.4]],
    ["Shape changes: closing 2×2 to 2×1 keeps the columns and leaves one row", 3, (s) => removePane(s, 1), 2, 1, [0.7, 0.3], [1]],
  ];
  it.each(cases)("%s", (_name, n, change, cols, rows, colSizes, rowSizes) => {
    const next = change(resized(n));
    expect([next.cols, next.rows]).toEqual([cols, rows]);
    expect(next.colSizes).toEqual(sizes(colSizes));
    expect(next.rowSizes).toEqual(sizes(rowSizes));
  });

  // [name, panes, mode, expected cols, rows, column sizes, row sizes] after resizing in Grid mode
  const modeCases: [string, number, Parameters<typeof setMode>[1], number, number, number[], number[]][] = [
    ["Tiling mode sizes: 5 panes stacked are 1×5", 5, "rows", 1, 5, [1], [0.2, 0.2, 0.2, 0.2, 0.2]],
    ["Tiling mode sizes: 5 panes side by side are 5×1", 5, "columns", 5, 1, [0.2, 0.2, 0.2, 0.2, 0.2], [1]],
    ["Tiling mode sizes: 5 panes in a tall grid are 2×3", 5, "tall", 2, 3, [0.5, 0.5], [1 / 3, 1 / 3, 1 / 3]],
    ["Tiling mode sizes: 5 panes in a wide grid keep the 3×2 sizes", 5, "wide", 3, 2, [1 / 3 + 0.2, 1 / 3 - 0.2, 1 / 3], [0.6, 0.4]],
  ];
  it.each(modeCases)("%s", (_name, n, mode, cols, rows, colSizes, rowSizes) => {
    const before = resized(n);
    const next = setMode(before, mode);
    expect(next.mode).toBe(mode);
    expect(next.order).toEqual(before.order);
    expect([next.cols, next.rows]).toEqual([cols, rows]);
    expect(next.colSizes).toEqual(sizes(colSizes));
    expect(next.rowSizes).toEqual(sizes(rowSizes));
  });

  it("A mode set on an empty layout tiles the panes added later", () => {
    let state = emptyLayout("rows");
    for (let id = 1; id <= 3; id++) state = addPane(state, id);
    expect([state.cols, state.rows]).toEqual([1, 3]);
  });

  it("Close keeps the order of the remaining panes", () => {
    expect(removePane(opened(4), 2).order).toEqual([1, 3, 4]);
  });
});

describe("changedPanes", () => {
  const widened = (s: LayoutState) => resizeTrack(s, "col", 0, 0.1, 0.05);

  // [name, before, after, panes whose size changed]
  const cases: [string, LayoutState, LayoutState, number[]][] = [
    ["Divider drag resizes PTYs on release: a column divider changes only the panes in those columns", opened(9), widened(opened(9)), [1, 2, 4, 5, 7, 8]],
    ["A row divider changes only the panes in those rows", opened(9), resizeTrack(opened(9), "row", 1, 0.1, 0.05), [4, 5, 6, 7, 8, 9]],
    ["A column divider leaves a short last row alone", opened(5), widened(opened(5)), [1, 2]],
    ["Swapping panes of the same size changes no size", opened(4), swap(opened(4), 1, 4), []],
    ["Swapping into a wider column changes both sizes", widened(opened(4)), swap(widened(opened(4)), 1, 2), [2, 1]],
    ["A drag that ends where it started changes nothing", opened(4), resizeTrack(opened(4), "col", 0, 0, 0.05), []],
  ];
  it.each(cases)("%s", (_name, before, after, expected) => {
    expect(changedPanes(before, after)).toEqual(expected);
  });
});
