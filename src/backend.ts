import type { AttentionMark } from "./attention";
import type { NoteStore } from "./heynoteStore";
import type { ResolvedPath } from "./links";
import type { PaneCommand, PaneCwd } from "./paneChip";
import type { Restored, TabState } from "./session";
import type { AppIcon, PromptId, Settings } from "./settings";
import type { WindowEntry } from "./windowMenu";

/** Identifies one shell session of a backend. */
export type SessionId = number;

/** A program a pane runs directly instead of a shell, found on `path` when given, else on the app's own `PATH`. */
export interface PaneLaunch {
  command: string[];
  path?: string;
}

/**
 * The window is asked for a pane by `tiili open`: one running `command` in `cwd` (home folder when null), its chip
 * reading `title` when given. The window answers through {@link PaneControl.done} with `requestId`.
 */
export interface PaneOpenRequest {
  requestId: number;
  /** The session `tiili open` ran in, whose tab the new pane joins. */
  caller: SessionId;
  cwd: string | null;
  title: string | null;
  command: string[];
  path: string | null;
}

/** The window is asked by `tiili close` to close the pane running `session`; it answers {@link PaneControl.closed}. */
export interface PaneCloseRequest {
  requestId: number;
  session: SessionId;
}

/**
 * `tiili attention` from the pane running `session`: mark it with `message` as a notification escape code would, or
 * with `clear` take its mark away.
 */
export interface PaneAttentionRequest {
  session: SessionId;
  message: string | null;
  clear: boolean;
}

/** Answering the `tiili` command line, where the backend runs it (the Tauri app). */
export interface PaneControl {
  /** Answers request `requestId`: the session of the pane it opened, else why it could not. */
  done(requestId: number, result: { pane: SessionId } | { error: string }): Promise<void>;
  /** Answers close request `requestId`: closed, else why it could not. */
  closed(requestId: number, error?: string): Promise<void>;
  /**
   * Tells the app this window's sessions tab by tab in strip order, each in grid order (left to right, top to
   * bottom), which `tiili list` follows.
   */
  setOrder(tabs: SessionId[][]): Promise<void>;
}

/** An item of the right-click menu: a labelled action, a separator line, or a labelled submenu of more items. */
export type MenuItem =
  | { label: string; action: () => void }
  | { separator: true }
  | { label: string; items: MenuItem[] };

/**
 * A pane on its way to another window: a terminal with its running session, its serialized scrollback and its
 * zoom offset, or the Heynote pane (whose notes are already saved).
 */
export type MovePayload = PaneMovePayload | TabMovePayload;

/** One pane that moves: a terminal pane's session with its scrollback and zoom offset, or the Heynote pane. */
export type PaneMovePayload =
  | { kind: "terminal"; session: SessionId; scrollback: string; zoom: number }
  | { kind: "heynote" };

/**
 * A whole tab that moves (Pop Out): its lasting name, its grid's track sizes, its focused pane's index and its panes
 * in grid order, all under one token.
 */
export interface TabMovePayload {
  kind: "tab";
  name?: string;
  layout: { colSizes: number[]; rowSizes: number[] };
  focused: number;
  panes: PaneMovePayload[];
}

/** The Shell menu's tab items, which the "pane" event names: New Tab, Next and Previous Tab, Move Pane to Next or Previous Tab. */
export type TabMenuId = "tabNew" | "tabNext" | "tabPrevious" | "tabMoveNext" | "tabMovePrevious";

/** Moving panes between windows, where the backend has more than one window. */
export interface PaneMoves {
  /** Session `id`'s output is kept, not sent, from now until a pane attaches it. */
  detach(id: SessionId): Promise<void>;
  /** This window's pane takes session `id`: the output kept since `detach`, then all after it, goes to `onOutput`. */
  attach(id: SessionId, onOutput: (bytes: Uint8Array) => void): Promise<void>;
  /** The other open windows, in open order, each named by its focused pane. */
  list(): Promise<WindowEntry[]>;
  /** Tells the app this window's name: its focused pane's chip text. */
  setName(name: string): Promise<void>;
  /** Sends `payload` to window `target`, or to a new window when absent. */
  move(target: string | undefined, payload: MovePayload): Promise<void>;
  /** The pane sent to this window under `token`, once; undefined when there is none. */
  take(token: string): Promise<MovePayload | undefined>;
}

