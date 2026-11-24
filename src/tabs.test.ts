// @harvaaja-test-tier: fast
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tab, type Pane, type TabHooks } from "./tab";
import { badgeCount, insertBeside, neighbourIndex, reorder, stepIndex, tabLabel, tabOf } from "./tabs";

// The grid's DOM view is not under test: a Tab only needs it to exist and to be told to render.
vi.mock("./layout/view", () => ({ TileView: class { render() {} } }));

/** A pane with just enough element to take the Zen and close icons' state. */
function fakePane(id: number): Pane {
  const fake = () => ({ toggleAttribute() {}, setAttribute() {}, hidden: false }) as unknown as HTMLElement;
  const element = fake();
  return { id, element, chip: element, zenButton: fake(), closeButton: fake(), ready: Promise.resolve(undefined), zoom: 0 };
}

const hooks = { rendered() {}, marked: () => false } as unknown as TabHooks;

/** A tab holding panes 1 to `count`. */
function tabWith(count: number): Tab {
  vi.stubGlobal("document", { createElement: () => ({}) });
  const t = new Tab({ append() {} } as unknown as HTMLElement, "grid", hooks);
  for (let id = 1; id <= count; id++) t.add(fakePane(id));
  return t;
}

describe("Tab.add", () => {
  const tab = (zenOn: boolean): Tab => {
    const t = tabWith(2);
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

describe("Pane close icon", () => {
  it.each<[string, number, boolean]>([
    ["One pane: it shows no close icon", 1, true],
    ["Close on hover: with two panes each pane has a close icon", 2, false],
  ])("%s", (_name, count, hidden) => {
    const t = tabWith(count);
    t.showZen();
    for (const pane of t.panes) expect(pane.closeButton.hidden).toBe(hidden);
    vi.unstubAllGlobals();
  });

  it("Closes the clicked pane: closing pane 1 while pane 2 has focus leaves pane 2 focused", () => {
    const t = tabWith(2);
    t.markFocused(1);
    const first = t.panes[0];
    expect(first && t.remove(first)).toBe(false);
    expect(t.current()?.id).toBe(2);
    vi.unstubAllGlobals();
  });
});

describe("Grid fits the tab's area", () => {
  // Before any terminal is laid out the area is measured in 8.5 × 17 px cells.
  const landscape = { clientWidth: 1700, clientHeight: 986 }; // 200 × 58 cells
  const portrait = { clientWidth: 833, clientHeight: 1190 }; // 98 × 70 cells
  const nearWide = { clientWidth: 1487.5, clientHeight: 850 }; // 175 × 50 cells: side by side scores a little better

  /** A Grid tab of `count` panes in a container of `size`, and a way to report a resize of it. */
  function fittedTab(count: number, size: { clientWidth: number; clientHeight: number }) {
    const container = { ...size };
    const observers: (() => void)[] = [];
    vi.stubGlobal("document", { createElement: () => container });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    });
    const t = new Tab({ append() {} } as unknown as HTMLElement, "grid", hooks);
    for (let id = 1; id <= count; id++) t.add(fakePane(id));
    const resize = (next: { clientWidth: number; clientHeight: number }) => {
      Object.assign(container, next);
      observers.forEach((callback) => callback());
    };
    return { t, resize };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Portrait windows get rows: 2 panes open one above the other", () => {
    const { t } = fittedTab(2, portrait);
    expect([t.layout.cols, t.layout.rows]).toEqual([1, 2]);
  });

  it("Settled resize re-flows: side by side panes stack once the resize has settled, not during it", () => {
    vi.useFakeTimers();
    const { t, resize } = fittedTab(2, landscape);
    expect([t.layout.cols, t.layout.rows]).toEqual([2, 1]);
    resize(portrait);
    vi.advanceTimersByTime(200);
    resize(portrait);
    vi.advanceTimersByTime(200);
    expect([t.layout.cols, t.layout.rows]).toEqual([2, 1]);
    vi.advanceTimersByTime(50);
    expect([t.layout.cols, t.layout.rows]).toEqual([1, 2]);
  });

  it("Restore keeps divider sizes: a restored 1×2 Grid stays through a settled measure just past the threshold", () => {
    vi.useFakeTimers();
    const { t, resize } = fittedTab(2, nearWide);
    expect([t.layout.cols, t.layout.rows]).toEqual([2, 1]);
    t.restoreGrid(1, 2, { colSizes: [1], rowSizes: [0.3, 0.7] });
    resize(nearWide);
    vi.advanceTimersByTime(250);
    expect([t.layout.cols, t.layout.rows, t.layout.rowSizes]).toEqual([1, 2, [0.3, 0.7]]);
  });

  it("a restored shape that does not lay out the panes is ignored", () => {
    const { t } = fittedTab(2, landscape);
    t.restoreGrid(1, 3, { colSizes: [1], rowSizes: [0.2, 0.3, 0.5] });
    expect([t.layout.cols, t.layout.rows]).toEqual([2, 1]);
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
