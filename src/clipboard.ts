import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Terminal } from "@xterm/xterm";
import { clipboardAction, type ClipboardAction, type KeyChord, type Platform } from "./keymap";

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

function runReporting(term: Terminal, action: ClipboardAction): void {
  run(term, action).catch((error: unknown) => term.write(`\r\nCopy or paste failed: ${String(error)}\r\n`));
}

/**
 * Handles a clipboard shortcut pressed in `term`. Returns true when the key is a clipboard key, which
 * then must not reach the shell. On macOS the Edit menu's ⌘ shortcuts carry the action out instead.
 */
export function handleClipboardKey(
  term: Terminal,
  event: KeyChord & { type: string; preventDefault(): void },
  platform: Platform,
): boolean {
  const action = clipboardAction(event, platform);
  if (!action) return false;
  if (platform !== "macos" && event.type === "keydown") {
    event.preventDefault();
    runReporting(term, action);
  }
  return true;
}

/**
 * Wires the macOS Edit menu and a right-click menu on every platform to `target`, the focused pane's
 * terminal. The right-click menu's Settings… item calls `openSettings`. Returns the handler for a pane's
 * `contextmenu` event.
 */
export async function attachClipboardMenus(
  target: () => Terminal | undefined,
  platform: Platform,
  openSettings: () => void,
): Promise<(event: MouseEvent) => void> {
  const act = (action: ClipboardAction) => {
    const term = target();
    if (term) runReporting(term, action);
  };

  if (platform === "macos") {
    await listen<ClipboardAction>("clipboard", (event) => act(event.payload));
  }

  const contextMenu = await Menu.new({
    items: [
      { id: "copy", text: "Copy", action: () => act("copy") },
      { id: "paste", text: "Paste", action: () => act("paste") },
      { item: "Separator" },
      { id: "settings", text: "Settings…", action: () => openSettings() },
    ],
  });
  return (event) => {
    event.preventDefault();
    contextMenu.popup().catch((error: unknown) => target()?.write(`\r\nCopy or paste failed: ${String(error)}\r\n`));
  };
}
