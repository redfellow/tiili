import type { Terminal } from "@xterm/xterm";
import type { Backend, MenuItem } from "./backend";
import { clipboardAction, FIND_MENU_ITEMS, type ClipboardAction, type KeyChord, type Platform } from "./keymap";
import { revealLabel, type HoveredLink } from "./links";
import type { PaneLinks } from "./terminalLinks";

/**
 * Clipboard text made safe to paste: the bracketed-paste markers (`ESC[200~`, `ESC[201~`) are removed, so
 * pasted text can't end the paste early and have the shell run the rest, and so are C0 controls other than
 * tab, newline and carriage return, DEL and C1 controls.
 */
export function sanitizePaste(text: string): string {
  return text.replace(PASTE_MARKERS, "").replace(UNSAFE_CONTROLS, "");
}

/* eslint-disable no-control-regex -- these match the control characters a paste must not carry */
const PASTE_MARKERS = /\x1b\[20[01]~/g;
const UNSAFE_CONTROLS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
/* eslint-enable no-control-regex */

/** Carries out a clipboard action on the terminal. Copy with nothing selected does nothing. */
async function run(backend: Backend, term: Terminal, action: ClipboardAction): Promise<void> {
  if (action === "copy") {
    const selection = term.getSelection();
    if (selection) await backend.writeClipboard(selection);
  } else if (action === "paste") {
    const text = await backend.readClipboard();
    // term.paste wraps the text in bracketed-paste markers when the shell asked for them.
    const safe = text ? sanitizePaste(text) : "";
    if (safe) term.paste(safe);
  } else {
    term.selectAll();
  }
  term.focus();
}

/** The right-click menu's items for `link`, the link under the pointer, ahead of Copy and Paste. */
function linkItems(
  backend: Backend,
  links: PaneLinks,
  link: HoveredLink,
  platform: Platform,
  say: (message: string) => void,
): MenuItem[] {
  const copyFailed = (error: unknown) => say(`Copy failed: ${String(error)}`);
  if (link.kind === "url") {
    return [
      { label: "Open Link", action: () => links.open(link) },
      { label: "Copy Link", action: () => void backend.writeClipboard(link.uri).catch(copyFailed) },
    ];
  }
  const revealFailed = (error: unknown) => say(`Couldn't reveal ${link.abs}: ${String(error)}`);
  return [
    ...(link.revealOnly ? [] : [{ label: "Open", action: () => links.open(link) }]),
    { label: revealLabel(platform), action: () => void backend.revealPath(link.abs).catch(revealFailed) },
    { label: "Copy Path", action: () => void backend.writeClipboard(link.abs).catch(copyFailed) },
  ];
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
 * `links` is the focused pane's links: right-clicking a hovered link puts its items (open, reveal, copy) first.
 * Returns the handler for a pane's `contextmenu` event.
 */
export async function attachClipboardMenus(
  backend: Backend,
  target: () => Terminal | undefined,
  platform: Platform,
  openSettings: () => void,
  elsewhere: (action: ClipboardAction) => boolean = () => false,
  more?: () => Promise<MenuItem[]>,
  links: () => PaneLinks | undefined = () => undefined,
): Promise<(event: MouseEvent) => void> {
  const act = (action: ClipboardAction) => {
    if (elsewhere(action)) return;
    const term = target();
    if (term) runReporting(backend, term, action);
  };

  if (platform === "macos" && backend.nativeMenus) {
    // The Edit menu's find items share the event; the panes carry those out.
    await backend.onAppEvent("clipboard", (payload) => {
      if (!(payload in FIND_MENU_ITEMS)) act(payload as ClipboardAction);
    });
  }

  const items: MenuItem[] = [
    { label: "Copy", action: () => act("copy") },
    { label: "Paste", action: () => act("paste") },
    { separator: true },
    { label: "Settings…", action: () => openSettings() },
  ];
  const say = (message: string) => target()?.write(`\r\n${message}\r\n`);
  const fail = (error: unknown) => say(`Copy or paste failed: ${String(error)}`);
  const showStatic = more ? undefined : await backend.contextMenu(items);
  return (event) => {
    // The link is the one under the pointer as the menu opens, before anything waits.
    const paneLinks = links();
    const link = paneLinks?.hovered();
    if (showStatic && !link) {
      showStatic(event).catch(fail);
      return;
    }
    // Kept from the webview's own menu now: the items are built after a wait.
    event.preventDefault();
    (async () => {
      const first: MenuItem[] = paneLinks && link ? [...linkItems(backend, paneLinks, link, platform, say), { separator: true }] : [];
      const showMenu = await backend.contextMenu([...first, ...items, ...(more ? await more() : [])]);
      await showMenu(event);
    })().catch(fail);
  };
}
