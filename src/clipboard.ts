import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Terminal } from "@xterm/xterm";
import { clipboardAction, currentPlatform, type ClipboardAction } from "./keymap";

/** Carries out a clipboard action on the terminal. Copy with nothing selected does nothing. */
async function run(term: Terminal, action: ClipboardAction): Promise<void> {
  if (action === "copy") {
    const selection = term.getSelection();
    if (selection) await writeText(selection);
  } else if (action === "paste") {
    const text = await readText();
    // term.paste wraps the text in bracketed-paste markers when the shell asked for them.
    if (text) term.paste(text);
  } else {
    term.selectAll();
  }
  term.focus();
}

/**
 * Wires copy and paste: platform shortcuts, the macOS Edit menu and a right-click menu on every platform.
 */
export async function attachClipboard(term: Terminal, container: HTMLElement): Promise<void> {
  const platform = currentPlatform();
  const report = (error: unknown) => term.write(`\r\nCopy or paste failed: ${String(error)}\r\n`);

  term.attachCustomKeyEventHandler((event) => {
    const action = clipboardAction(event, platform);
    if (!action) return true;
    // On macOS the Edit menu's ⌘ shortcuts carry the action out; here the key is only kept from the shell.
    if (platform !== "macos" && event.type === "keydown") {
      event.preventDefault();
      run(term, action).catch(report);
    }
    return false;
  });

  if (platform === "macos") {
    await listen<ClipboardAction>("clipboard", (event) => {
      run(term, event.payload).catch(report);
    });
  }

  const contextMenu = await Menu.new({
    items: [
      { id: "copy", text: "Copy", action: () => run(term, "copy").catch(report) },
      { id: "paste", text: "Paste", action: () => run(term, "paste").catch(report) },
    ],
  });
  container.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    contextMenu.popup().catch(report);
  });
}
