// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { gridFor, type TilingMode } from "./layout";

// [panes, columns, rows, panes in each row]
const cases: [number, number, number, number[]][] = [
  [0, 0, 0, []],
  [1, 1, 1, [1]],
  [2, 2, 1, [2]],
  [3, 2, 2, [2, 1]],
  [4, 2, 2, [2, 2]],
  [5, 3, 2, [3, 2]],
  [6, 3, 2, [3, 3]],
  [7, 3, 3, [3, 3, 1]],
  [8, 3, 3, [3, 3, 2]],
  [9, 3, 3, [3, 3, 3]],
  [10, 4, 3, [4, 4, 2]],
];

describe("gridFor", () => {
  it.each(cases)("Grid sizes: %i panes make %i×%i", (n, cols, rows, perRow) => {
    const grid = gridFor(n);
    expect([grid.cols, grid.rows]).toEqual([cols, rows]);
    expect(grid.cells).toHaveLength(n);
    // Filled left to right, top to bottom.
    grid.cells.forEach((cell, i) => {
      expect([cell.row, cell.col]).toEqual([Math.floor(i / cols), i % cols]);
    });
    // Short last row stretches: every row's panes together span the full width.
    perRow.forEach((count, row) => {
      const inRow = grid.cells.filter((cell) => cell.row === row);
      expect(inRow).toHaveLength(count);
      expect(inRow.reduce((sum, cell) => sum + cell.colSpan, 0)).toBeCloseTo(cols);
    });
  });

  // [mode, columns, rows] for 5 panes
  const modes: [TilingMode, number, number][] = [
    ["grid", 3, 2],
    ["wide", 3, 2],
    ["tall", 2, 3],
    ["columns", 5, 1],
    ["rows", 1, 5],
  ];
  it.each(modes)("Tiling mode sizes: 5 panes in %s make %i×%i", (mode, cols, rows) => {
    const grid = gridFor(5, mode);
    expect([grid.cols, grid.rows]).toEqual([cols, rows]);
    expect(grid.cells).toHaveLength(5);
  });

  it("Short last row stretches: 3 panes put two on top and one full-width below", () => {
    expect(gridFor(3).cells).toEqual([
      { row: 0, col: 0, colSpan: 1 },
      { row: 0, col: 1, colSpan: 1 },
      { row: 1, col: 0, colSpan: 2 },
    ]);
  });

  // Pane areas in cells: a portrait window about 790 px wide, a large portrait one, and a landscape one.
  const portrait = { cols: 98, rows: 70 };
  const tallPortrait = { cols: 150, rows: 112 };
  const landscape = { cols: 200, rows: 58 };
  // [name, panes, area, columns, rows]
  const fits: [string, number, { cols: number; rows: number }, number, number][] = [
    ["Portrait windows get rows: 2 panes in a 790 px portrait window", 2, portrait, 1, 2],
    ["Portrait windows get rows: 3 panes in a 790 px portrait window", 3, portrait, 1, 3],
    ["Portrait windows get rows: 4 panes in a 790 px portrait window", 4, portrait, 1, 4],
    ["Portrait windows get rows: 5 panes in a 790 px portrait window", 5, portrait, 1, 5],
    ["Portrait windows get rows: 7 panes in a 790 px portrait window", 7, portrait, 1, 7],
    ["Portrait windows get rows: 2 panes in a large portrait window", 2, tallPortrait, 1, 2],
    ["Portrait windows get rows: 3 panes in a large portrait window", 3, tallPortrait, 1, 3],
    ["Portrait windows get rows: 4 panes in a large portrait window", 4, tallPortrait, 1, 4],
    ["Portrait windows get rows: 5 panes in a large portrait window", 5, tallPortrait, 2, 3],
    ["Portrait windows get rows: 7 panes in a large portrait window", 7, tallPortrait, 2, 4],
    ["Grid sizes: 1 pane in a landscape window", 1, landscape, 1, 1],
    ["Grid sizes: 2 panes in a landscape window", 2, landscape, 2, 1],
    ["Grid sizes: 3 panes in a landscape window", 3, landscape, 2, 2],
    ["Grid sizes: 4 panes in a landscape window", 4, landscape, 2, 2],
    ["Grid sizes: 5 panes in a landscape window", 5, landscape, 3, 2],
    ["Grid sizes: 7 panes in a landscape window", 7, landscape, 3, 3],
    ["Grid sizes: 9 panes in a landscape window", 9, landscape, 3, 3],
    ["an area with no size keeps ceil(sqrt(n))", 5, { cols: 0, rows: 0 }, 3, 2],
  ];
  it.each(fits)("%s make %i×%i", (_name, n, area, cols, rows) => {
    const grid = gridFor(n, "grid", area);
    expect([grid.cols, grid.rows]).toEqual([cols, rows]);
    expect(grid.cells).toHaveLength(n);
  });

  it.each(modes)("Tiling mode sizes: 5 panes in %s ignore a portrait window unless Grid", (mode, cols, rows) => {
    const grid = gridFor(5, mode, tallPortrait);
    expect([grid.cols, grid.rows]).toEqual(mode === "grid" ? [2, 3] : [cols, rows]);
  });

  // [name, area with the current column count, columns] for 2 panes; one beside the other scores best above an
  // area of 10:3 cells, and the current layout stays until the score is ln(1.15) better.
  const hysteresis: [string, { cols: number; rows: number; prev?: number }, number][] = [
    ["Hysteresis: stacked panes stay stacked just past the threshold", { cols: 175, rows: 50, prev: 1 }, 1],
    ["Hysteresis: without a current layout the same area puts them side by side", { cols: 175, rows: 50 }, 2],
    ["Hysteresis: clearly past the threshold they go side by side", { cols: 180, rows: 50, prev: 1 }, 2],
    ["Hysteresis: side by side panes stay side by side just past the threshold", { cols: 160, rows: 50, prev: 2 }, 2],
    ["Hysteresis: without a current layout the same area stacks them", { cols: 160, rows: 50 }, 1],
    ["Hysteresis: clearly past the threshold they stack", { cols: 155, rows: 50, prev: 2 }, 1],
    ["Hysteresis: a current layout whose panes are too narrow is not kept", { cols: 98, rows: 20, prev: 2 }, 1],
  ];
  it.each(hysteresis)("%s", (_name, area, cols) => {
    expect(gridFor(2, "grid", area).cols).toBe(cols);
  });

  it("Close re-flows: 4 panes less one lay out as 3", () => {
    const rows = (n: number) => Array.from({ length: gridFor(n).rows }, (_, r) => gridFor(n).cells.filter((c) => c.row === r).length);
    expect(rows(4)).toEqual([2, 2]);
    expect(rows(["a", "b", "c", "d"].filter((p) => p !== "b").length)).toEqual([2, 1]);
  });
});
