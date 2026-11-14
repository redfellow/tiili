// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { menuEntries, type WindowEntry } from "./windowMenu";

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
  ];
  it.each(cases)("%s", (_name, windows, texts) => {
    const entries = menuEntries(windows);
    expect(entries.map((entry) => entry.text)).toEqual(texts);
    expect(entries.map((entry) => entry.label)).toEqual(windows.map((w) => w.label));
  });
});
