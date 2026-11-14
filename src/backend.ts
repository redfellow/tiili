import type { NoteStore } from "./heynoteStore";
import type { PaneCommand, PaneCwd } from "./paneChip";
import type { AppIcon, PromptId, Settings } from "./settings";
import type { WindowEntry } from "./windowMenu";

/** Identifies one shell session of a backend. */
export type SessionId = number;

/** An item of the right-click menu: a labelled action, a separator line, or a labelled submenu of more items. */
export type MenuItem =
  | { label: string; action: () => void }
  | { separator: true }
  | { label: string; items: MenuItem[] };

/**
 * A pane on its way to another window: a terminal with its running session, its serialized scrollback and its
 * zoom offset, or the Heynote pane (whose notes are already saved).
 */
export type MovePayload =
  | { kind: "terminal"; session: SessionId; scrollback: string; zoom: number }
  | { kind: "heynote" };

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
 * pane arriving from another window, settings this window's settings window previews and that window having closed.
 */
export interface AppEvents {
  clipboard: "copy" | "paste" | "selectAll";
  pane: "new" | "close" | "moveToNewWindow";
  "new-window": undefined;
  "move-to-window": string;
  "pane-arrive": { token: string };
  "open-settings": undefined;
  "pane-cwd": PaneCwd;
  "pane-command": PaneCommand;
  "settings-changed": unknown;
  "settings-preview": unknown;
  "settings-closed": undefined;
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
   * config leaves the shell's default one; its output goes to `onOutput`.
   */
  spawn(
    rows: number,
    cols: number,
    cwd: string | undefined,
    prompt: PromptId,
    onOutput: (bytes: Uint8Array) => void,
  ): Promise<SessionId>;
  /**
   * Makes `prompt` the current choice for new shells and the open local zsh, bash and PowerShell shells, where their
   * own config leaves the default prompt; does nothing where shells only take the prompt they start with.
   */
  setPrompt(prompt: PromptId): Promise<void>;
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
  /** Closes the window, after its last pane closed. */
  closeWindow(): Promise<void>;
  /** Opens a full tiili window, cascaded from this one, whose first pane starts in `cwd` (home folder when absent). */
  newWindow(cwd: string | undefined): Promise<void>;
  /** Moving panes between windows; absent where there is one window only (the dev server). */
  readonly moves?: PaneMoves;
  /** Settings in their own OS window; absent where there is one window only (the dev server shows them in the page). */
  readonly settingsWindows?: SettingsWindows;
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
