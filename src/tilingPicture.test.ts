// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import type { TilingMode } from "./layout";
import { fallbackCell, pictureWindowSize, tilingPicture } from "./tilingPicture";

const portrait = { width: 790, height: 1180 };
const landscape = { width: 1600, height: 900 };

describe("pictureWindowSize", () => {
  // [name, URL query, size of the window showing the dialogue, expected size]
  const cases: [string, string, { width: number; height: number }, { width: number; height: number }][] = [
    ["Settings picture follows the window: the settings window's URL carries the opening window's size", "?settings=main&width=790&height=1180", landscape, portrait],
    ["Settings picture follows the window: with no size in the URL the dialogue's own window is used", "", portrait, portrait],
    ["Settings picture follows the window: a URL size of 0 falls back to the dialogue's own window", "?settings=main&width=0&height=1180", landscape, landscape],
  ];
  it.each(cases)("%s", (_name, search, inner, expected) => {
    expect(pictureWindowSize(search, inner)).toEqual(expected);
  });
});

describe("tilingPicture", () => {
  const halfCell = { width: 8, height: 16 };
  // [name, mode, window, columns, rows, box portrait]
  const cases: [string, TilingMode, { width: number; height: number } | undefined, number, number, boolean][] = [
    ["Settings picture follows the window: a portrait window's Grid picture is one column of seven rows", "grid", portrait, 1, 7, true],
    ["Settings picture follows the window: a landscape window's Grid picture is 3×3", "grid", landscape, 3, 3, false],
    ["Settings picture follows the window: without a window Grid keeps 3×3", "grid", undefined, 3, 3, false],
    ["Settings picture follows the window: Stacked ignores the window's shape", "rows", landscape, 1, 7, false],
  ];
  it.each(cases)("%s", (_name, mode, size, cols, rows, tall) => {
    const picture = tilingPicture(mode, size && { ...size, cell: halfCell });
    expect([picture.grid.cols, picture.grid.rows]).toEqual([cols, rows]);
    expect(picture.height > picture.width).toBe(tall);
    if (mode === "grid" && size) expect(picture.width / picture.height).toBeCloseTo(size.width / size.height);
  });

  it("Settings picture follows the window: with no URL size and no font metrics a portrait dialogue still draws rows", () => {
    const cell = fallbackCell(14, 1);
    expect(cell.width / cell.height).toBe(0.5);
    const picture = tilingPicture("grid", { ...pictureWindowSize("", portrait), cell });
    expect([picture.grid.cols, picture.grid.rows]).toEqual([1, 7]);
    expect(picture.height > picture.width).toBe(true);
  });
});
