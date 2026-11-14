// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import type { Platform } from "./keymap";
import {
  findPathCandidates,
  hintText,
  isOpenGesture,
  neverOpens,
  opensDirectly,
  truncateMiddle,
  type HoveredLink,
} from "./links";

describe("findPathCandidates", () => {
  const cases: [string, { path: string; text: string; line?: number; col?: number }[]][] = [
    ["error in src/main.ts:10", [{ path: "src/main.ts", text: "src/main.ts:10", line: 10 }]],
    ["src/main.ts:10:4: oops", [{ path: "src/main.ts", text: "src/main.ts:10:4", line: 10, col: 4 }]],
    ["a.ts:10:10", [{ path: "a.ts", text: "a.ts:10:10", line: 10, col: 10 }]],
    ["Foo.cs(12,5): warning", [{ path: "Foo.cs", text: "Foo.cs(12,5)", line: 12, col: 5 }]],
    ["./build.sh and ../up/x", [{ path: "./build.sh", text: "./build.sh" }, { path: "../up/x", text: "../up/x" }]],
    ["cat ~/notes.txt", [{ path: "~/notes.txt", text: "~/notes.txt" }]],
    ["ls /usr/local/bin", [{ path: "/usr/local/bin", text: "/usr/local/bin" }]],
    ["at C:\\work\\app.rs:3", [{ path: "C:\\work\\app.rs", text: "C:\\work\\app.rs:3", line: 3 }]],
    ["See README.md.", [{ path: "README.md", text: "README.md" }]],
    ["(src/a.ts)", [{ path: "src/a.ts", text: "src/a.ts" }]],
    ["open https://example.com/a/b.html now", []],
    ["just some words here", []],
    ["version 1.2.3", []],
  ];
  it.each(cases)("%s", (line, expected) => {
    const found = findPathCandidates(line);
    expect(found.map(({ path, text, line: l, col }) => ({ path, text, line: l, col }))).toEqual(
      expected.map((e) => ({ line: undefined, col: undefined, ...e })),
    );
    for (const candidate of found) expect(line.slice(candidate.start, candidate.end)).toBe(candidate.text);
  });
});

describe("isOpenGesture", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false };
  const cases: [string, Platform, typeof click, boolean][] = [
    ["Plain click does nothing: macOS", "macos", click, false],
    ["Plain click does nothing: Linux", "linux", click, false],
    ["⌘-click on macOS", "macos", { ...click, metaKey: true }, true],
    ["Ctrl-click on macOS", "macos", { ...click, ctrlKey: true }, false],
    ["Ctrl-click on Windows", "windows", { ...click, ctrlKey: true }, true],
    ["Ctrl-click on Linux", "linux", { ...click, ctrlKey: true }, true],
    ["Meta-click on Linux", "linux", { ...click, metaKey: true }, false],
    ["⌘ right-click on macOS", "macos", { ...click, button: 2, metaKey: true }, false],
  ];
  it.each(cases)("%s", (_name, platform, event, expected) => {
    expect(isOpenGesture(event, platform)).toBe(expected);
  });
});

describe("scheme rules", () => {
  const cases: [string, "open" | "confirm" | "never"][] = [
    ["https://example.com", "open"],
    ["HTTP://example.com", "open"],
    ["mailto:a@b.c", "open"],
    ["vscode://file/x", "confirm"],
    ["javascript:alert(1)", "never"],
    ["data:text/html,x", "never"],
    ["blob:https://x/y", "never"],
    ["no scheme", "never"],
  ];
  it.each(cases)("%s", (uri, rule) => {
    const got = opensDirectly(uri) ? "open" : neverOpens(uri) ? "never" : "confirm";
    expect(got).toBe(rule);
  });
});

describe("truncateMiddle", () => {
  const cases: [string, number][] = [
    ["short", 10],
    ["https://example.com/very/long/path/to/target", 20],
    ["https://example.com/very/long/path/to/target", 21],
  ];
  it.each(cases)("%s to %i", (text, max) => {
    const cut = truncateMiddle(text, max);
    expect([...cut].length).toBeLessThanOrEqual(max);
    if (text.length <= max) expect(cut).toBe(text);
    else {
      const [head, tail] = cut.split("…");
      expect(text.startsWith(head)).toBe(true);
      expect(text.endsWith(tail)).toBe(true);
    }
  });
});

describe("hintText", () => {
  const long = "https://example.com/" + "x".repeat(80) + "/end";
  const file = { kind: "path", abs: "/p/src/main.ts", isDir: false, revealOnly: false } as const;
  const cases: [string, HoveredLink, Platform, string][] = [
    ["Plain URL on macOS", { kind: "url", uri: "https://example.com" }, "macos", "⌘-click to open"],
    ["Plain URL on Linux", { kind: "url", uri: "https://example.com" }, "linux", "Ctrl-click to open"],
    ["OSC 8 target shown", { kind: "url", uri: "https://example.com/a", label: "docs" }, "macos", "⌘-click to open https://example.com/a"],
    ["OSC 8 long target cut", { kind: "url", uri: long, label: "docs" }, "macos", `⌘-click to open ${truncateMiddle(long, 30)}`],
    ["File", file, "macos", "⌘-click to open in default app"],
    ["File with a line", { ...file, line: 10 }, "windows", "Ctrl-click to open in default app (line ignored)"],
    ["Folder on macOS", { ...file, isDir: true }, "macos", "⌘-click to open in Finder"],
    ["Folder on Windows", { ...file, isDir: true }, "windows", "Ctrl-click to open in Explorer"],
    ["Executable on macOS", { ...file, revealOnly: true }, "macos", "⌘-click to reveal in Finder"],
    ["Executable on Windows", { ...file, revealOnly: true }, "windows", "Ctrl-click to show in Explorer"],
  ];
  it.each(cases)("%s", (_name, link, platform, expected) => {
    expect(hintText(link, platform, 30)).toBe(expected);
  });
});
