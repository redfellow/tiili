// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { bumpVersion, highestTag, pickTarget, setCargoVersion, setJsonVersion } from "./release.mjs";

describe("release", () => {
  it("Latest release: highestTag compares versions numerically and skips other tags", () => {
    expect(highestTag(["v0.1.1", "v0.10.0", "v0.9.3", "nightly", "v1.0"])).toBe("0.10.0");
    expect(highestTag([])).toBe("0.0.0");
  });

  it.each([
    ["patch", "0.1.1", true, { version: "0.1.2", resume: false }],
    ["minor", "0.1.1", true, { version: "0.2.0", resume: false }],
    ["0.3.0", "0.1.1", true, { version: "0.3.0", resume: false }],
    [undefined, "0.1.1", true, { version: undefined, resume: false }],
    ["patch", "0.1.2", false, { version: "0.1.2", resume: true }],
    [undefined, "0.1.2", false, { version: "0.1.2", resume: true }],
    ["patch", "0.0.0", true, { version: "0.0.1", resume: false }],
  ])("Resumable release: pickTarget(%s) after v%s (published %s)", (arg, latest, published, expected) => {
    expect(pickTarget(arg, latest, published)).toEqual(expected);
  });

  it("Resumable release: pickTarget refuses a version that is not newer", () => {
    expect(() => pickTarget("0.1.1", "0.1.1", true)).toThrow(/not newer/);
  });

  it.each([
    ["0.1.3", "patch", "0.1.4"],
    ["0.1.3", "minor", "0.2.0"],
    ["0.1.3", "major", "1.0.0"],
    ["0.1.3", "huge", Error],
    ["0.1", "patch", Error],
  ])("Minor release: bumpVersion(%s, %s)", (version, kind, expected) => {
    if (expected === Error) expect(() => bumpVersion(version, kind)).toThrow();
    else expect(bumpVersion(version, kind)).toBe(expected);
  });

  it.each([
    [
      "package.json",
      setJsonVersion,
      '{\n  "name": "tiili",\n  "version": "0.1.3",\n  "type": "module"\n}\n',
      '{\n  "name": "tiili",\n  "version": "0.2.0",\n  "type": "module"\n}\n',
    ],
    [
      "tauri.conf.json linked to package.json",
      setJsonVersion,
      '{\n  "productName": "tiili",\n  "version": "../package.json"\n}\n',
      '{\n  "productName": "tiili",\n  "version": "../package.json"\n}\n',
    ],
    [
      "Cargo.toml with dependency versions",
      setCargoVersion,
      '[package]\nname = "tiili"\nversion = "0.1.3"\n\n[dependencies]\nserde = { version = "1" }\nfoo = "2"\n[dependencies.bar]\nversion = "3"\n',
      '[package]\nname = "tiili"\nversion = "0.2.0"\n\n[dependencies]\nserde = { version = "1" }\nfoo = "2"\n[dependencies.bar]\nversion = "3"\n',
    ],
  ])("Minor release: rewrites %s", (_name, rewrite, before, after) => {
    expect(rewrite(before, "0.2.0")).toBe(after);
  });
});
