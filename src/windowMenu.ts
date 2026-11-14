/** Another open tiili window as the core lists it: its label and its focused pane's chip text. */
export interface WindowEntry {
  label: string;
  name: string;
}

/** A Move to Window ▸ entry: the window's label and the text the menu shows for it. */
export interface WindowMenuEntry {
  label: string;
  text: string;
}

/**
 * The Move to Window ▸ entries for `windows` (in open order): each named by its focused pane's chip text, with
 * ` (2)`, ` (3)`… added to the second and later windows of the same name.
 */
export function menuEntries(windows: WindowEntry[]): WindowMenuEntry[] {
  const seen = new Map<string, number>();
  return windows.map(({ label, name }) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return { label, text: count === 1 ? name : `${name} (${count})` };
  });
}
