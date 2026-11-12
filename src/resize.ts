/** A terminal's size in character cells. */
export interface Size {
  rows: number;
  cols: number;
}

/** Wraps `fn` so a burst of calls runs it once, `waitMs` after the last call, with that call's arguments. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };
}

/** Whether `next` differs from the size last sent (`undefined` when none was sent yet). */
export function sizeChanged(previous: Size | undefined, next: Size): boolean {
  return previous === undefined || previous.rows !== next.rows || previous.cols !== next.cols;
}

/**
 * Sends a pane's size with `send`, at most once per burst of calls (`waitMs` trailing) and never when
 * the size is unchanged since the last one sent. `measure` is read when the burst has settled.
 */
export function sizeReporter(
  measure: () => Size,
  send: (size: Size) => void,
  waitMs: number,
): { schedule: () => void; reset: () => void } {
  let last: Size | undefined;
  const schedule = debounce(() => {
    const size = measure();
    if (!sizeChanged(last, size)) return;
    last = size;
    send(size);
  }, waitMs);
  return {
    schedule,
    // A new shell has to be told its size again.
    reset: () => {
      last = undefined;
    },
  };
}
