// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { chipLabel, folderName } from "./paneChip";

// [path, folder name the neutral chip shows]
const cases: [string, string][] = [
  ["/Users/red/Downloads", "Downloads"],
  ["C:\\Users\\red\\Downloads", "Downloads"],
  ["/Users/red/Downloads/", "Downloads"],
  ["C:\\Users\\red\\", "red"],
  ["/", "/"],
  ["C:\\", "C:\\"],
];

describe("folderName", () => {
  it.each(cases)("Outside a repository: %s shows as %s", (path, expected) => {
    expect(folderName(path)).toBe(expected);
  });
});

// [place, command, chip label]
const labels: [string, string | undefined, string][] = [
  ["red", "zsh", "red · zsh"],
  ["red", "top", "red · top"],
  ["tiili", "vim notes.md", "tiili · vim notes.md"],
  ["red", undefined, "red"],
  ["red", "", "red"],
];

describe("chipLabel", () => {
  it.each(labels)("Program running: %s with %s reads %s", (place, command, expected) => {
    expect(chipLabel(place, command)).toBe(expected);
  });
});
