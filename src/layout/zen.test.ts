// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { zenColumns, zenWidthPx } from "./zen";

const widthCases: [string, number, number, number, number, number][] = [
  // name, columns, cell width, area width, chrome, expected px
  ["140 columns fit a wide area", 140, 8, 2000, 10, 1130],
  ["Width clamp: a narrow area caps the pane at 90%", 140, 8, 1000, 10, 900],
  ["fewer than 80 columns widen to 80", 40, 8, 2000, 0, 640],
  ["the 90% cap wins over the 80-column minimum", 80, 8, 500, 0, 450],
  ["a larger font widens the pane", 140, 10, 2000, 0, 1400],
  ["no area gives no width", 140, 8, 0, 0, 0],
];

describe("zenWidthPx", () => {
  it.each(widthCases)("%s", (_name, columns, cell, area, chrome, expected) => {
    expect(zenWidthPx(columns, cell, area, chrome)).toBe(expected);
  });
});

const columnCases: [string, number, number, number, number][] = [
  // name, width px, cell width, chrome, expected columns
  ["Drag widens: 1610 px at 8 px cells is 200 columns", 1610, 8, 10, 200],
  ["rounds to whole columns", 1203, 8, 0, 150],
  ["never under 80 columns", 100, 8, 0, 80],
  ["never over 400 columns", 9000, 8, 0, 400],
  ["no cell width gives 80 columns", 1000, 0, 0, 80],
];

describe("zenColumns", () => {
  it.each(columnCases)("%s", (_name, width, cell, chrome, expected) => {
    expect(zenColumns(width, cell, chrome)).toBe(expected);
  });
});
