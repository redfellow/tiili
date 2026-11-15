// @harvaaja-test-tier: fast
import { afterEach, describe, expect, it, vi } from "vitest";
import { flipFrames, prefersReducedMotion, type MotionKind, type Rect } from "./motion";

const rect = (left: number, top: number, width: number, height: number): Rect => ({ left, top, width, height });

// [case, rect before (none: new), rect after (none: gone), kind expected (none: no motion)]
const cases: [string, Rect | undefined, Rect | undefined, MotionKind | undefined][] = [
  ["Opening a pane animates: a new pane grows in", undefined, rect(0, 0, 100, 100), "enter"],
  ["Opening a pane animates: a pane that moves glides", rect(0, 0, 200, 100), rect(0, 0, 100, 100), "move"],
  ["Swap animates: a pane slides to the other's place", rect(0, 0, 100, 100), rect(103, 0, 100, 100), "move"],
  ["Closing a pane animates: the closed pane shrinks and fades out", rect(0, 0, 100, 100), undefined, "exit"],
  ["An unchanged pane does not move", rect(10, 20, 100, 100), rect(10.2, 20, 100, 100), undefined],
];

describe("flipFrames", () => {
  it.each(cases)("%s", (_name, from, to, kind) => {
    const before = new Map(from ? [[1, from]] : []);
    const after = new Map(to ? [[1, to]] : []);
    const motion = flipFrames(before, after).get(1);
    expect(motion?.kind).toBe(kind);
    if (!motion) return;
    // Every motion ends with the pane at rest in its new place (or, leaving, gone from sight).
    const end = motion.frames[motion.frames.length - 1];
    if (kind === "exit") expect(end.opacity).toBe(0);
    else expect(end.transform).toBe("none");
  });

  it("Opening a pane animates: each kind carries its own timing, enter longest and exit shortest", () => {
    const motions = flipFrames(
      new Map([
        [1, rect(0, 0, 200, 100)],
        [2, rect(0, 0, 100, 100)],
      ]),
      new Map([
        [1, rect(0, 0, 100, 100)],
        [3, rect(100, 0, 100, 100)],
      ]),
    );
    const timing = (kind: MotionKind) => {
      const motion = [...motions.values()].find((m) => m.kind === kind);
      expect(motion?.duration).toBeGreaterThan(0);
      expect(motion?.easing).toBeTruthy();
      return { duration: motion?.duration ?? 0, easing: motion?.easing };
    };
    const [enter, move, exit] = (["enter", "move", "exit"] as const).map(timing);
    expect(enter.duration).toBeGreaterThan(move.duration);
    expect(move.duration).toBeGreaterThan(exit.duration);
    expect(new Set([enter.easing, move.easing, exit.easing]).size).toBe(3);
  });

  it("Swap animates: a moved pane starts from its old rect", () => {
    const motion = flipFrames(new Map([[1, rect(0, 0, 200, 100)]]), new Map([[1, rect(50, 10, 100, 50)]])).get(1);
    expect(motion?.frames[0].transform).toBe("translate(-50px, -10px) scale(2, 2)");
  });
});

describe("prefersReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])("Reduced motion: reads the OS setting (%s)", (reduce) => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce") }));
    expect(prefersReducedMotion()).toBe(reduce);
  });
});