/** Panes that need the user, kept app-wide by session so a mark follows its pane to another window. */
export interface PaneAttention {
  /**
   * Marks session `id` as needing the user, with `message` when the shell sent one; `title` is its pane's chip text,
   * which a desktop notification shows. Marking a marked session again only adds a message it lacked.
   */
  mark(id: SessionId, message: string | undefined, title: string): Promise<void>;
  /** Clears session `id`'s mark, if it has one. */
  clear(id: SessionId): Promise<void>;
  /** Brings the window of the oldest marked pane to the front and has it focus that pane, which clears its mark. */
  next(): Promise<void>;
  /** Every marked session, oldest first. */
  list(): Promise<AttentionMark[]>;
}

/** What runs in a session: the command line tiili's shell integration reported, else the foreground program's name. */
export interface RunningCommand {
  command?: string;
  program?: string;
}

/** Saving this window for the next launch, where the backend keeps a session (the Tauri app). */
export interface SessionSaving {
  /** This window's saved state, once, right after it opened; undefined for a window that was not reopened. */
  load(): Promise<Restored | undefined>;
  /** Tells the app this window's tabs and panes; a state with no tab means the window does not reopen. */
  update(state: TabState): Promise<void>;
  /** Saves pane `paneId`'s scrollback for the next launch. */
  saveScrollback(paneId: number, text: string): Promise<void>;
  /** Deletes every saved scrollback and command line, for Restore scrollback and commands turned off. */
  clearScrollback(): Promise<void>;
  /** Tells the app this window answered `session-flush`: its latest state and scrollback are in. */
  flushed(): Promise<void>;
  /** What runs in session `id` now. */
  running(id: SessionId): Promise<RunningCommand>;
}

/** Settings in a window of their own, where the backend can open OS windows. */
export interface SettingsWindows {
  /** Opens this window's settings window centred over it, or brings it to the front when it is open already. */
  open(): Promise<void>;
  /** From a settings window: previews `settings` in window `owner`, the tiili window that opened it. */
  preview(owner: string, settings: Settings): Promise<void>;
  /** From a settings window: runs `handler` before the window closes by its OS close control. */
  onCloseRequested(handler: () => Promise<void>): Promise<void>;
}

/**
 * Events the app sends this window: native menu items (when this window is focused), the app menu's Settings…, a
 * shell's working directory report and what runs in a pane (for this window's shells), settings another window
 * saved, the ask to focus this window's Heynote pane, the Move to Window ▸ choice (the target window's label), a
 * pane arriving from another window, settings this window's settings window previews and that window having closed,
 * the panes that need the user (every window hears these), the ask to focus one of this window's marked panes and
 * `tiili open` asking this window for a pane, and the app ending, which asks this window to save itself.
 */
export interface AppEvents {
  clipboard: "copy" | "paste" | "selectAll" | "find" | "findNext" | "findPrevious";
  pane: "new" | "close" | "moveToNewWindow" | "zen" | TabMenuId;
  "new-window": undefined;
  "move-to-window": string;
  "pane-arrive": { token: string };
  "open-settings": undefined;
  "pane-cwd": PaneCwd;
  "pane-command": PaneCommand;
  "settings-changed": unknown;
  "settings-preview": unknown;
  "settings-closed": undefined;
  "attention-changed": { marks: AttentionMark[] };
  "attention-focus": SessionId;
  "pane-open-request": PaneOpenRequest;
  "pane-close-request": PaneCloseRequest;
  "pane-attention-request": PaneAttentionRequest;
  "session-flush": undefined;
}

/**
 * Everything the frontend asks of the outside world: shells, the clipboard, menus, settings and the window.
 * The Tauri app and the browser dev server each provide one.
 */
