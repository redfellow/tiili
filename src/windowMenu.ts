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

/** A Move to Tab ▸ entry: the tab's index in the strip and the text the menu shows for it. */
export interface TabMenuEntry {
  index: number;
  text: string;
}

/**
 * The Move to Tab ▸ entries for a window whose tabs are labelled `labels` (in strip order), but tab `current`, the
 * one the pane is in: each named by its label, with ` (2)`, ` (3)`… added to the second and later tabs of a label.
 */
export function tabMenuEntries(labels: string[], current: number): TabMenuEntry[] {
  const seen = new Map<string, number>();
  return labels.flatMap((label, index) => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    if (index === current) return [];
    return [{ index, text: count === 1 ? label : `${label} (${count})` }];
  });
}
