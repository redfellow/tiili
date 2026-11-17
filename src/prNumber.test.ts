// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { parsePrNumber } from "./prNumber";

describe("parsePrNumber", () => {
  it.each([
    ["a number with a newline", "123\n", "123"],
    ["a bare number", "7", "7"],
    ["empty output", "", ""],
    ["only whitespace", " \n", ""],
    ["an error message", "no pull requests found for branch", ""],
    ["a number with other text", "123 abc", ""],
    ["zero", "0", ""],
    ["json", '{"number":123}', ""],
  ])("%s", (_name, output, expected) => {
    expect(parsePrNumber(output)).toBe(expected);
  });
});
