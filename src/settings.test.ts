// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, fontFamilyList, normalize, type Settings } from "./settings";

const font = DEFAULT_SETTINGS.font;
const withFont = (patch: Partial<Settings["font"]>): Settings => ({ ...DEFAULT_SETTINGS, font: { ...font, ...patch } });

const cases: [string, unknown, Settings][] = [
  ["missing file gives the defaults", null, DEFAULT_SETTINGS],
  ["not an object gives the defaults", "settings", DEFAULT_SETTINGS],
  ["empty object gives the defaults", {}, DEFAULT_SETTINGS],
  ["valid settings are kept", {
    theme: "koski",
    font: { family: "JetBrains Mono", size: 16, weight: 300, weightBold: 800, ligatures: true, lineHeight: 1.2, letterSpacing: 1 },
  }, {
    theme: "koski",
    font: { family: "JetBrains Mono", size: 16, weight: 300, weightBold: 800, ligatures: true, lineHeight: 1.2, letterSpacing: 1 },
  }],
  ["unknown theme id becomes System", { theme: "neon" }, DEFAULT_SETTINGS],
  ["theme of the wrong type becomes System", { theme: 3 }, DEFAULT_SETTINGS],
  ["Broken value: font size \"huge\" is the default, the rest loads", { theme: "nord", font: { size: "huge", family: "Iosevka" } },
    { theme: "nord", font: { ...font, family: "Iosevka" } }],
  ["size below range clamps to 8", { font: { size: 2 } }, withFont({ size: 8 })],
  ["size above range clamps to 32", { font: { size: 99 } }, withFont({ size: 32 })],
  ["NaN size is the default", { font: { size: Number.NaN } }, DEFAULT_SETTINGS],
  ["weight snaps to steps of 100", { font: { weight: 449 } }, withFont({ weight: 400 })],
  ["weight above range clamps to 900", { font: { weightBold: 1200 } }, withFont({ weightBold: 900 })],
  ["weight below range clamps to 100", { font: { weight: 0 } }, withFont({ weight: 100 })],
  ["weight of the wrong type is the default", { font: { weightBold: "bold" } }, DEFAULT_SETTINGS],
  ["line height clamps to 2.0", { font: { lineHeight: 3 } }, withFont({ lineHeight: 2 })],
  ["line height clamps to 1.0", { font: { lineHeight: 0.5 } }, withFont({ lineHeight: 1 })],
  ["letter spacing clamps to 5", { font: { letterSpacing: 12 } }, withFont({ letterSpacing: 5 })],
  ["letter spacing clamps to 0", { font: { letterSpacing: -1 } }, withFont({ letterSpacing: 0 })],
  ["ligatures of the wrong type is the default", { font: { ligatures: "yes" } }, DEFAULT_SETTINGS],
  ["empty family is Geist Mono", { font: { family: "   " } }, DEFAULT_SETTINGS],
  ["family of the wrong type is Geist Mono", { font: { family: 12 } }, DEFAULT_SETTINGS],
  ["family loses quotes and backslashes", { font: { family: "Fira\" Code\\" } }, withFont({ family: "Fira Code" })],
  ["font of the wrong type gives the default font", { theme: "dracula", font: [] }, { ...DEFAULT_SETTINGS, theme: "dracula" }],
];

describe("normalize", () => {
  it.each(cases)("%s", (_name, input, expected) => {
    expect(normalize(input)).toEqual(expected);
  });
});

const familyCases: [string, string, string][] = [
  ["Unavailable font: a chosen family falls back to Geist Mono", "JetBrains Mono", '"JetBrains Mono", "Geist Mono", monospace'],
  ["Unavailable font: Geist Mono itself is listed once", "Geist Mono", '"Geist Mono", monospace'],
];

describe("fontFamilyList", () => {
  it.each(familyCases)("%s", (_name, family, expected) => {
    expect(fontFamilyList(family)).toBe(expected);
  });
});
