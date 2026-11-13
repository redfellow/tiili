// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { responsiveFont, zoomedSize, type ResponsiveSettings } from "./responsive";

const area = { width: 800, height: 600 };
const quarter = { width: 400, height: 300 };
const tiny = { width: 8, height: 6 };
const on: ResponsiveSettings = { enabled: true, strength: 0.5 };
const font = { size: 14, lineHeight: 1.2, letterSpacing: 1 };

// [name, font, responsive, pane, expected]
const cases: [string, typeof font, ResponsiveSettings, { width: number; height: number }, typeof font][] = [
  ["A full pane keeps the chosen values", font, on, area, font],
  ["Small pane shrinks text: a quarter pane at strength 0.5 draws size 14 at 10.5 px", font, on, quarter,
    { size: 10.5, lineHeight: 1.14, letterSpacing: 0.65 }],
  ["Responsive text off: a quarter pane keeps the chosen values", font, { enabled: false, strength: 0.5 }, quarter, font],
  ["Strength 0 keeps the chosen values", font, { enabled: true, strength: 0 }, quarter, font],
  ["The size never drops below 7 px and the line height below 1", font, { enabled: true, strength: 2 }, tiny,
    { size: 7, lineHeight: 1, letterSpacing: -0.79 }],
  ["Negative letter spacing shrinks towards 0 and tightens slightly", { ...font, letterSpacing: -2 }, on, quarter,
    { size: 10.5, lineHeight: 1.14, letterSpacing: -1.6 }],
  ["A size already under 7 px is not raised", { ...font, size: 6 }, { enabled: true, strength: 2 }, tiny,
    { size: 6, lineHeight: 1, letterSpacing: -0.79 }],
  ["A pane with no size keeps the chosen values", font, on, { width: 0, height: 0 }, font],
];

describe("responsiveFont", () => {
  it.each(cases)("%s", (_name, chosen, responsive, pane, expected) => {
    expect(responsiveFont(chosen, responsive, pane, area)).toEqual(expected);
  });
});

// [name, size, zoom offset, expected size]
const zoomCases: [string, number, number, number][] = [
  ["Zoom in one pane: 14 zoomed in twice draws at 16", 14, 2, 16],
  ["Zoom in one pane: 14 zoomed out three times draws at 11", 14, -3, 11],
  ["Zoom stops at 48 px", 32, 20, 48],
  ["Zoom stops at 6 px", 8, -5, 6],
];

describe("zoomedSize", () => {
  it.each(zoomCases)("%s", (_name, size, zoom, expected) => {
    expect(zoomedSize(size, zoom)).toBe(expected);
  });
});
