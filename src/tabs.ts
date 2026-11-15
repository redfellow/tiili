/**
 * Pure helpers for a window's tabs: labels, which tab comes next, reordering and lookups across tabs. The window
 * (src/panes.ts) and the tab strip (src/topBar.ts) use them; they hold no DOM or terminal state.
 */

/** A tab's label: its lasting name when it has one, else the focused pane's chip text. */
export function tabLabel(name: string | undefined, chip: string): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : chip;
}

/** The index `step` places from `index` among `count` tabs, wrapping at both ends. */
export function stepIndex(index: number, count: number, step: number): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}

/** The index `step` places from `index` among `count` tabs, or undefined past either end (no wrapping). */
export function neighbourIndex(index: number, count: number, step: number): number | undefined {
  const next = index + step;
  return next >= 0 && next < count ? next : undefined;
}

/** `list` with the item at `from` moved to `to`; out-of-range indexes leave it unchanged. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return result;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item as T);
  return result;
}

/** Where a new tab goes: right after the shown one. */
export function insertBeside(shown: number): number {
  return shown + 1;
}

/** The index of the tab holding `session`, or undefined when no tab does. */
export function tabOf<T>(tabs: readonly (readonly T[])[], session: T): number | undefined {
  const index = tabs.findIndex((sessions) => sessions.includes(session));
  return index < 0 ? undefined : index;
}

/** How many of a tab's sessions are marked as needing the user. */
export function badgeCount<T>(sessions: readonly T[], marked: ReadonlySet<T>): number {
  return sessions.filter((session) => marked.has(session)).length;
}

/** What the tab strip shows for one tab. */
export interface TabEntry {
  label: string;
  /** The focused pane's project tint, which the label is shown in; undefined outside a repository. */
  tint?: number;
  /** How many of the tab's panes need the user; 0 for the shown tab, whose panes show their own marks. */
  attention: number;
}

/** The window's tab strip, as the window drives it. */
export interface TabStrip {
  /** Shows `entries` in strip order with tab `shown` highlighted; hidden with one entry. */
  update(entries: TabEntry[], shown: number): void;
  /** Turns tab `index`'s label into a field for its new name, for the tab menu's Rename…. */
  rename(index: number): void;
}
