// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import type { LayoutState } from "./layout/model";
import { DIVIDER, restorePlan, restorePlans, snapshotWindow, type Restored, type SavedPane } from "./session";

const terminal = (id: number, patch: Partial<SavedPane> = {}): SavedPane => ({
  id, kind: "terminal", cwd: `/work/p${id}`, zoom: 0, ...patch,
});

const grid = (order: number[], patch: Partial<LayoutState> = {}): LayoutState => ({
  mode: "grid", order, cols: 2, rows: 2, colSizes: [0.3, 0.7], rowSizes: [0.6, 0.4], ...patch,
});

function restored(panes: SavedPane[], patch: Partial<Restored> = {}, layout = grid(panes.map((p) => p.id))): Restored {
  return {
    window: { label: "main", tabs: [{ layout, panes, focused: panes.at(-1)?.id }], activeTab: 0 },
    scrollback: {},
    folders: Object.fromEntries(panes.flatMap((p) => (p.cwd && !p.host ? [[String(p.id), p.cwd]] : []))),
    ...patch,
  };
}

describe("snapshotWindow", () => {
  it.each([
    ["Two windows reopen: panes saved in grid order with the focused pane", grid([3, 1, 2]), 1, true,
      { order: [3, 1, 2], commands: ["c3", "c1", "c2"], focused: 1 }],
    ["Turned off: command lines are left out, program names stay", grid([1, 2]), 2, false,
      { order: [1, 2], commands: [undefined, undefined], focused: 2 }],
    ["a pane that left the layout is not saved, nor an unknown focus", grid([2, 9]), 7, true,
      { order: [2], commands: ["c2"], focused: undefined }],
  ])("%s", (_name, layout, focused, keep, want) => {
    const panes = [1, 2, 3].map((id) => terminal(id, { command: `c${id}`, program: "node" }));
    const state = snapshotWindow(layout, panes, focused, keep);
    const tab = state.tabs[0];
    expect(tab.layout.order).toEqual(want.order);
    expect(tab.panes.map((p) => p.id)).toEqual(want.order);
    expect(tab.panes.map((p) => p.command)).toEqual(want.commands);
    expect(tab.panes.every((p) => p.program === "node")).toBe(true);
    expect(tab.focused).toBe(want.focused);
  });

  it("A window whose last pane exited: no tab is saved, so it does not reopen", () => {
    expect(snapshotWindow(grid([]), [], undefined, true).tabs).toEqual([]);
  });
});

describe("minimized panes", () => {
  it("Dev server badge after relaunch: a minimized pane is saved apart from the grid and reopens minimized", () => {
    const dev = { ...terminal(3, { command: "npm run dev", program: "node" }), at: 1 };
    const tab = snapshotWindow(grid([1, 2]), [terminal(1), terminal(2)], 2, true, [dev]).tabs[0];
    expect(tab.layout.order).toEqual([1, 2]);
    expect(tab.minimized).toEqual([dev]);
    expect(snapshotWindow(grid([1]), [terminal(1)], 1, false, [dev]).tabs[0].minimized?.[0].command).toBeUndefined();

    const saved = restored([terminal(1), terminal(2)], { scrollback: { 3: "ready on :5173" } });
    saved.window.tabs[0].minimized = [dev, { ...terminal(4), at: 9 }];
    saved.window.tabs[0].minimized.push({ id: 5, kind: "heynote", zoom: 0, at: 0 });
    const plan = restorePlans(saved, true)?.tabs[0];
    expect(plan?.panes).toHaveLength(2);
    expect(plan?.minimized.map((p) => [p.kind, p.at, p.command, p.history])).toEqual([
      ["terminal", 1, "npm run dev", "npm run dev"],
      ["terminal", 2, null, undefined],
      ["heynote", 0, null, undefined],
    ]);
    expect(plan?.minimized[0].preface).toContain("ready on :5173");
    expect(restorePlans(restored([terminal(1)]), true)?.tabs[0].minimized).toEqual([]);
  });
});