export interface Backend {
  /** True when native menus (the macOS menu bar) carry out ⌘ shortcuts, so the page must not act on them too. */
  readonly nativeMenus: boolean;
  /**
   * Starts a default shell of `rows` x `cols` in `cwd` (home folder when absent) with `prompt` where the user's own
   * config leaves the shell's default one; its output goes to `onOutput`. With `launch` the session runs that
   * program instead of a shell, where the backend can (the dev server always starts a shell). A shell started with
   * `history` has that line as its newest history entry, where the backend can.
   */
  spawn(
    rows: number,
    cols: number,
    cwd: string | undefined,
    prompt: PromptId,
    onOutput: (bytes: Uint8Array) => void,
    launch?: PaneLaunch,
    history?: string,
  ): Promise<SessionId>;
  /**
   * Makes `prompt` the current choice for new shells and the open local zsh, bash and PowerShell shells, where their
   * own config leaves the default prompt; does nothing where shells only take the prompt they start with.
   */
  setPrompt(prompt: PromptId): Promise<void>;
  /**
   * Makes `colour` (`#RRGGBB`) the background local zsh and bash 5.1+ shells give pasted text and their own selection,
   * from their next prompt on, in place of reverse video; does nothing where shells are not tiili's own.
   */
  setHighlight(colour: string): Promise<void>;
  /** Sends typed input to session `id`'s shell. */
  write(id: SessionId, data: string): Promise<void>;
  /** Tells session `id`'s shell its terminal now has `rows` x `cols`. */
  resize(id: SessionId, rows: number, cols: number): Promise<void>;
  /** Ends session `id`, killing its shell if it still runs. */
  close(id: SessionId): Promise<void>;
  /** The working directory of session `id`'s shell, when the backend can read it. */
  cwd(id: SessionId): Promise<string | undefined>;
  /** Calls `callback` whenever a shell exits. Resolves to a function that stops listening. */
  onExit(callback: (id: SessionId, code: number) => void): Promise<() => void>;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  /**
   * Opens `uri` in the system's handler for its scheme. The core refuses forbidden schemes, and schemes other than
   * `http`, `https` and `mailto` unless `confirmed` (the user agreed in tiili's dialog).
   */
  openLink(uri: string, confirmed: boolean): Promise<void>;
  /**
   * The existing file or folder each of `candidates` names in session `id`'s current folder, in order; null where
   * none does, and for every candidate in a remote or WSL pane.
   */
  resolvePaths(id: SessionId, candidates: string[]): Promise<(ResolvedPath | null)[]>;
  /** Opens the file at absolute `abs` in its default app, or the folder in the file manager; refuses launchers. */
  openPath(abs: string): Promise<void>;
  /** Shows the file or folder at absolute `abs` selected in the file manager. */
  revealPath(abs: string): Promise<void>;
  /** Builds the right-click menu once; the returned function shows it for a `contextmenu` event. */
  contextMenu(items: MenuItem[]): Promise<(event: MouseEvent) => Promise<void>>;
  /** Calls `callback` when a native menu sends `name`; does nothing where there are no native menus. */
  onAppEvent<K extends keyof AppEvents>(name: K, callback: (payload: AppEvents[K]) => void): Promise<void>;
  /** The saved settings, or null when there are none. */
  loadSettings(): Promise<unknown>;
  saveSettings(value: unknown): Promise<void>;
  /** Shows the light or dark app icon (Dock on macOS, window and taskbar elsewhere) for the user's choice. */
  setAppIcon(choice: AppIcon): Promise<void>;
  /** Where the Heynote pane keeps its notes. */
  readonly notes: NoteStore;
  /** Sets this window's title, as the window switcher and taskbar show it; does nothing where there is no window. */
  setTitle(title: string): Promise<void>;
  /** Closes the window, after its last pane closed. */
  closeWindow(): Promise<void>;
  /** Opens a full tiili window, cascaded from this one, whose first pane starts in `cwd` (home folder when absent). */
  newWindow(cwd: string | undefined): Promise<void>;
  /** Moving panes between windows; absent where there is one window only (the dev server). */
  readonly moves?: PaneMoves;
  /** Marking panes that need the user; absent where nothing tracks them (the dev server). */
  readonly attention?: PaneAttention;
  /** Settings in their own OS window; absent where there is one window only (the dev server shows them in the page). */
  readonly settingsWindows?: SettingsWindows;
  /** Answering `tiili open`; absent where nothing runs the command line (the dev server). */
  readonly paneControl?: PaneControl;
  /** Saving the window for the next launch; absent where nothing is kept (the dev server). */
  readonly session?: SessionSaving;
}

export type BackendKind = "tauri" | "dev";

/** Which backend the page runs on: Tauri when its internals are on `win`, else the dev server's WebSocket bridge. */
export function selectBackend(win: object): BackendKind {
  return "__TAURI_INTERNALS__" in win ? "tauri" : "dev";
}

/**
 * Loads the backend for this page. Each is imported on demand, so the browser never evaluates Tauri plugins.
 * Builds hold the Tauri backend only: the WebSocket one exists for the dev server.
 */
export async function loadBackend(win: Window = window): Promise<Backend> {
  if (!import.meta.env.DEV || selectBackend(win) === "tauri") {
    const { tauriBackend } = await import("./backend-tauri");
    return tauriBackend();
  }
  const { wsBackend } = await import("./backend-ws");
  return wsBackend();
}
