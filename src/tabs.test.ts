// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import { Tab, type Pane, type TabHooks } from "./tab";
import { badgeCount, insertBeside, listOrder, neighbourIndex, reorder, stepIndex, tabLabel, tabOf } from "./tabs";

// The grid's DOM view is not under test: a Tab only needs it to exist and to be told to render.
vi.mock("./layout/view", () => ({ TileView: class { render() {} } }));

/** A pane with just enough element to take the Zen icon's state. */
function fakePane(id: number): Pane {
  const element = { toggleAttribute() {}, setAttribute() {}, hidden: false } as unknown as HTMLElement;
  return { id, element, chip: element, zenButton: element, ready: Promise.resolve(undefined), zoom: 0 };
}

describe("Tab.add", () => {
  const hooks = { rendered() {}, marked: () => false } as unknown as TabHooks;
  const tab = (zenOn: boolean): Tab => {
    vi.stubGlobal("document", { createElement: () => ({}) });
    const t = new Tab({ append() {} } as unknown as HTMLElement, "grid", hooks);
    t.add(fakePane(1));
    t.add(fakePane(2));
    if (zenOn) t.setZen(1);
    return t;
  };
  it.each<[string, boolean, boolean, number | undefined]>([
    ["Open a pane: with Zen off the grid keeps showing", false, true, undefined],
    ["Open a pane: with Zen on the new pane is shown alone", true, true, 3],
    ["Open a pane: not shown alone leaves Zen off", false, false, undefined],
    ["Open a pane: not shown alone leaves the Zen pane", true, false, 1],
  ])("%s", (_name, zenOn, showAlone, expected) => {
    const t = tab(zenOn);
    t.add(fakePane(3), showAlone);
    expect(t.zen).toBe(expected);
    vi.unstubAllGlobals();
  });
});

describe("tabLabel", () => {
  it.each<[string, string | undefined, string, string]>([
    ["Strip appears: an unnamed tab shows its focused pane's chip", undefined, "härvääjä", "härvääjä"],
    ["Tab menu: a renamed tab shows its name", "build", "härvääjä", "build"],
    ["Clear the name: an empty name follows the chip again", "", "tiili", "tiili"],
    ["Clear the name: a blank name follows the chip again", "   ", "tiili", "tiili"],
  ])("%s", (_name, name, chip, expected) => {
    expect(tabLabel(name, chip)).toBe(expected);
  });
});

describe("stepIndex", () => {
  it.each<[string, number, number, number, number]>([
    ["Next tab: from the first of two shows the second", 0, 2, 1, 1],
    ["Next tab: from the second of two wraps to the first", 1, 2, 1, 0],
    ["Next tab: previous from the first wraps to the last", 0, 3, -1, 2],
    ["Next tab: previous from the middle shows the first", 1, 3, -1, 0],
    ["Next tab: a single tab stays shown", 0, 1, 1, 0],
  ])("%s", (_name, index, count, step, expected) => {
    expect(stepIndex(index, count, step)).toBe(expected);
  });
});

describe("neighbourIndex", () => {
  it.each<[string, number, number, number, number | undefined]>([
    ["Move pane to next tab: from the first of two goes to the second", 0, 2, 1, 1],
    ["Move pane to next tab: from the last tab does nothing", 1, 2, 1, undefined],
    ["Move pane to next tab: previous from the first tab does nothing", 0, 2, -1, undefined],
    ["Move pane to next tab: previous from the second goes to the first", 1, 2, -1, 0],
  ])("%s", (_name, index, count, step, expected) => {
    expect(neighbourIndex(index, count, step)).toBe(expected);
  });
});

describe("reorder", () => {
  it.each<[string, string[], number, number, string[]]>([
    ["Reorder: dragging the second tab before the first swaps them", ["a", "b"], 1, 0, ["b", "a"]],
    ["Reorder: dragging the first tab to the end", ["a", "b", "c"], 0, 2, ["b", "c", "a"]],
    ["Reorder: dropping a tab on itself changes nothing", ["a", "b"], 1, 1, ["a", "b"]],
    ["Reorder: an index past the end changes nothing", ["a", "b"], 0, 5, ["a", "b"]],
  ])("%s", (_name, list, from, to, expected) => {
    expect(reorder(list, from, to)).toEqual(expected);
  });
});

describe("insertBeside", () => {
  it.each<[string, number, number]>([
    ["Tab lifecycle: a new tab opens right after the first", 0, 1],
    ["Tab lifecycle: a new tab opens right after the third", 2, 3],
  ])("%s", (_name, shown, expected) => {
    expect(insertBeside(shown)).toBe(expected);
  });
});

describe("listOrder", () => {
  it.each<[string, number[][], number[]]>([
    ["List across tabs: A, B in tab 1 and C in tab 2 list as A, B, C", [[1, 2], [3]], [1, 2, 3]],
    ["List across tabs: an empty tab adds nothing", [[], [3, 4]], [3, 4]],
  ])("%s", (_name, tabs, expected) => {
    expect(listOrder(tabs)).toEqual(expected);
  });
});

describe("tabOf", () => {
  it.each<[string, number[][], number, number | undefined]>([
    ["Open from a hidden tab: the caller's session is found in its tab", [[1, 2], [3]], 3, 1],
    ["Mark in a background tab: the first tab holds session 2", [[1, 2], [3]], 2, 0],
    ["A session in no tab is not found", [[1, 2], [3]], 9, undefined],
  ])("%s", (_name, tabs, session, expected) => {
    expect(tabOf(tabs, session)).toBe(expected);
  });
});

describe("badgeCount", () => {
  it.each<[string, number[], number[], number]>([
    ["Mark in a background tab: one marked pane counts 1", [1, 2], [2, 7], 1],
    ["Mark in a background tab: no marked panes count 0", [1, 2], [7], 0],
    ["Mark in a background tab: two marked panes count 2", [1, 2, 3], [1, 3], 2],
  ])("%s", (_name, sessions, marked, expected) => {
    expect(badgeCount(sessions, new Set(marked))).toBe(expected);
  });
});