describe("restorePlan", () => {
  it("Two windows reopen: order, sizes, tiling, focus, zoom, titles and Heynote come back", () => {
    const panes = [terminal(4, { zoom: 2, title: "api" }), { id: 7, kind: "heynote" as const, zoom: 0 },
      terminal(5), terminal(6)];
    const saved = restored(panes, {}, grid([6, 4, 7, 5], { mode: "wide" }));
    saved.window.tabs[0].focused = 4;
    const plan = restorePlan(saved, true);
    expect(plan?.panes.map((p) => [p.kind, p.cwd, p.zoom, p.title])).toEqual([
      ["terminal", "/work/p6", 0, undefined],
      ["terminal", "/work/p4", 2, "api"],
      ["heynote", undefined, 0, undefined],
      ["terminal", "/work/p5", 0, undefined],
    ]);
    expect(plan?.mode).toBe("wide");
    expect(plan?.sizes).toEqual({ colSizes: [0.3, 0.7], rowSizes: [0.6, 0.4] });
    expect(plan?.focused).toBe(1);
  });

  it.each([
    ["sizes that no longer fit the grid are dropped", grid([1, 2], { colSizes: [1], rowSizes: [1] }), [1, 2], undefined],
    ["an order that is not the panes falls back to their saved order", grid([1, 9], { cols: 2, rows: 1,
      colSizes: [0.5, 0.5], rowSizes: [1] }), [1, 2], { colSizes: [0.5, 0.5], rowSizes: [1] }],
    ["a layout of the wrong shape gives the automatic grid", "broken" as unknown as LayoutState, [1, 2], undefined],
  ])("%s", (_name, layout, order, sizes) => {
    const plan = restorePlan(restored([terminal(1), terminal(2)], {}, layout), true);
    expect(plan?.panes.map((p) => p.cwd)).toEqual(order.map((id) => `/work/p${id}`));
    expect(plan?.sizes).toEqual(sizes);
  });

  it.each([
    ["Restore keeps divider sizes: a saved 1×3 Grid reopens 1×3 with its sizes",
      grid([1, 2, 3], { cols: 1, rows: 3, colSizes: [1], rowSizes: [0.5, 0.3, 0.2] }),
      [1, 3], { colSizes: [1], rowSizes: [0.5, 0.3, 0.2] }],
    ["a saved Grid shape that does not fit the panes gives the automatic grid",
      grid([1, 2, 3], { cols: 1, rows: 2, colSizes: [1], rowSizes: [0.5, 0.5] }), [2, 2], undefined],
    ["a mode other than Grid takes its own shape, not the saved one",
      grid([1, 2, 3], { mode: "wide", cols: 1, rows: 3, colSizes: [1], rowSizes: [0.5, 0.3, 0.2] }), [3, 1], undefined],
  ])("%s", (_name, layout, shape, sizes) => {
    const plan = restorePlan(restored([terminal(1), terminal(2), terminal(3)], {}, layout), true);
    expect([plan?.cols, plan?.rows]).toEqual(shape);
    expect(plan?.sizes).toEqual(sizes);
  });

  it("a window with no pane gives no plan, so one fresh window opens", () => {
    expect(restorePlan(restored([]), true)).toBeUndefined();
  });

  it("each saved tab reopens with its name, the shown one active, and tabs with no pane left out", () => {
    const saved: Restored = {
      window: {
        label: "main",
        tabs: [
          { layout: grid([1]), panes: [terminal(1)], focused: 1, name: "api" },
          { layout: grid([]), panes: [] },
          { layout: grid([2]), panes: [terminal(2)], focused: 2 },
        ],
        activeTab: 2,
      },
      scrollback: {},
      folders: {},
    };
    const plans = restorePlans(saved, true);
    expect(plans?.tabs.map((tab) => [tab.name, tab.panes.map((p) => p.cwd)])).toEqual([
      ["api", ["/work/p1"]],
      [undefined, ["/work/p2"]],
    ]);
    expect(plans?.active).toBe(1);
  });

  it.each([
    ["Up re-runs: the reminder names the command and it becomes the newest history entry",
      terminal(1, { command: "npm run dev", program: "node" }), {}, true,
      { cwd: "/work/p1", has: ["— was running: npm run dev —"], history: "npm run dev" }],
    ["Other shells: the reminder names the program only, with nothing for the history",
      terminal(1, { program: "vim" }), {}, true, { cwd: "/work/p1", has: ["vim"], history: undefined }],
    ["a remote pane opens at home with the connected line", terminal(1, { host: "box", cwd: "/srv" }), {}, true,
      { cwd: undefined, has: ["— was connected to box —"], history: undefined }],
    ["Remote command is not seeded: the connected line shows and the history stays empty",
      terminal(1, { host: "box", command: "rm -rf ~", program: "ssh" }), {}, true,
      { cwd: undefined, has: ["— was connected to box —"], history: undefined }],
    ["Folder deleted: the pane opens in the nearest existing parent and notes both folders",
      terminal(1, { cwd: "/work/gone/deep" }), { folders: { 1: "/work" } }, true,
      { cwd: "/work", has: ["/work/gone/deep", "/work "], history: undefined }],
    ["Folder deleted under home: both folders are written from ~",
      terminal(1, { cwd: "/Users/me/old/proj" }), { folders: { 1: "/Users/me/old" }, home: "/Users/me" }, true,
      { cwd: "/Users/me/old", has: ["~/old/proj", "~/old "], history: undefined }],
    ["a folder that only starts like home keeps its full path",
      terminal(1, { cwd: "/Users/meg/x" }), { folders: { 1: "/Users/meg" }, home: "/Users/me" }, true,
      { cwd: "/Users/meg", has: ["/Users/meg/x", "/Users/meg "], history: undefined }],
    ["Folder deleted with no parent left: the pane opens at home", terminal(1, { cwd: "/gone" }),
      { folders: { 1: null } }, true, { cwd: undefined, has: ["/gone"], history: undefined }],
    ["Scrollback above the divider: saved output comes first, then the divider",
      terminal(1), { scrollback: { 1: "old output" } }, true,
      { cwd: "/work/p1", has: ["old output", DIVIDER], history: undefined }],
    ["Turned off: no scrollback, divider or history, the reminder stays",
      terminal(1, { command: "make", program: "make" }), { scrollback: { 1: "old output" } }, false,
      { cwd: "/work/p1", has: ["make"], history: undefined }],
  ])("%s", (_name, pane, patch, withScrollback, want) => {
    const plan = restorePlan(restored([pane], patch), withScrollback);
    const restore = plan?.panes[0];
    expect(restore?.cwd).toBe(want.cwd);
    expect(restore?.history).toBe(want.history);
    for (const text of want.has) expect(restore?.preface).toContain(text);
    const preface = restore?.preface ?? "";
    if (withScrollback && "scrollback" in patch) expect(preface.indexOf("old output")).toBeLessThan(preface.indexOf(DIVIDER));
    else expect(preface).not.toContain("old output");
  });

  it("a pane in its own folder with nothing running reopens with an empty preface", () => {
    expect(restorePlan(restored([terminal(1)]), true)?.panes[0].preface).toBe("");
  });

  it("control characters in a saved command never reach the terminal", () => {
    const plan = restorePlan(restored([terminal(1, { command: "echo \x1b]0;pwn\x07 hi" })]), true);
    expect(plan?.panes[0].preface).not.toContain("\x1b]");
  });
});
