/**
 * The `pane-cwd` event's payload: where session `paneId`'s shell is, its repository (`null` outside any) and the
 * host a remote pane is on (`null` for this machine).
 */
export interface PaneCwd {
  paneId: number;
  cwd: string;
  /** `worktree` is a linked worktree's branch, or its worktree name on a detached HEAD; null in a main checkout. */
  repo: { root: string; name: string; worktree?: string | null } | null;
  host: string | null;
  /** The pane's project tint, assigned app-wide so a repository has the same tint in every window; null untinted. */
  tint: number | null;
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

/**
 * The chip's place: the repository name, followed by ` › branch` (or worktree name) in a linked worktree, else the
 * folder name; a remote pane's is prefixed with its host, as `host:name`.
 */
export function placeLabel(place: Pick<PaneCwd, "cwd" | "repo" | "host">): string {
  const { repo } = place;
  const name = !repo ? folderName(place.cwd) : repo.worktree ? `${repo.name} › ${repo.worktree}` : repo.name;
  return place.host === null ? name : `${place.host}:${name}`;
}

/** Creates a pane's title chip, empty until the pane's folder is known. */
export function createPaneChip(): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "pane-chip";
  chip.addEventListener("animationend", () => chip.removeAttribute("data-pulse"));
  return chip;
}

/** The chip's text span, made on first use, after the brick when there is one. */
function chipText(chip: HTMLElement): HTMLElement {
  let text = chip.querySelector<HTMLElement>(".pane-chip-text");
  if (!text) {
    text = document.createElement("span");
    text.className = "pane-chip-text";
    chip.append(text);
  }
  return text;
}

/** The chip's tooltip: its label, then the attention message on a line of its own. */
function chipTooltip(chip: HTMLElement): void {
  const label = chipText(chip).textContent ?? "";
  const message = chip.dataset.message;
  chip.title = message ? `${label}\n${message}` : label;
}

/**
 * Shows `label` in the pane's chip. With a `tint`, the pane takes that project tint and the chip shows it with
 * its label colour; without one, the pane is untinted and the chip neutral.
 */
export function showPaneChip(pane: HTMLElement, chip: HTMLElement, label: string, tint?: number): void {
  chipText(chip).textContent = label;
  chipTooltip(chip);
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

/**
 * Shows whether the pane needs the user: marked, its chip gets a brick before its text and the message (if any) in
 * its tooltip, and the pane is not faded; unmarked (`mark` undefined), both go. The chip pulses once when the mark
 * is new. The chip's text stays its label.
 */
export function showPaneAttention(
  pane: HTMLElement,
  chip: HTMLElement,
  mark: { message: string | null } | undefined,
): void {
  const text = chipText(chip);
  let brick = chip.querySelector<HTMLElement>(".pane-chip-brick");
  if (mark) {
    if (!brick) {
      brick = document.createElement("span");
      brick.className = "pane-chip-brick";
      brick.setAttribute("aria-hidden", "true");
      chip.insertBefore(brick, text);
      chip.removeAttribute("data-pulse");
      // Reading the layout restarts the pulse animation for a mark that comes back.
      void chip.offsetWidth;
      chip.dataset.pulse = "";
    }
    pane.dataset.attention = "";
    if (mark.message) chip.dataset.message = mark.message;
    else delete chip.dataset.message;
  } else {
    brick?.remove();
    chip.removeAttribute("data-pulse");
    pane.removeAttribute("data-attention");
    delete chip.dataset.message;
  }
  chipTooltip(chip);
}
