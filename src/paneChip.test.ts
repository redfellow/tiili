// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { chipLabel, folderName, placeLabel, type PaneCwd } from "./paneChip";

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

const repo = (root: string, name: string) => ({ root, name });

// [case, place, chip place]
const places: [string, Pick<PaneCwd, "cwd" | "repo" | "host">, string][] = [
  ["Local repository", { cwd: "/Users/red/tiili/src", repo: repo("/Users/red/tiili", "tiili"), host: null }, "tiili"],
  ["Outside a repository", { cwd: "/Users/red/Downloads", repo: null, host: null }, "Downloads"],
  ["Remote place: repository", { cwd: "/home/red/api/src", repo: repo("/home/red/api", "api"), host: "build-box" }, "build-box:api"],
  ["Left the repository: remote folder", { cwd: "/home/red/src", repo: null, host: "build-box" }, "build-box:src"],
  ["WSL on Windows", { cwd: "/home/red", repo: null, host: "WSL" }, "WSL:red"],
  ["Remote Windows path", { cwd: "C:\\Users\\red\\code", repo: null, host: "win-box" }, "win-box:code"],
];

describe("placeLabel", () => {
  it.each(places)("%s", (_, place, expected) => {
    expect(placeLabel(place)).toBe(expected);
  });
});
