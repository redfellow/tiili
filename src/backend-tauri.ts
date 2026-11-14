import { Channel, invoke } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Backend, MenuItem, MovePayload } from "./backend";
import { noteListeners, type NotesChanged } from "./heynoteStore";
import { currentPlatform } from "./keymap";

type NativeItem =
  | { item: "Separator" }
  | { id: string; text: string; action: () => void }
  | { id: string; text: string; items: NativeItem[] };

/** `items` as Tauri menu options, each with an id unique in the menu (`prefix` and its place). */
function nativeItems(items: MenuItem[], prefix = "item"): NativeItem[] {
  return items.map((item, index) => {
    const id = `${prefix}-${index}`;
    if ("separator" in item) return { item: "Separator" as const };
    if ("items" in item) return { id, text: item.label, items: nativeItems(item.items, id) };
    return { id, text: item.label, action: () => item.action() };
  });
}

/** The Tauri app's backend: PTY commands, the clipboard plugin, native menus and the settings file. */
export function tauriBackend(): Backend {
  // Listening on this window, not app-wide: events the core sends another window must not reach this one.
  const listen = <T>(name: string, handler: (event: { payload: T }) => void) =>
    getCurrentWebviewWindow().listen<T>(name, handler);
  // One app event listener for all of this window's Heynote panes, started with the first that subscribes.
  const notesChanged = noteListeners();
  let listening: Promise<unknown> | undefined;
  return {
    nativeMenus: currentPlatform() === "macos",
    spawn: (rows, cols, cwd, prompt, onOutput) => {
      const output = new Channel<number[]>();
      output.onmessage = (bytes) => onOutput(new Uint8Array(bytes));
      return invoke<number>("pty_spawn", { rows, cols, cwd, prompt, onOutput: output });
    },
    write: (id, data) => invoke("pty_write", { id, data }),
    resize: (id, rows, cols) => invoke("pty_resize", { id, rows, cols }),
    close: (id) => invoke("pty_close", { id }),
    cwd: async (id) => (await invoke<string | null>("pty_cwd", { id })) ?? undefined,
    onExit: (callback) =>
      listen<{ id: number; code: number }>("pty-exit", (event) => callback(event.payload.id, event.payload.code)),
    readClipboard: () => readText(),
    writeClipboard: (text) => writeText(text),
    contextMenu: async (items) => {
      const menu = await Menu.new({ items: nativeItems(items) });
      return async (event) => {
        event.preventDefault();
        await menu.popup();
      };
    },
    onAppEvent: async (name, callback) => {
      await listen(name, (event) => callback(event.payload as Parameters<typeof callback>[0]));
    },
    loadSettings: () => invoke("settings_load"),
    saveSettings: (value) => invoke("settings_save", { value }),
    setAppIcon: (choice) => invoke("app_icon_set", { choice }),
    notes: {
      load: () => invoke("heynote_load"),
      write: (path, content, origin) => invoke("heynote_write", { path, content, origin }),
      remove: (path, origin) => invoke("heynote_remove", { path, origin }),
      move: (from, to, origin) => invoke("heynote_move", { from, to, origin }),
      mkdir: (path, origin) => invoke("heynote_mkdir", { path, origin }),
      rmdir: (path, origin) => invoke("heynote_rmdir", { path, origin }),
      saveState: (state) => invoke("heynote_save_state", { state }),
      subscribe: (listener) => {
        listening ??= listen<NotesChanged>("heynote-notes-changed", (event) => notesChanged.notify(event.payload));
        return notesChanged.subscribe(listener);
      },
    },
    closeWindow: () => getCurrentWindow().close(),
    newWindow: (cwd) => invoke("window_new", { cwd }),
    moves: {
      detach: (id) => invoke("pty_detach", { id }),
      attach: (id, onOutput) => {
        const output = new Channel<number[]>();
        output.onmessage = (bytes) => onOutput(new Uint8Array(bytes));
        return invoke("pty_attach", { id, onOutput: output });
      },
      list: () => invoke("window_list"),
      setName: (name) => invoke("window_set_name", { name }),
      move: (target, payload) => invoke("pane_move", { target: target ?? null, payload }),
      take: async (token) => (await invoke<MovePayload | null>("pane_move_take", { token })) ?? undefined,
    },
  };
}
