import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { attachClipboardMenus, handleClipboardKey } from "./clipboard";
import { paneAction, settingsShortcut, type PaneAction, type Platform } from "./keymap";
import { rowsOf } from "./layout";
import type { Settings } from "./settings";
import { applyFont, openTerminal, refreshTheme, type PaneTerminal } from "./terminal";

/** One pane: its element in the grid and, once its shell has started, its terminal. */
interface Pane {
  element: HTMLElement;
  ready: Promise<PaneTerminal | undefined>;
  terminal?: PaneTerminal;
}

/**
 * The window's panes in the order they were opened, tiled into the grid from `gridFor`: one flex
 * row per grid row, so the panes of a short last row share its full width.
 */
export class Panes {
  private panes: Pane[] = [];
  private focused = -1;
  private contextMenu: (event: MouseEvent) => void = () => {};

  private constructor(
    private readonly root: HTMLElement,
    private readonly platform: Platform,
    private readonly settings: () => Settings,
    private readonly openSettings: () => void,
  ) {}

  /**
   * Sets up the panes in `root`, with the menus and shortcuts that act on them. Every pane is styled by
   * `settings()`; the settings shortcut and the right-click menu's Settings… item call `openSettings`.
   */
  static async create(
    root: HTMLElement,
    platform: Platform,
    settings: () => Settings,
    openSettings: () => void,
  ): Promise<Panes> {
    const panes = new Panes(root, platform, settings, openSettings);
    panes.contextMenu = await attachClipboardMenus(() => panes.current()?.terminal?.term, platform, openSettings);
    if (platform === "macos") {
      // ⌘T and ⌘W are Shell menu items on macOS, so the webview may never see those keys.
      await listen<"new" | "close">("pane", (event) => {
        panes.act(event.payload === "new" ? { type: "new" } : { type: "close" });
      });
    }
    return panes;
  }

  private current(): Pane | undefined {
    return this.panes[this.focused];
  }

  /** Carries out a pane shortcut. Focusing a pane number that is not open does nothing. */
  act(action: PaneAction): void {
    const report = (error: unknown) => this.report(error);
    if (action.type === "new") this.open().catch(report);
    else if (action.type === "close") this.close(this.focused).catch(report);
    else this.focus(action.index);
  }

  /** Opens a pane after the others, in the focused pane's working directory, and focuses it. */
  async open(): Promise<void> {
    const from = this.current();
    const cwd = await from?.ready.then((t) => t?.cwd()).catch(() => undefined);

    const element = document.createElement("div");
    element.className = "pane";
    const host = document.createElement("div");
    host.className = "pane-terminal";
    element.append(host);
    element.addEventListener("focusin", () => this.markFocused(this.panes.indexOf(pane)));
    element.addEventListener("mousedown", () => this.focus(this.panes.indexOf(pane)));
    element.addEventListener("contextmenu", (event) => this.contextMenu(event));

    let resolve: (terminal: PaneTerminal | undefined) => void = () => {};
    const pane: Pane = { element, ready: new Promise((r) => (resolve = r)) };
    this.panes.push(pane);
    // Laid out first, so the terminal opens at its pane's size.
    this.render();
    this.markFocused(this.panes.length - 1);

    try {
      const opened = await openTerminal(host, this.settings, cwd);
      opened.term.attachCustomKeyEventHandler((event) => this.onKey(opened, event));
      pane.terminal = opened;
      resolve(opened);
    } catch (error) {
      resolve(undefined);
      this.remove(pane);
      throw error;
    }
    if (this.current() === pane) pane.terminal?.term.focus();
  }

  /** Closes pane `index` without asking. Focus moves to the pane that takes its place, else the one before. */
  async close(index: number): Promise<void> {
    const pane = this.panes[index];
    if (!pane) return;
    this.remove(pane);
    if (this.panes.length === 0) {
      await getCurrentWindow().close();
    }
    const terminal = await pane.ready;
    await terminal?.dispose();
  }

  /** Focuses pane `index` (0-based, in opening order); does nothing when there is no such pane. */
  focus(index: number): void {
    const pane = this.panes[index];
    if (!pane) return;
    this.markFocused(index);
    pane.terminal?.term.focus();
  }

  /** Gives the focused pane's terminal the keyboard again, e.g. after the settings dialogue closes. */
  focusCurrent(): void {
    this.current()?.terminal?.term.focus();
  }

  /** Restyles every open pane after the settings changed; `themeChanged` re-reads the theme colours too. */
  async applySettings(settings: Settings, themeChanged: boolean): Promise<void> {
    const terminals = await Promise.all(this.panes.map((pane) => pane.ready));
    await Promise.all(
      terminals.map(async (terminal) => {
        if (!terminal) return;
        if (themeChanged) refreshTheme(terminal.term);
        await applyFont(terminal.term, settings);
      }),
    );
  }

  private remove(pane: Pane): void {
    const index = this.panes.indexOf(pane);
    if (index < 0) return;
    const wasFocused = index === this.focused;
    this.panes.splice(index, 1);
    pane.element.remove();
    this.render();
    if (this.panes.length === 0) {
      this.focused = -1;
    } else if (wasFocused) {
      this.focus(Math.min(index, this.panes.length - 1));
    } else if (index < this.focused) {
      this.markFocused(this.focused - 1);
    }
  }

  private markFocused(index: number): void {
    if (index < 0) return;
    this.focused = index;
    this.panes.forEach((pane, i) => {
      pane.element.toggleAttribute("data-focused", i === index);
    });
  }

  /** Lays the panes out again: one row element per grid row, panes in order. */
  private render(): void {
    const rows = rowsOf(this.panes).map((panes) => {
      const row = document.createElement("div");
      row.className = "pane-row";
      row.append(...panes.map((pane) => pane.element));
      return row;
    });
    this.root.replaceChildren(...rows);
  }

  /** xterm's key hook: pane, settings and clipboard shortcuts are kept from the shell. */
  private onKey(terminal: PaneTerminal, event: KeyboardEvent): boolean {
    if (settingsShortcut(event, this.platform)) {
      // On macOS the app menu's ⌘, opens the settings; here the key is only kept from the shell.
      if (this.platform !== "macos" && event.type === "keydown") {
        event.preventDefault();
        this.openSettings();
      }
      return false;
    }
    const action = paneAction(event, this.platform);
    if (action) {
      // On macOS ⌘T and ⌘W come from the Shell menu; here those keys are only kept from the shell.
      const viaMenu = this.platform === "macos" && action.type !== "focus";
      if (event.type === "keydown") {
        event.preventDefault();
        if (!viaMenu) this.act(action);
      }
      return false;
    }
    return !handleClipboardKey(terminal.term, event, this.platform);
  }

  private report(error: unknown): void {
    const term = this.current()?.terminal?.term;
    if (term) term.write(`\r\n${String(error)}\r\n`);
    else this.root.textContent = `tiili could not start the terminal: ${String(error)}`;
  }
}
