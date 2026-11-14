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

/** Whether window `label` is a settings window, which holds no panes; the core labels them `settings-<owner>`. */
export function isSettingsWindow(label: string): boolean {
  return label.startsWith("settings-");
}

/**
 * The Move to Window ▸ entries for `windows` (in open order) but settings windows: each named by its focused pane's
 * chip text, with ` (2)`, ` (3)`… added to the second and later windows of the same name.
 */
export function menuEntries(windows: WindowEntry[]): WindowMenuEntry[] {
  const seen = new Map<string, number>();
  return windows.filter(({ label }) => !isSettingsWindow(label)).map(({ label, name }) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return { label, text: count === 1 ? name : `${name} (${count})` };
  });
}
