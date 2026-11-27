/**
 * The pure rules behind minimized panes: where a restored pane goes back in its grid, how many badges fit the top
 * bar, where the macOS title sits beside them, and what a badge shows.
 */

/** Where a minimized pane's process stands. */
export type MinimizedState =
  | { kind: "live" }
  /** Its process exited while it was minimized. */
  | { kind: "exited"; code: number }
  /** Brought back by session restore: its program no longer runs; `command` is what it ran, when known. */
  | { kind: "stopped"; command: string | null };

/** What a badge shows. */
export type BadgeState =
  | { kind: "running" }
  | { kind: "needs-you" }
  | { kind: "exited"; code: number }
  | { kind: "stopped" };

/**
 * The grid index a restored pane goes back to: `at`, its index when it was minimized, while its tab holds the same
 * other panes as then (`peers`, in any order); else the grid's end, since its old place no longer means anything.
 */
export function restoreIndex(at: number, peers: readonly number[], current: readonly number[]): number {
  const same = peers.length === current.length && current.every((id) => peers.includes(id));
  return same ? Math.max(0, Math.min(at, current.length)) : current.length;
}

/**
 * How many badges of `widths` (each with its gap) fit in `available` pixels: all of them when they fit, else as many
 * as fit beside the `+N` badge, `plusWidth` wide, with the rest hidden behind it.
 */
export function fitBadges(
  widths: readonly number[],
  available: number,
  plusWidth: number,
): { shown: number; hidden: number } {
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= available) return { shown: widths.length, hidden: 0 };
  let shown = 0;
  let used = plusWidth;
  while (shown < widths.length && used + widths[shown] <= available) used += widths[shown++];
  return { shown, hidden: widths.length - shown };
}

/** Where the title goes: centred in the bar, moved `x` pixels from the centre, or hidden. */
export type TitlePlacement = { kind: "centred" } | { kind: "slid"; x: number } | { kind: "hidden" };

/**
 * Where the bar's title, `title` pixels wide, sits in a bar `bar` pixels wide whose badges (or tabs) end at
 * `badgesEnd` and whose right-hand buttons start at `actionsStart`, both from the bar's left: centred while it clears
 * both, else in the middle of the space between them, else hidden when that space is narrower than the title.
 */
export function titlePlacement(bar: number, title: number, badgesEnd: number, actionsStart: number): TitlePlacement {
  const left = (bar - title) / 2;
  if (badgesEnd <= left && actionsStart >= left + title) return { kind: "centred" };
  if (actionsStart - badgesEnd < title) return { kind: "hidden" };
  return { kind: "slid", x: (badgesEnd + actionsStart) / 2 - bar / 2 };
}

/** What a badge shows for a pane in `state`, `marked` when the pane needs the user: an exit wins, then the mark. */
export function badgeState(state: MinimizedState, marked: boolean): BadgeState {
  if (state.kind === "exited") return { kind: "exited", code: state.code };
  if (marked) return { kind: "needs-you" };
  return state.kind === "stopped" ? { kind: "stopped" } : { kind: "running" };
}

/**
 * A badge's label: `was running: <command>` for a pane session restore brought back, else the command the pane runs,
 * else its chip text.
 */
export function badgeLabel(state: MinimizedState, command: string | undefined, chip: string): string {
  if (state.kind === "stopped" && state.command) return `was running: ${state.command}`;
  return command || chip;
}

/**
 * The minimized pane that comes back when the window's last visible pane has closed: the one minimized last, so the
 * window stays open. Undefined while panes are still visible, or when none is minimized and the window closes.
 */
export function bringBack<T>(minimized: readonly T[], visible: number): T | undefined {
  return visible === 0 ? minimized[minimized.length - 1] : undefined;
}
