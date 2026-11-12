import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Backend } from "./backend";
import { currentPlatform } from "./keymap";

/** The Tauri app's backend: PTY commands, the clipboard plugin, native menus and the settings file. */
export function tauriBackend(): Backend {
  return {
    nativeMenus: currentPlatform() === "macos",
    spawn: (rows, cols, cwd, onOutput) => {
      const output = new Channel<number[]>();
      output.onmessage = (bytes) => onOutput(new Uint8Array(bytes));
      return invoke<number>("pty_spawn", { rows, cols, cwd, onOutput: output });
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
      const menu = await Menu.new({
        items: items.map((item, index) =>
          "separator" in item
            ? { item: "Separator" as const }
            : { id: `item-${index}`, text: item.label, action: () => item.action() },
        ),
      });
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
    closeWindow: () => getCurrentWindow().close(),
  };
}
