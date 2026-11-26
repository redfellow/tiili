// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { badgeState, bringBack, fitBadges, restoreIndex, titlePlacement, type MinimizedState } from "./minimized";

const live: MinimizedState = { kind: "live" };

/** Each case runs one rule and names what it should give. */
const cases: { name: string; run: () => unknown; expected: unknown }[] = [
  {
    name: "Back in place: pane 2 of three returns as pane 2 while the others are unchanged",
    run: () => restoreIndex(1, [1, 3], [1, 3]),
    expected: 1,
  },
  { name: "Back in place: the peers' order does not matter", run: () => restoreIndex(1, [1, 3], [3, 1]), expected: 1 },
  {
    name: "Layout changed: a pane opened since sends it to the end",
    run: () => restoreIndex(0, [1, 3], [1, 3, 4]),
    expected: 3,
  },
  { name: "Layout changed: a pane closed since sends it to the end", run: () => restoreIndex(0, [1, 3], [3]), expected: 1 },
  { name: "Layout changed: its tab is now empty", run: () => restoreIndex(2, [1, 3], []), expected: 0 },
  {
    name: "Too many badges: only three of five fit, so the bar shows three and +2",
    run: () => fitBadges([50, 50, 50, 50, 50], 200, 40),
    expected: { shown: 3, hidden: 2 },
  },
  {
    name: "Too many badges: all fit without the +N badge",
    run: () => fitBadges([50, 50, 50, 50], 200, 40),
    expected: { shown: 4, hidden: 0 },
  },
  {
    name: "Too many badges: none fit beside +N",
    run: () => fitBadges([100, 100], 90, 40),
    expected: { shown: 0, hidden: 2 },
  },
  { name: "Too many badges: no badges", run: () => fitBadges([], 0, 40), expected: { shown: 0, hidden: 0 } },
  {
    name: "Title stays centred while the badges end before it",
    run: () => titlePlacement(800, 40, 300, 700),
    expected: { kind: "centred" },
  },
  {
    name: "Title slides: badges reaching it move it to the middle of the free space",
    run: () => titlePlacement(800, 40, 500, 700),
    expected: { kind: "slid", x: 200 },
  },
  {
    name: "No room: free space narrower than the title hides it",
    run: () => titlePlacement(800, 40, 670, 700),
    expected: { kind: "hidden" },
  },
  { name: "Badge state: a live pane is running", run: () => badgeState(live, false), expected: { kind: "running" } },
  { name: "Needs you: a marked pane shows the brick", run: () => badgeState(live, true), expected: { kind: "needs-you" } },
  {
    name: "Exited: the exit code shows even while marked",
    run: () => badgeState({ kind: "exited", code: 1 }, true),
    expected: { kind: "exited", code: 1 },
  },
  {
    name: "Badge state: a pane session restore brought back is stopped",
    run: () => badgeState({ kind: "stopped", command: "npm run dev" }, false),
    expected: { kind: "stopped" },
  },
  {
    name: "Closing the last visible pane: the pane minimized last comes back",
    run: () => bringBack(["first", "last"], 0),
    expected: "last",
  },
  { name: "Closing the last visible pane: none comes back while others show", run: () => bringBack(["a"], 1), expected: undefined },
  { name: "Nothing left: no pane comes back, so the window closes", run: () => bringBack([], 0), expected: undefined },
];

describe("minimized pane rules", () => {
  it.each(cases)("$name", ({ run, expected }) => {
    expect(run()).toEqual(expected);
  });
});
