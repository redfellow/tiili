// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { paneTint } from "./tints";

// The assigning itself (order, least used, remote keys) is tested where it lives, in src-tauri/src/tints.rs.
// [case, the report's tint, the pane's tint]
const cases: [string, number | null | undefined, number | undefined][] = [
  ["Same repository in two windows: the pane takes the tint the core assigned", 3, 3],
  ["First and last tints", 1, 1],
  ["Sixteenth tint", 16, 16],
  ["Outside a repository: untinted", null, undefined],
  ["Report without a tint: untinted", undefined, undefined],
  ["No tint 0", 0, undefined],
  ["No tint past the sixteenth", 17, undefined],
  ["No fractional tint", 2.5, undefined],
];

describe("paneTint", () => {
  it.each(cases)("%s", (_, tint, expected) => {
    expect(paneTint({ tint })).toBe(expected);
  });
});
