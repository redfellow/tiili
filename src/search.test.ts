// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { blendHex, matchCountLabel, searchDecorations, validRegex } from "./search";

describe("matchCountLabel", () => {
  const cases: [string, number, number, boolean, string][] = [
    ["Count: the third of 17 shows 3/17", 2, 17, false, "3/17"],
    ["Count: no match shows 0/0", -1, 0, false, "0/0"],
    ["Count: past the limit shows 1000+", -1, 1000, true, "1000+"],
    ["Count: no active match shows 0 of the total", -1, 5, false, "0/5"],
  ];
  it.each(cases)("%s", (_name, index, total, limit, label) => {
    expect(matchCountLabel(index, total, limit)).toBe(label);
  });
});

describe("validRegex", () => {
  const cases: [string, string, boolean][] = [
    ["Invalid regex: ( is invalid", "(", false],
    ["Invalid regex: [a- is invalid", "[a-", false],
    ["Invalid regex: err(or)? is valid", "err(or)?", true],
    ["Invalid regex: empty is valid", "", true],
  ];
  it.each(cases)("%s", (_name, query, valid) => {
    expect(validRegex(query)).toBe(valid);
  });
});

describe("blendHex", () => {
  const cases: [string, string, string, number, string][] = [
    ["full opacity keeps the colour", "#A4472B", "#182023", 1, "#A4472B"],
    ["zero opacity is the ground", "#A4472B", "#182023", 0, "#182023"],
    ["half way between black and white", "#000000", "#FFFFFF", 0.5, "#808080"],
    ["short hex expands", "#fff", "#000", 1, "#FFFFFF"],
    ["a colour that isn't hex comes back as it was", "red", "#000000", 0.5, "red"],
  ];
  it.each(cases)("%s", (_name, fg, bg, alpha, expected) => {
    expect(blendHex(fg, bg, alpha)).toBe(expected);
  });
});

describe("searchDecorations", () => {
  const themes: [string, Record<string, string>][] = [
    ["light", { "--accent": "#A4472B", "--tiili-tiili": "#A4472B", "--term-bg": "#F6F1E9" }],
    ["dark", { "--accent": "#A4472B", "--tiili-tiili": "#A4472B", "--term-bg": "#182023" }],
    ["savi", { "--accent": "#C9764F", "--tiili-tiili": "#A4472B", "--term-bg": "#F3EEE7" }],
  ];
  it.each(themes)("Theme change: %s theme colours the matches from its tokens", (_name, tokens) => {
    const decorations = searchDecorations((name) => tokens[name] ?? "");
    const match = blendHex(tokens["--tiili-tiili"], tokens["--term-bg"], 0.4);
    expect(decorations).toMatchObject({
      activeMatchBackground: tokens["--accent"],
      activeMatchColorOverviewRuler: tokens["--accent"],
      matchBackground: match,
      matchOverviewRuler: match,
    });
    expect(decorations.matchBackground).toMatch(/^#[0-9A-F]{6}$/);
    expect(decorations.matchBackground).not.toBe(decorations.activeMatchBackground);
  });
});
