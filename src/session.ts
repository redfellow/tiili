import { gridFor, TILING_MODES, type TilingMode } from "./layout";
import type { LayoutState, PaneId } from "./layout/model";

/** What a pane is. */
export type SavedPaneKind = "terminal" | "heynote";

/** One pane as the session file keeps it; `id` is the pane's id when saved and keys its scrollback. */
export interface SavedPane {
  id: number;
  kind: SavedPaneKind;
  cwd?: string;
  /** The remote host the pane was connected to. */
  host?: string;
  /** Pixels the pane's font was zoomed by. */
  zoom: number;
  /** The chip title `tiili open --title` gave the pane. */
  title?: string;
  /** The command line that was running, reported by tiili's shell integration. */
  command?: string;
  /** The name of the program that was running, for shells without the integration. */
  program?: string;
}

/** One tab: its layout and panes in grid order, and which pane had the focus. */
export interface SavedTab {
  layout: LayoutState;
  panes: SavedPane[];
  focused?: number;
  zenPane?: number;
  name?: string;
}

/** What a window tells the app about itself; a window with no tab or no pane does not reopen. */
export interface TabState {
  tabs: SavedTab[];
  activeTab: number;
}

/** A window as the session file keeps it. */
export interface SavedWindow extends TabState {
  label: string;
}

/**
 * What the app hands a reopened window: its saved state, its panes' saved scrollback by saved pane id, and where
 * each local terminal pane opens by saved pane id (its folder, else the nearest existing parent, else `null` for
 * home).
 */
export interface Restored {
  window: SavedWindow;
  scrollback: Record<string, string>;
  folders: Record<string, string | null>;
  /** The home folder, written `~` in the notes. */
  home?: string | null;
}

/** A pane as the window holds it, for {@link snapshotWindow}. */
export type PaneSnapshot = SavedPane;

/**
 * The window's state to save: its panes in grid order, the layout, and the focused pane. `keepCommands` false
 * (Restore scrollback and commands is off) leaves out the command lines; the program names stay for the reminder.
 * A window without panes gives no tab, so it does not reopen.
 */
export function snapshotWindow(
  layout: LayoutState,
  panes: PaneSnapshot[],
  focused: PaneId | undefined,
  keepCommands: boolean,
): TabState {
  const byId = new Map(panes.map((pane) => [pane.id, pane]));
  const ordered = layout.order.flatMap((id) => {
    const pane = byId.get(id);
    if (!pane) return [];
    const saved: SavedPane = { ...pane };
    if (!keepCommands) delete saved.command;
    return [saved];
  });
  if (ordered.length === 0) return { tabs: [], activeTab: 0 };
  const order = ordered.map((pane) => pane.id);
  return {
    tabs: [{
      layout: { ...layout, order },
      panes: ordered,
      focused: focused !== undefined && order.includes(focused) ? focused : undefined,
    }],
    activeTab: 0,
  };
}

/** How one saved pane reopens. */
export interface PaneRestore {
  kind: SavedPaneKind;
  /** The folder its shell starts in; home when absent. */
  cwd?: string;
  zoom: number;
  title?: string;
  /** Written into the terminal before the shell prints anything: scrollback, divider, notes and reminder. */
  preface: string;
  /** The line put into the shell's history, so Up then Enter runs it again. */
  history?: string;
}

/** How a saved window reopens: its panes in grid order, the tiling and track sizes, and the focused pane. */
export interface WindowRestore {
  panes: PaneRestore[];
  mode?: TilingMode;
  /**
   * The grid's columns and rows: in Grid mode the saved shape when it still fits the panes (Grid chose it for the
   * window's shape then), else the grid for the pane count and mode.
   */
  cols: number;
  rows: number;
  /** The column and row sizes, when they still fit the panes' grid. */
  sizes?: { colSizes: number[]; rowSizes: number[] };
  /** Index into `panes`. */
  focused: number;
}

const DIM = "\x1b[2m";
const UNDIM = "\x1b[22m";
/** Ends whatever the saved scrollback left open (colours, a partly drawn line) before tiili's own lines. */
const RESET_LINE = "\x1b[0m\r\n";
export const DIVIDER = "restored from last session";

function dimLine(text: string): string {
  return `${DIM}${text}${UNDIM}\r\n`;
}

/** One line with no control characters, so a saved value cannot drive the terminal. */
function plain(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1f\x7f-\x9f]+/g, " ").trim();
}

function isNumberList(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length &&
    value.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
}

function sumsToOne(sizes: number[]): boolean {
  return Math.abs(sizes.reduce((sum, s) => sum + s, 0) - 1) < 1e-6;
}

/** A saved tab's restore plan, with the name the user gave it. */
export interface TabRestore extends WindowRestore {
  name?: string;
}

/** Every saved tab that has a pane, in strip order, and the index in `tabs` of the tab shown. */
export interface WindowPlans {
  tabs: TabRestore[];
  active: number;
}

/**
 * How `restored`'s active tab reopens, or `undefined` when it has no pane. See {@link tabPlan}.
 */
export function restorePlan(restored: Restored, withScrollback: boolean): WindowRestore | undefined {
  const tab = restored.window.tabs[restored.window.activeTab] ?? restored.window.tabs[0];
  return tab ? tabPlan(tab, restored, withScrollback) : undefined;
}

