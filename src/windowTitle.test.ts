// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { windowTitle } from "./windowTitle";

describe("windowTitle", () => {
  it.each([
    ["Focused pane runs a program: command then the app name", "vim README.md", "vim README.md — tiili >_"],
    ["Command with surrounding whitespace is trimmed", "  htop \n", "htop — tiili >_"],
    ["No title: blank command", "", "tiili >_"],
    ["No title: whitespace only", "   ", "tiili >_"],
    ["No title: no command at all", undefined, "tiili >_"],
  ])("%s", (_name, command, expected) => {
    expect(windowTitle(command)).toBe(expected);
  });
});
