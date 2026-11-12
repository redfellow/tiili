import type { Backend } from "./backend";
import { attachClipboardMenus, handleClipboardKey } from "./clipboard";
import { layoutAction, paneAction, settingsShortcut, type LayoutAction, type PaneAction, type Platform } from "./keymap";
import {
  addPane,
  changedPanes,
  emptyLayout,
  move,
  removePane,
  reset,
  swap,
  type LayoutState,
  type PaneId,
} from "./layout/model";
import { TileView } from "./layout/view";
import { createPaneChip, folderName, PANE_CWD_EVENT, showPaneChip, type PaneCwd } from "./paneChip";
import type { Settings } from "./settings";
import { applyFont, openTerminal, refreshTheme, type PaneTerminal } from "./terminal";
import { TintAssigner, tintCounts } from "./tints";

/** A pane can't be resized below this many columns and rows of its terminal. */
const MIN_COLS = 20;
const MIN_ROWS = 4;
/** Cell size used for the minimum before any terminal has been laid out. */
const FALLBACK_CELL = { width: 8, height: 17 };

/** One pane: its element in the grid and, once its shell has started, its terminal. */
interface Pane {
  id: PaneId;
  element: HTMLElement;
  /** The title chip naming the pane's repository or folder. */
  chip: HTMLElement;
  ready: Promise<PaneTerminal | undefined>;
  terminal?: PaneTerminal;
  /** The id of the shell session now running in the pane. */
  session?: number;
  /** The pane's project tint; `undefined` outside a repository. */
  tint?: number;
}

/**
 * The window's panes in grid order, tiled into the grid from `gridFor`: one flex row per grid row, so the
 * panes of a short last row share its full width. Rows and columns can be resized and panes swapped.
 */
export class Panes {
  /** Always in the order of `layout.order`. */
  private panes: Pane[] = [];
  private layout: LayoutState = emptyLayout();
  private nextId = 1;
  private focused = -1;
  private contextMenu: (event: MouseEvent) => void = () => {};
  private readonly view: TileView;
  private readonly tints = new TintAssigner();
  /** The latest `pane-cwd` report per session; a report can arrive before its pane knows its session id. */
  private readonly places = new Map<number, PaneCwd>();

  private constructor(
    private readonly backend: Backend,
    private readonly root: HTMLElement,
    private readonly platform: Platform,
    private readonly settings: () => Settings,
    private readonly openSettings: () => void,
  ) {
    this.view = new TileView(root, {
      element: (id) => this.byId(id)?.element ?? document.createElement("div"),
      minSize: () => this.minSize(),
      resizeStart: () => this.panes.forEach((pane) => pane.terminal?.holdSize()),
      resizeEnd: (before, after) => {
        this.layout = after;
        const changed = new Set(changedPanes(before, after));
        this.panes.forEach((pane) => pane.terminal?.releaseSize(changed.has(pane.id)));
      },
      swap: (from, to) => this.relayout(swap(this.layout, from, to)),
    });
  }

  /**
   * Sets up the panes in `root`, with the menus and shortcuts that act on them. Every pane is styled by
   * `settings()`; the settings shortcut and the right-click menu's Settings… item call `openSettings`. Shells,
   * clipboard, menus and the window come from `backend`.
   */
  static async create(
    backend: Backend,
    root: HTMLElement,
    platform: Platform,
    settings: () => Settings,
    openSettings: () => void,
  ): Promise<Panes> {
    const panes = new Panes(backend, root, platform, settings, openSettings);
    await backend.onAppEvent(PANE_CWD_EVENT, (place) => panes.onCwd(place));
    panes.contextMenu = await attachClipboardMenus(
      backend,
      () => panes.current()?.terminal?.term,
      platform,
      openSettings,
    );
    if (panes.viaMenu()) {
      // ⌘T and ⌘W are Shell menu items on macOS, so the webview may never see those keys.
      await backend.onAppEvent("pane", (payload) => {
        panes.act(payload === "new" ? { type: "new" } : { type: "close" });
      });
    }
    return panes;
  }

  /** True when the native macOS menus carry out the ⌘ shortcuts, so the page only keeps them from the shell. */
  private viaMenu(): boolean {
    return this.platform === "macos" && this.backend.nativeMenus;
  }

  private current(): Pane | undefined {
    return this.panes[this.focused];
  }

  private byId(id: PaneId): Pane | undefined {
    return this.panes.find((pane) => pane.id === id);
  }

  /** Moves the focused pane or resets the grid to even sizes. */
  actLayout(action: LayoutAction): void {
    const pane = this.current();
    if (!pane) return;
    this.relayout(action === "reset" ? reset(this.layout) : move(this.layout, pane.id, action.move));
  }

  /** Takes `layout` on, keeping focus on the pane that had it. */
  private relayout(layout: LayoutState): void {
    const focused = this.current();
    const hadKeyboard = focused !== undefined && focused.element.contains(document.activeElement);
    this.layout = layout;
    this.panes = layout.order.map((id) => this.byId(id)).filter((pane): pane is Pane => pane !== undefined);
    this.render();
    if (focused) {
      this.markFocused(this.panes.indexOf(focused));
      // Moving the pane's element in the DOM takes the keyboard from its terminal.
      if (hadKeyboard) focused.terminal?.term.focus();
    }
  }

