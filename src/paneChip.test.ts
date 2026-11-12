// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { folderName } from "./paneChip";

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
