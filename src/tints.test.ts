// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { TintAssigner, tintCounts } from "./tints";

/** Sixteen roots, so the next new one has to share a tint. */
const sixteen = Array.from({ length: 16 }, (_, i) => `/repo${i + 1}`);
/** One open pane per tint, except the tints given. */
const counts = (except: Record<number, number> = {}) =>
  new Map(Array.from({ length: 16 }, (_, i) => [i + 1, except[i + 1] ?? 1]));

// [case, roots assigned before, root, open panes per tint, expected tint]
const cases: [string, string[], string, Map<number, number>, number][] = [
  ["First repository: gets tint 1", [], "/a", new Map(), 1],
  ["Order: the third repository gets tint 3", ["/a", "/b"], "/c", new Map(), 3],
  ["Two panes, one repository: both show the same tint", ["/a", "/b"], "/a", new Map(), 1],
  ["Stability: a repository with no open panes keeps its tint", ["/a", "/b"], "/a", new Map([[2, 3]]), 1],
  ["Sixteenth repository: gets tint 16", sixteen.slice(0, 15), "/repo16", new Map(), 16],
  ["Seventeenth repository: gets the tint with the fewest open panes", sixteen, "/new", counts({ 1: 3, 7: 0 }), 7],
  ["Seventeenth repository: ties go to the lowest number", sixteen, "/new", counts({ 4: 0, 9: 0 }), 4],
  ["Seventeenth repository: tints missing from the counts have no panes", sixteen, "/new", new Map([[1, 2]]), 2],
  ["After sixteen, a known repository keeps its tint", sixteen, "/repo5", counts({ 1: 0 }), 5],
];

describe("TintAssigner", () => {
  it.each(cases)("%s", (_, before, root, open, expected) => {
    const tints = new TintAssigner();
    before.forEach((r) => tints.assign(r, new Map()));
    expect(tints.assign(root, open)).toBe(expected);
  });

  it("Seventeenth repository: keeps its shared tint once assigned", () => {
    const tints = new TintAssigner();
    sixteen.forEach((r) => tints.assign(r, new Map()));
    expect(tints.assign("/new", counts({ 3: 0 }))).toBe(3);
    expect(tints.assign("/new", counts({ 8: 0 }))).toBe(3);
  });
});

describe("tintCounts", () => {
  it("counts open panes per tint, skipping untinted panes", () => {
    expect(tintCounts([1, 2, 1, undefined])).toEqual(new Map([[1, 2], [2, 1]]));
  });
});