  /** The smallest pane size: MIN_COLS × MIN_ROWS cells of the terminal font, plus the pane's padding. */
  private minSize(): { width: number; height: number } {
    const pane = this.current() ?? this.panes[0];
    const cell = pane?.terminal?.cellSize() ?? FALLBACK_CELL;
    const style = pane ? getComputedStyle(pane.element) : undefined;
    const pad = (a: string | undefined, b: string | undefined) => (parseFloat(a ?? "") || 0) + (parseFloat(b ?? "") || 0);
    return {
      width: MIN_COLS * cell.width + pad(style?.paddingLeft, style?.paddingRight),
      height: MIN_ROWS * cell.height + pad(style?.paddingTop, style?.paddingBottom),
    };
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
    const title = document.createElement("div");
    title.className = "pane-title";
    const chip = createPaneChip();
    title.append(chip);
    // Dragging the top edge onto another pane swaps the two; dragging inside the terminal still selects.
    const grab = document.createElement("div");
    grab.className = "pane-grab";
    const host = document.createElement("div");
    host.className = "pane-terminal";
    element.append(title, host, grab);
    element.addEventListener("focusin", () => this.markFocused(this.panes.indexOf(pane)));
    element.addEventListener("mousedown", () => this.focus(this.panes.indexOf(pane)));
    element.addEventListener("contextmenu", (event) => this.contextMenu(event));

    let resolve: (terminal: PaneTerminal | undefined) => void = () => {};
    const pane: Pane = { id: this.nextId++, element, chip, ready: new Promise((r) => (resolve = r)) };
    this.panes.push(pane);
    this.layout = addPane(this.layout, pane.id);
    // Laid out first, so the terminal opens at its pane's size.
    this.render();
    this.markFocused(this.panes.length - 1);

    try {
      const opened = await openTerminal(this.backend, host, this.settings, cwd, (session) =>
        this.onSession(pane, session),
      );
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
      await this.backend.closeWindow();
    }
    const terminal = await pane.ready;
    await terminal?.dispose();
  }

  /** Focuses pane `index` (0-based, in grid order: left to right, top to bottom); does nothing when there is no such pane. */
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

  /** A `pane-cwd` report: updates the pane running that session, or keeps it until the pane hears its id. */
  private onCwd(place: PaneCwd): void {
    this.places.set(place.paneId, place);
    const pane = this.panes.find((p) => p.session === place.paneId);
    if (pane) this.showPlace(pane, place);
  }

  /** Pane `pane` now runs shell session `session`. */
  private onSession(pane: Pane, session: number): void {
    if (pane.session !== undefined) this.places.delete(pane.session);
    pane.session = session;
    const place = this.places.get(session);
    if (place) this.showPlace(pane, place);
  }

  /** Shows the pane's repository in its tint, or its folder in the neutral chip outside a repository. */
  private showPlace(pane: Pane, place: PaneCwd): void {
    if (place.repo) {
      const others = tintCounts(this.panes.filter((p) => p !== pane).map((p) => p.tint));
      pane.tint = this.tints.assign(place.repo.root, others);
      showPaneChip(pane.element, pane.chip, place.repo.name, pane.tint);
    } else {
      pane.tint = undefined;
      showPaneChip(pane.element, pane.chip, folderName(place.cwd));
    }
  }

  private remove(pane: Pane): void {
    const index = this.panes.indexOf(pane);
    if (index < 0) return;
    if (pane.session !== undefined) this.places.delete(pane.session);
    const wasFocused = index === this.focused;
    this.panes.splice(index, 1);
    this.layout = removePane(this.layout, pane.id);
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

  /** Lays the panes out again: one row element per grid row, panes in order, with the dividers. */
  private render(): void {
    this.view.render(this.layout);
  }

  /** xterm's key hook: layout, pane, settings and clipboard shortcuts are kept from the shell. */
  private onKey(terminal: PaneTerminal, event: KeyboardEvent): boolean {
    const layout = layoutAction(event, this.platform);
    if (layout) {
      if (event.type === "keydown") {
        event.preventDefault();
        this.actLayout(layout);
      }
      return false;
    }
    if (settingsShortcut(event, this.platform)) {
      // In the macOS app the app menu's ⌘, opens the settings; here the key is only kept from the shell.
      if (!this.viaMenu() && event.type === "keydown") {
        event.preventDefault();
        this.openSettings();
      }
      return false;
    }
    const action = paneAction(event, this.platform);
    if (action) {
      // In the macOS app ⌘T and ⌘W come from the Shell menu; here those keys are only kept from the shell.
      const viaMenu = this.viaMenu() && action.type !== "focus";
      if (event.type === "keydown") {
        event.preventDefault();
        if (!viaMenu) this.act(action);
      }
      return false;
    }
    return !handleClipboardKey(this.backend, terminal.term, event, this.platform);
  }

  private report(error: unknown): void {
    const term = this.current()?.terminal?.term;
    if (term) term.write(`\r\n${String(error)}\r\n`);
    else this.root.textContent = `tiili could not start the terminal: ${String(error)}`;
  }
}
