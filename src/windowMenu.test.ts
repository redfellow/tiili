// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { menuEntries, tabMenuEntries, type WindowEntry } from "./windowMenu";

const win = (label: string, name: string): WindowEntry => ({ label, name });

describe("menuEntries", () => {
  const cases: [string, WindowEntry[], string[]][] = [
    ["no other windows", [], []],
    ["Move to an existing window: distinct names stay as they are", [win("main", "tiili"), win("window-1", "härvääjä")], ["tiili", "härvääjä"]],
    ["Duplicate window names: tiili and tiili (2)", [win("main", "tiili"), win("window-2", "tiili")], ["tiili", "tiili (2)"]],
    [
      "Duplicate window names: numbered in open order, per name",
      [win("main", "tiili"), win("window-1", "Heynote"), win("window-2", "tiili"), win("window-3", "tiili"), win("window-4", "Heynote")],
      ["tiili", "Heynote", "tiili (2)", "tiili (3)", "Heynote (2)"],
    ],
    ["a settings window is not listed", [win("main", "tiili"), win("settings-main", "Settings")], ["tiili"]],
  ];
  it.each(cases)("%s", (_name, windows, texts) => {
    const entries = menuEntries(windows);
    expect(entries.map((entry) => entry.text)).toEqual(texts);
    expect(entries.map((entry) => entry.label)).toEqual(
      windows.filter((w) => !w.label.startsWith("settings-")).map((w) => w.label),
    );
  });
});

describe("tabMenuEntries", () => {
  const cases: [string, string[], number, [number, string][]][] = [
    ["Move to New Tab: a single tab lists no other tabs", ["tiili"], 0, []],
    ["Move a pane to another tab: the pane's own tab is left out", ["tiili", "härvääjä", "Heynote"], 1, [[0, "tiili"], [2, "Heynote"]]],
    ["Move a pane to another tab: tabs of one label are numbered in strip order", ["tiili", "tiili", "tiili"], 0, [[1, "tiili (2)"], [2, "tiili (3)"]]],
    ["Move a pane to another tab: the left-out tab still counts for numbering", ["tiili", "tiili"], 1, [[0, "tiili"]]],
  ];
  it.each(cases)("%s", (_name, labels, current, expected) => {
    expect(tabMenuEntries(labels, current).map(({ index, text }) => [index, text])).toEqual(expected);
  });
});
