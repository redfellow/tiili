// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { responsiveFont, type ResponsiveSettings } from "./responsive";

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
