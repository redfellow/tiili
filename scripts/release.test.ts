// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  describeJob,
  formatDuration,
  highestTag,
  pickTarget,
  setCargoLockVersion,
  setCargoVersion,
  setJsonVersion,
} from "./release.mjs";

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

  it("Stamped version: setCargoLockVersion rewrites only tiili's own entry", () => {
    const lock =
      '[[package]]\nname = "serde"\nversion = "1.0.0"\n\n[[package]]\nname = "tiili"\nversion = "0.2.0"\ndependencies = [\n "serde",\n]\n';
    expect(setCargoLockVersion(lock, "0.3.1")).toBe(lock.replace('"0.2.0"', '"0.3.1"'));
    expect(setCargoLockVersion(lock, "0.2.0")).toBe(lock);
    expect(() => setCargoLockVersion('[[package]]\nname = "serde"\nversion = "1.0.0"\n', "0.3.1")).toThrow();
  });

  it("Stamped version: the Windows runner's CRLF checkout stamps the same way", () => {
    const crlf = (text: string) => text.replace(/\n/g, "\r\n");
    const lock = crlf('[[package]]\nname = "tiili"\nversion = "0.2.0"\ndependencies = [\n "serde",\n]\n');
    expect(setCargoLockVersion(lock, "0.3.0")).toBe(lock.replace('"0.2.0"', '"0.3.0"'));
    const toml = crlf('[package]\nname = "tiili"\nversion = "0.2.0"\n\n[dependencies]\nserde = "1"\n');
    expect(setCargoVersion(toml, "0.3.0")).toBe(toml.replace('"0.2.0"', '"0.3.0"'));
    const json = crlf('{\n  "name": "tiili",\n  "version": "0.2.0"\n}\n');
    expect(setJsonVersion(json, "0.3.0")).toBe(json.replace('"0.2.0"', '"0.3.0"'));
  });

  it.each([
    [42_000, "0:42"],
    [446_000, "7:26"],
    [3_725_000, "1:02:05"],
  ])("Build progress: formatDuration(%i) is %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it("Build progress: describeJob names the platform and its current step", () => {
    const steps = [
      { name: "Set up job", status: "completed" },
      { name: "Run npm ci", status: "completed" },
      { name: "Run npm run bundle", status: "in_progress" },
      { name: "Upload installers", status: "queued" },
    ];
    expect(describeJob({ name: "bundle (macos-latest)", status: "in_progress", steps }, "⠋")).toBe(
      "⠋ macOS   npm run bundle  (step 3/4)",
    );
    expect(
      describeJob(
        {
          name: "bundle (windows-latest)",
          status: "completed",
          conclusion: "success",
          startedAt: "2026-11-13T21:12:08Z",
          completedAt: "2026-11-13T21:17:03Z",
        },
        "⠋",
      ),
    ).toBe("✓ Windows done  4:55");
    expect(describeJob({ name: "bundle (ubuntu-22.04)", status: "completed", conclusion: "failure" }, "⠋")).toBe(
      "✗ Linux   failure",
    );
    expect(describeJob({ name: "bundle (ubuntu-22.04)", status: "queued" }, "⠋")).toBe("· Linux   waiting for a runner");
  });
});
