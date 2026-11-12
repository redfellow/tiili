// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { gridFor, rowsOf } from "./layout";

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
    expect(rowsOf(Array.from({ length: n }, (_, i) => i)).map((r) => r.length)).toEqual(perRow);
  });

  it("Short last row stretches: 3 panes put two on top and one full-width below", () => {
    expect(gridFor(3).cells).toEqual([
      { row: 0, col: 0, colSpan: 1 },
      { row: 0, col: 1, colSpan: 1 },
      { row: 1, col: 0, colSpan: 2 },
    ]);
  });

  it("Close re-flows: 4 panes less one lay out as 3", () => {
    expect(rowsOf(["a", "b", "c", "d"].filter((p) => p !== "b"))).toEqual([["a", "c"], ["d"]]);
  });
});
