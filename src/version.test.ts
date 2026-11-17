// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { settingsVersionLabel } from "./version";

describe("settingsVersionLabel", () => {
  it.each([
    ["Dev build with a pull request: the footer adds the PR number", "dev build", "123", "dev build · PR #123"],
    ["Dev build without a pull request: the footer is unchanged", "dev build", "", "dev build"],
    ["Release: the footer is unchanged", "v1.2.3", "", "v1.2.3"],
  ])("%s", (_name, label, pr, expected) => {
    expect(settingsVersionLabel(label, pr)).toBe(expected);
  });
});
