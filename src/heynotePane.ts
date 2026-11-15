import type { Backend } from "./backend";
import type { ClipboardAction, FindAction, Platform } from "./keymap";
import type { TiiliTheme } from "./themes";

/** Where the Heynote app is served from: `public/heynote/`, built by `npm run heynote`. */
export const HEYNOTE_URL = "heynote/index.html";

/**
 * Heynote's editor ground in its light and dark modes, which the frame shows until Heynote has painted; the same
 * colours as the head style scripts/heynote.mjs adds to Heynote's page.
 */
const HEYNOTE_GROUND = { light: "#ffffff", dark: "#252B37" } as const;

/** The Heynote page's own window, with what tiili's bridge (`heynote/bridge.js`) adds to it. */
type HeynoteWindow = Window & { tiiliFlush?: () => void };

/** A Heynote pane's content: the Heynote web app in a frame of its own. */
export interface HeynoteFrame {
  frame: HTMLIFrameElement;
  /** Gives Heynote's editor the keyboard. */
  focus(): void;
  /** Carries out a clipboard action from the native Edit menu or the right-click menu on the editor. */
  clipboard(action: ClipboardAction): Promise<void>;
  /** Opens Heynote's own search, or goes to its next or previous match, for the native Edit menu's find items. */
  find(action: FindAction): void;
  /** Saves every open note now, before the pane closes. */
  flush(): void;
}

/**
 * Opens Heynote in `host`. Its notes live in `backend.notes`, which the page reaches as `tiiliHeynote` on this
 * window. `onKey` sees each key pressed in Heynote first and returns true for the ones tiili keeps (pane,
 * layout and settings shortcuts); those never reach Heynote. `onFocus` runs whenever Heynote gets the keyboard.
 */
export function openHeynote(
  backend: Backend,
  host: HTMLElement,
  platform: Platform,
  onKey: (event: KeyboardEvent) => boolean,
  onFocus: () => void,
): HeynoteFrame {
  (window as Window & { tiiliHeynote?: unknown }).tiiliHeynote = backend.notes;
  const frame = document.createElement("iframe");
  frame.className = "pane-heynote";
  frame.title = "Heynote";
  // The frame opens in the ground of the mode Heynote starts in and stays hidden until Heynote has painted, so the
  // empty frame's white never shows.
  const tiiliTheme = (window as Window & { tiiliTheme?: TiiliTheme }).tiiliTheme;
  const kind = tiiliTheme?.kind() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  frame.style.colorScheme = kind;
  frame.style.background = HEYNOTE_GROUND[kind];
  frame.style.visibility = "hidden";
  frame.src = HEYNOTE_URL;
  const page = () => frame.contentWindow as HeynoteWindow | null;

  frame.addEventListener("load", () => {
    requestAnimationFrame(() => {
      frame.style.visibility = "";
    });
    const win = page();
    if (!win) return;
    win.addEventListener("focus", onFocus);
    win.addEventListener(
      "keydown",
      (event) => {
        if (onKey(event)) {
          // `onKey` cancels the keys it carries out itself. The ones the macOS menus carry out stay uncancelled,
          // since WKWebView hands a key to the menu bar only when the page leaves it; Heynote just never sees them.
          event.stopImmediatePropagation();
          return;
        }
        // The macOS app's Edit menu has no Cut item, so ⌘X would not cut there; elsewhere the page cuts natively.
        if (platform === "macos" && backend.nativeMenus && cutKey(event)) {
          event.preventDefault();
          void cut(backend, win);
        }
      },
      true,
    );
  });
  host.append(frame);

  return {
    frame,
    focus: () => {
      frame.focus();
      const editor = page()?.document.querySelector<HTMLElement>(".cm-content");
      editor?.focus();
    },
    clipboard: async (action) => {
      const win = page();
      if (!win) return;
      if (action === "copy") {
        const text = win.getSelection()?.toString();
        if (text) await backend.writeClipboard(text);
      } else if (action === "paste") {
        const text = await backend.readClipboard();
        if (text) win.document.execCommand("insertText", false, text);
      } else {
        win.document.execCommand("selectAll");
      }
    },
    find: (action) => {
      const win = page();
      const editor = win?.document.querySelector<HTMLElement>(".cm-content");
      if (!win || !editor) return;
      // The keys Heynote's editor already handles: Mod-f opens its search, Mod-g and Shift-Mod-g step through it.
      const mac = platform === "macos";
      const key = action === "find" ? "f" : "g";
      editor.focus();
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          code: `Key${key.toUpperCase()}`,
          metaKey: mac,
          ctrlKey: !mac,
          shiftKey: action === "previous",
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    flush: () => page()?.tiiliFlush?.(),
  };
}

/** ⌘X, the macOS cut key. */
function cutKey(event: KeyboardEvent): boolean {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "x";
}

async function cut(backend: Backend, win: Window): Promise<void> {
  const text = win.getSelection()?.toString();
  if (!text) return;
  await backend.writeClipboard(text);
  win.document.execCommand("delete");
}
