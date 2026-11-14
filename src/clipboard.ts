import type { Terminal } from "@xterm/xterm";
import type { Backend, MenuItem } from "./backend";
import { clipboardAction, type ClipboardAction, type KeyChord, type Platform } from "./keymap";

/** Carries out a clipboard action on the terminal. Copy with nothing selected does nothing. */
async function run(backend: Backend, term: Terminal, action: ClipboardAction): Promise<void> {
  if (action === "copy") {
    const selection = term.getSelection();
    if (selection) await backend.writeClipboard(selection);
  } else if (action === "paste") {
    const text = await backend.readClipboard();
    // term.paste wraps the text in bracketed-paste markers when the shell asked for them.
    if (text) term.paste(text);
  } else {
    term.selectAll();
  }
  term.focus();
}

function runReporting(backend: Backend, term: Terminal, action: ClipboardAction): void {
  run(backend, term, action).catch((error: unknown) => term.write(`\r\nCopy or paste failed: ${String(error)}\r\n`));
}

/**
 * Handles a clipboard shortcut pressed in `term`. Returns true when the key is a clipboard key, which
 * then must not reach the shell. Where the backend's native menus carry the ⌘ shortcuts (the macOS app),
 * the menu carries the action out instead.
 */
export function handleClipboardKey(
  backend: Backend,
  term: Terminal,
  event: KeyChord & { type: string; preventDefault(): void },
  platform: Platform,
): boolean {
  const action = clipboardAction(event, platform);
  if (!action) return false;
  const viaMenu = platform === "macos" && backend.nativeMenus;
  if (!viaMenu && event.type === "keydown") {
    event.preventDefault();
    runReporting(backend, term, action);
  }
  return true;
}

/**
 * Wires the native Edit menu (where the backend has one) and a right-click menu on every platform to
 * `target`, the focused pane's terminal. The right-click menu's Settings… item calls `openSettings`.
 * `elsewhere` gets each action first and returns true when it carried it out in a pane without a terminal.
 * `more` adds items after those; when given, the menu is built afresh each time it opens, so they can change.
 * Returns the handler for a pane's `contextmenu` event.
 */
export async function attachClipboardMenus(
  backend: Backend,
  target: () => Terminal | undefined,
  platform: Platform,
  openSettings: () => void,
  elsewhere: (action: ClipboardAction) => boolean = () => false,
  more?: () => Promise<MenuItem[]>,
): Promise<(event: MouseEvent) => void> {
  const act = (action: ClipboardAction) => {
    if (elsewhere(action)) return;
    const term = target();
    if (term) runReporting(backend, term, action);
  };

  if (platform === "macos" && backend.nativeMenus) {
    await backend.onAppEvent("clipboard", act);
  }

  const items: MenuItem[] = [
    { label: "Copy", action: () => act("copy") },
    { label: "Paste", action: () => act("paste") },
    { separator: true },
    { label: "Settings…", action: () => openSettings() },
  ];
  const fail = (error: unknown) => target()?.write(`\r\nCopy or paste failed: ${String(error)}\r\n`);
  if (!more) {
    const showMenu = await backend.contextMenu(items);
    return (event) => {
      showMenu(event).catch(fail);
    };
  }
  return (event) => {
    // Kept from the webview's own menu now: the items are built after a wait.
    event.preventDefault();
    (async () => {
      const showMenu = await backend.contextMenu([...items, ...(await more())]);
      await showMenu(event);
    })().catch(fail);
  };
}
