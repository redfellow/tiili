/** The `pane-cwd` event's payload: where session `paneId`'s shell is, and its repository (`null` outside any). */
export interface PaneCwd {
  paneId: number;
  cwd: string;
  repo: { root: string; name: string } | null;
}

/** Event sent when a shell's working directory or repository changes. */
export const PANE_CWD_EVENT = "pane-cwd";

/** The `pane-command` event's payload: what session `paneId`'s pane runs now (a program's title or process name). */
export interface PaneCommand {
  paneId: number;
  command: string;
}

/** Event sent when what runs in a pane changes. */
export const PANE_COMMAND_EVENT = "pane-command";

/** The chip's text: `place · command`, or just `place` while the command is unknown. */
export function chipLabel(place: string, command?: string): string {
  return command ? `${place} · ${command}` : place;
}

/** The last folder name in `path`, which may use `/` or `\` (Windows); the path itself for a root. */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part !== "");
  // A drive root such as `C:\` names no folder either.
  if (parts.length === 0 || (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0]))) return path;
  return parts[parts.length - 1];
}

/** Creates a pane's title chip, empty until the pane's folder is known. */
export function createPaneChip(): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "pane-chip";
  return chip;
}

/**
 * Shows `label` in the pane's chip. With a `tint`, the pane takes that project tint and the chip shows it with
 * its label colour; without one, the pane is untinted and the chip neutral.
 */
export function showPaneChip(pane: HTMLElement, chip: HTMLElement, label: string, tint?: number): void {
  chip.textContent = label;
  chip.title = label;
  if (tint === undefined) {
    pane.style.removeProperty("--pane-tint");
    pane.style.removeProperty("--pane-tint-on");
    pane.removeAttribute("data-tint");
  } else {
    pane.style.setProperty("--pane-tint", `var(--tint-${tint})`);
    pane.style.setProperty("--pane-tint-on", `var(--tint-${tint}-on)`);
    pane.dataset.tint = String(tint);
  }
}
