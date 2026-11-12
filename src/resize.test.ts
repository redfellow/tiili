// @harvaaja-test-tier: fast
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, sizeChanged, sizeReporter, type Size } from "./resize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  it("runs a burst of calls once, after the last, with its arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    for (let i = 0; i < 10; i++) {
      debounced(i);
      vi.advanceTimersByTime(20);
    }
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(9);
  });
});

describe("sizeChanged", () => {
  it.each<[Size | undefined, Size, boolean]>([
    [undefined, { rows: 24, cols: 80 }, true],
    [{ rows: 24, cols: 80 }, { rows: 24, cols: 80 }, false],
    [{ rows: 24, cols: 80 }, { rows: 25, cols: 80 }, true],
    [{ rows: 24, cols: 80 }, { rows: 24, cols: 81 }, true],
  ])("%o → %o changed: %s", (previous, next, expected) => {
    expect(sizeChanged(previous, next)).toBe(expected);
  });
});

describe("sizeReporter", () => {
  it("Each session its own size: sends once per settled burst and nothing when unchanged", () => {
    let size: Size = { rows: 24, cols: 80 };
    const send = vi.fn();
    const reporter = sizeReporter(() => size, send, 50);

    reporter.schedule();
    size = { rows: 30, cols: 100 };
    reporter.schedule();
    vi.advanceTimersByTime(50);
    expect(send.mock.calls).toEqual([[{ rows: 30, cols: 100 }]]);

    reporter.schedule();
    vi.advanceTimersByTime(50);
    expect(send).toHaveBeenCalledTimes(1);

    reporter.reset();
    reporter.schedule();
    vi.advanceTimersByTime(50);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
