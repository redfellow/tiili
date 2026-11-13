import type { NoteStore } from "./heynoteStore";
import type { PaneCommand, PaneCwd } from "./paneChip";
import type { AppIcon, PromptId } from "./settings";

/** Identifies one shell session of a backend. */
export type SessionId = number;

/** An item of the right-click menu: a labelled action, or a separator line. */
export type MenuItem = { label: string; action: () => void } | { separator: true };

/**
 * Events the app sends this window: native menu items (when this window is focused), the app menu's Settings…, a
 * shell's working directory report and what runs in a pane (for this window's shells), settings another window
 * saved, and the ask to focus this window's Heynote pane.
 */
export interface AppEvents {
  clipboard: "copy" | "paste" | "selectAll";
  pane: "new" | "close";
  "new-window": undefined;
  "open-settings": undefined;
  "pane-cwd": PaneCwd;
  "pane-command": PaneCommand;
  "settings-changed": unknown;
  "heynote-focus": undefined;
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
  /**
   * Asks to open the app's one Heynote pane in this window: resolves to null when this window may (it then holds
   * it), else to the label of the window that already does.
   */
  claimHeynote(): Promise<string | null>;
  /** This window closed its Heynote pane, so another window may open one. */
  releaseHeynote(): Promise<void>;
  /** Brings window `label` forward and has it focus its Heynote pane. */
  focusHeynote(label: string): Promise<void>;
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