/**
 * How each of `restored`'s tabs reopens, leaving out the tabs with no pane, and which of them is shown. Resolves to
 * `undefined` when no tab has a pane.
 */
export function restorePlans(restored: Restored, withScrollback: boolean): WindowPlans | undefined {
  const tabs: TabRestore[] = [];
  let active = 0;
  restored.window.tabs.forEach((tab, index) => {
    const plan = tabPlan(tab, restored, withScrollback);
    if (!plan) return;
    if (index === restored.window.activeTab) active = tabs.length;
    tabs.push({ ...plan, name: tab.name });
  });
  return tabs.length > 0 ? { tabs, active } : undefined;
}

/**
 * How saved tab `tab` reopens, or `undefined` when it has no pane. Panes keep their saved grid order, a Grid mode
 * tab its saved columns and rows when they still fit the panes, and the track sizes their saved values when they
 * still match the grid. A terminal pane's preface holds, with
 * `withScrollback`, its saved scrollback and the dim divider; then a dim note when its folder no longer exists, and
 * a dim reminder of what ran: the connected host for a remote pane, else the command line or the program's name.
 * The command line, with `withScrollback`, also becomes the newest history entry. Nothing is ever re-run.
 */
function tabPlan(tab: SavedTab, restored: Restored, withScrollback: boolean): WindowRestore | undefined {
  if (tab.panes.length === 0) return undefined;
  const layout: Partial<LayoutState> = tab.layout && typeof tab.layout === "object" ? tab.layout : {};
  const ids = tab.panes.map((pane) => pane.id);
  const order = Array.isArray(layout.order) && layout.order.length === ids.length &&
    ids.every((id) => layout.order?.includes(id)) ? layout.order : ids;
  const byId = new Map(tab.panes.map((pane) => [pane.id, pane]));
  const saved = order.map((id) => byId.get(id)).filter((pane): pane is SavedPane => pane !== undefined);
  const mode = TILING_MODES.includes(layout.mode as TilingMode) ? (layout.mode as TilingMode) : undefined;
  const { cols, rows } = savedGridShape(layout, saved.length, mode) ?? gridFor(saved.length, mode);
  const sizes = isNumberList(layout.colSizes, cols) && isNumberList(layout.rowSizes, rows) &&
    sumsToOne(layout.colSizes) && sumsToOne(layout.rowSizes)
    ? { colSizes: layout.colSizes, rowSizes: layout.rowSizes }
    : undefined;
  const focused = Math.max(0, saved.findIndex((pane) => pane.id === tab.focused));
  return { panes: saved.map((pane) => paneRestore(restored, pane, withScrollback)), mode, cols, rows, sizes, focused };
}

/**
 * The columns and rows Grid mode chose for the window's shape when `layout` was saved, when they still lay out `n`
 * panes: whole numbers with every row but the last full. `undefined` in another mode or for a shape that does not fit.
 */
function savedGridShape(layout: Partial<LayoutState>, n: number, mode: TilingMode | undefined): { cols: number; rows: number } | undefined {
  if ((mode ?? "grid") !== "grid") return undefined;
  const { cols, rows } = layout;
  if (typeof cols !== "number" || typeof rows !== "number" || !Number.isInteger(cols)) return undefined;
  return cols >= 1 && cols <= n && rows === Math.ceil(n / cols) ? { cols, rows } : undefined;
}

/** `path` with the `home` folder written `~`; home itself when `path` is null. */
function tildify(path: string | null, home: string | null | undefined): string {
  if (path === null) return "~";
  if (!home) return path;
  const rest = path.startsWith(home) ? path.slice(home.length) : undefined;
  return rest !== undefined && (rest === "" || rest.startsWith("/") || rest.startsWith("\\")) ? `~${rest}` : path;
}

function paneRestore(restored: Restored, pane: SavedPane, withScrollback: boolean): PaneRestore {
  const base = { kind: pane.kind, zoom: Number.isFinite(pane.zoom) ? pane.zoom : 0, title: pane.title };
  if (pane.kind === "heynote") return { ...base, preface: "" };
  let preface = "";
  const scrollback = withScrollback ? restored.scrollback[String(pane.id)] : undefined;
  if (scrollback) preface += `${scrollback}${RESET_LINE}${dimLine(`— ${DIVIDER} —`)}`;
  let cwd: string | undefined;
  if (!pane.host && pane.cwd) {
    const key = String(pane.id);
    const opened = key in restored.folders ? restored.folders[key] : pane.cwd;
    cwd = opened ?? undefined;
    if (opened !== pane.cwd) {
      const shown = (path: string | null) => plain(tildify(path, restored.home));
      preface += dimLine(`— folder ${shown(pane.cwd)} no longer exists; opened ${shown(opened)} —`);
    }
  }
  const command = pane.command ? plain(pane.command) : "";
  const program = pane.program ? plain(pane.program) : "";
  if (pane.host) preface += dimLine(`— was connected to ${plain(pane.host)} —`);
  else if (command || program) preface += dimLine(`— was running: ${command || program} —`);
  // A remote pane's command is whatever the remote side printed, so it never seeds the local history.
  const history = withScrollback && command && !pane.host ? pane.command?.trim() : undefined;
  return { ...base, cwd, preface, history };
}
