// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, fontFamilyList, normalize, type Settings } from "./settings";

const font = DEFAULT_SETTINGS.font;
const withFont = (patch: Partial<Settings["font"]>): Settings => ({ ...DEFAULT_SETTINGS, font: { ...font, ...patch } });
const withCursor = (patch: Partial<Settings["cursor"]>): Settings => ({
  ...DEFAULT_SETTINGS,
  cursor: { ...DEFAULT_SETTINGS.cursor, ...patch },
});

const withInactive = (patch: Partial<Settings["inactive"]>): Settings => ({
  ...DEFAULT_SETTINGS,
  inactive: { ...DEFAULT_SETTINGS.inactive, ...patch },
});

const withResponsive = (patch: Partial<Settings["responsive"]>): Settings => ({
  ...DEFAULT_SETTINGS,
  responsive: { ...DEFAULT_SETTINGS.responsive, ...patch },
});

const cases: [string, unknown, Settings][] = [
  ["missing file gives the defaults", null, DEFAULT_SETTINGS],
  ["not an object gives the defaults", "settings", DEFAULT_SETTINGS],
  ["empty object gives the defaults", {}, DEFAULT_SETTINGS],
  ["valid settings are kept", {
    theme: "nord",
    font: { family: "JetBrains Mono", size: 16, weight: 310, weightBold: 800, ligatures: true, lineHeight: 1.2, letterSpacing: 1.5 },
    cursor: { style: "bar", blink: false },
    tiling: { layout: "tall" },
    responsive: { enabled: false, strength: 1.25 },
    behaviour: { hoverHighlight: false, startupSplash: false },
    inactive: { opacity: 0.5, desaturate: true },
    appIcon: "dark",
    prompt: "tiili",
    updates: { autoCheck: false },
  }, {
    theme: "nord",
    font: { family: "JetBrains Mono", size: 16, weight: 310, weightBold: 800, ligatures: true, lineHeight: 1.2, letterSpacing: 1.5 },
    cursor: { style: "bar", blink: false },
    tiling: { layout: "tall" },
    responsive: { enabled: false, strength: 1.25 },
    behaviour: { hoverHighlight: false, startupSplash: false },
    inactive: { opacity: 0.5, desaturate: true },
    appIcon: "dark",
    prompt: "tiili",
    updates: { autoCheck: false },
  }],
  ["Koski by default: unknown theme id becomes Koski", { theme: "neon" }, DEFAULT_SETTINGS],
  ["Koski by default: theme of the wrong type becomes Koski", { theme: 3 }, DEFAULT_SETTINGS],
  ["Saved theme survives the new default: Nord with no cursor keeps Nord and a blinking Brick",
    { theme: "nord", font: { family: "Geist Mono" } }, { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["missing cursor gives the default cursor", { theme: "koski", font }, DEFAULT_SETTINGS],
  ["Invalid saved cursor: style \"beam\" is a Brick, blink still loads", { cursor: { style: "beam", blink: false } },
    withCursor({ style: "block", blink: false })],
  ["cursor blink of the wrong type is the default", { cursor: { style: "underline", blink: "yes" } },
    withCursor({ style: "underline", blink: true })],
  ["cursor of the wrong type gives the default cursor", { cursor: "bar" }, DEFAULT_SETTINGS],
  ["Broken value: font size \"huge\" is the default, the rest loads", { theme: "nord", font: { size: "huge", family: "Iosevka" } },
    { ...DEFAULT_SETTINGS, theme: "nord", font: { ...font, family: "Iosevka" } }],
  ["size below range clamps to 8", { font: { size: 2 } }, withFont({ size: 8 })],
  ["size above range clamps to 32", { font: { size: 99 } }, withFont({ size: 32 })],
  ["NaN size is the default", { font: { size: Number.NaN } }, DEFAULT_SETTINGS],
  ["weight snaps to steps of 10", { font: { weight: 444 } }, withFont({ weight: 440 })],
  ["weight above range clamps to 900", { font: { weightBold: 1200 } }, withFont({ weightBold: 900 })],
  ["weight below range clamps to 100", { font: { weight: 0 } }, withFont({ weight: 100 })],
  ["weight of the wrong type is the default", { font: { weightBold: "bold" } }, DEFAULT_SETTINGS],
  ["line height clamps to 2.0", { font: { lineHeight: 3 } }, withFont({ lineHeight: 2 })],
  ["line height clamps to 1.0", { font: { lineHeight: 0.5 } }, withFont({ lineHeight: 1 })],
  ["letter spacing clamps to 5", { font: { letterSpacing: 12 } }, withFont({ letterSpacing: 5 })],
  ["letter spacing clamps to -2", { font: { letterSpacing: -7 } }, withFont({ letterSpacing: -2 })],
  ["Negative letter spacing: -1 is kept", { font: { letterSpacing: -1 } }, withFont({ letterSpacing: -1 })],
  ["letter spacing snaps to steps of 0.1", { font: { letterSpacing: 0.33 } }, withFont({ letterSpacing: 0.3 })],
  ["ligatures of the wrong type is the default", { font: { ligatures: "yes" } }, DEFAULT_SETTINGS],
  ["empty family is Geist Mono", { font: { family: "   " } }, DEFAULT_SETTINGS],
  ["family of the wrong type is Geist Mono", { font: { family: 12 } }, DEFAULT_SETTINGS],
  ["family loses quotes and backslashes", { font: { family: "Fira\" Code\\" } }, withFont({ family: "Fira Code" })],
  ["Invalid saved inactive settings: opacity \"dim\" is 0.82, highlight 3 is on, the rest loads",
    { theme: "nord", inactive: { opacity: "dim", desaturate: true }, behaviour: { hoverHighlight: 3 } },
    { ...DEFAULT_SETTINGS, theme: "nord", inactive: { opacity: 0.82, desaturate: true } }],
  ["Splash off survives a reload", { behaviour: { startupSplash: false } },
    { ...DEFAULT_SETTINGS, behaviour: { hoverHighlight: true, startupSplash: false } }],
  ["Splash setting of the wrong type plays the splash", { behaviour: { hoverHighlight: false, startupSplash: "no" } },
    { ...DEFAULT_SETTINGS, behaviour: { hoverHighlight: false, startupSplash: true } }],
  ["missing inactive and behaviour give their defaults", { theme: "koski" }, DEFAULT_SETTINGS],
  ["inactive and behaviour of the wrong type give their defaults", { inactive: [], behaviour: "on" }, DEFAULT_SETTINGS],
  ["inactive opacity below range clamps to 0.3", { inactive: { opacity: 0.1 } }, withInactive({ opacity: 0.3 })],
  ["inactive opacity above range clamps to 1", { inactive: { opacity: 1.5 } }, withInactive({ opacity: 1 })],
  ["inactive opacity snaps to steps of 0.01", { inactive: { opacity: 0.456 } }, withInactive({ opacity: 0.46 })],
  ["desaturate of the wrong type is the default", { inactive: { desaturate: "yes" } }, DEFAULT_SETTINGS],
  ["Dock icon follows the system by default", { theme: "nord" }, { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["Dock icon pinned to light is kept", { appIcon: "light" }, { ...DEFAULT_SETTINGS, appIcon: "light" }],
  ["unknown Dock icon follows the system", { appIcon: "sepia" }, DEFAULT_SETTINGS],
  ["Dock icon of the wrong type follows the system", { appIcon: 1 }, DEFAULT_SETTINGS],
  ["Invalid saved tiling: layout \"spiral\" is Grid, the rest loads", { theme: "nord", tiling: { layout: "spiral" } },
    { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["missing tiling and responsive give their defaults", { theme: "koski" }, DEFAULT_SETTINGS],
  ["tiling and responsive of the wrong type give their defaults", { tiling: "rows", responsive: 1 }, DEFAULT_SETTINGS],
  ["responsive on of the wrong type is on", { responsive: { enabled: "no", strength: 1 } }, withResponsive({ strength: 1 })],
  ["responsive strength \"strong\" is 0.5", { responsive: { enabled: false, strength: "strong" } },
    withResponsive({ enabled: false })],
  ["responsive strength above range clamps to 2", { responsive: { strength: 9 } }, withResponsive({ strength: 2 })],
  ["responsive strength below range clamps to 0", { responsive: { strength: -1 } }, withResponsive({ strength: 0 })],
  ["Prompt is off by default", { theme: "nord" }, { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["Classic prompt is kept", { prompt: "classic" }, { ...DEFAULT_SETTINGS, prompt: "classic" }],
  ["Minimal prompt is kept", { prompt: "minimal" }, { ...DEFAULT_SETTINGS, prompt: "minimal" }],
  ["Tiili prompt is kept", { prompt: "tiili" }, { ...DEFAULT_SETTINGS, prompt: "tiili" }],
  ["unknown prompt is off, the rest loads", { theme: "nord", prompt: "powerline" }, { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["prompt of the wrong type is off", { prompt: true }, DEFAULT_SETTINGS],
  ["Invalid saved update setting: automatic check \"yes\" is on, the rest loads",
    { theme: "nord", updates: { autoCheck: "yes" } }, { ...DEFAULT_SETTINGS, theme: "nord" }],
  ["updates of the wrong type give automatic checks on", { updates: false }, DEFAULT_SETTINGS],
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
