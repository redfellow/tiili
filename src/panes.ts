import type { Backend } from "./backend";
import { attachClipboardMenus, handleClipboardKey } from "./clipboard";
import {
  layoutAction,
  paneAction,
  settingsShortcut,
  zoomAction,
  type LayoutAction,
  type PaneAction,
  type Platform,
  type ZoomAction,
} from "./keymap";
import {
  addPane,
  changedPanes,
  emptyLayout,
  move,
  removePane,
  reset,
  setMode,
  swap,
  type LayoutState,
  type PaneId,
} from "./layout/model";
import { TileView } from "./layout/view";
import { openHeynote, type HeynoteFrame } from "./heynotePane";
import {
  chipLabel,
  createPaneChip,
  folderName,
  PANE_COMMAND_EVENT,
  PANE_CWD_EVENT,
  showPaneChip,
  type PaneCommand,
  type PaneCwd,
} from "./paneChip";
import type { Settings } from "./settings";
import { applyFont, openTerminal, refreshTheme, zoomedSize, type PaneTerminal } from "./terminal";
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
  /** The title chip naming the pane's repository or folder and what runs in it. */
  chip: HTMLElement;
  ready: Promise<PaneTerminal | undefined>;
  terminal?: PaneTerminal;
  /** The id of the shell session now running in the pane. */
  session?: number;
  /** The pane's project tint; `undefined` outside a repository. */
  tint?: number;
  /** Set for a Heynote pane, which holds Heynote instead of a terminal. */
  note?: HeynoteFrame;
  /** Pixels added to the Settings font size by the zoom keys; not saved, so a new pane starts at 0. */
  zoom: number;
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
  /** The latest `pane-command` report per session, kept like `places`. */
  private readonly commands = new Map<number, string>();

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
    this.layout = emptyLayout(settings().tiling.layout);
    this.styleRoot(settings());
  }

  /** Sets the pane-wide looks the stylesheet reads from `root`: hover highlight and inactive panes. */
  private styleRoot(settings: Settings): void {
    this.root.toggleAttribute("data-hover-highlight", settings.behaviour.hoverHighlight);
    this.root.toggleAttribute("data-desaturate", settings.inactive.desaturate);
    this.root.style.setProperty("--inactive-opacity", String(settings.inactive.opacity));
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
    await backend.onAppEvent(PANE_COMMAND_EVENT, (command) => panes.onCommand(command));
    panes.contextMenu = await attachClipboardMenus(
      backend,
      () => panes.current()?.terminal?.term,
      platform,
      openSettings,
      (action) => {
        const note = panes.current()?.note;
        note?.clipboard(action).catch((error: unknown) => console.error(error));
        return note !== undefined;
      },
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
      if (hadKeyboard) this.give(focused);
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
    else if (action.type === "heynote") this.openHeynote();
    else if (action.type === "close") this.close(this.focused).catch(report);
    else this.focus(action.index);
  }

  /**
   * Opens the Heynote pane after the others and focuses it. There is one at most, since every Heynote page keeps
   * its own copy of the notes: when it is already open, it only takes the focus.
   */
  openHeynote(): void {
    const open = this.panes.findIndex((pane) => pane.note !== undefined);
    if (open >= 0) {
      this.focus(open);
      return;
    }
    const { element, chip, host } = this.paneElement();
    const pane: Pane = { id: this.nextId++, element, chip, zoom: 0, ready: Promise.resolve(undefined) };
    element.addEventListener("focusin", () => this.markFocused(this.panes.indexOf(pane)));
    element.addEventListener("mousedown", () => this.focus(this.panes.indexOf(pane)));
    showPaneChip(element, chip, "Heynote");
    pane.note = openHeynote(
      this.backend,
      host,
      this.platform,
      (event) => this.shortcut(event),
      () => this.markFocused(this.panes.indexOf(pane)),
    );
    pane.note.frame.addEventListener("load", () => {
      if (this.current() === pane) pane.note?.focus();
    });
    this.panes.push(pane);
    this.layout = addPane(this.layout, pane.id);
    this.render();
    this.markFocused(this.panes.length - 1);
  }

  /** A pane's element: its title row with the chip, the host its content goes in and the grab strip. */
  private paneElement(): { element: HTMLElement; chip: HTMLElement; host: HTMLElement } {
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
    return { element, chip, host };
  }

  /** Gives pane `pane`'s terminal or Heynote the keyboard. */
  private give(pane: Pane): void {
    if (pane.note) pane.note.focus();
    else pane.terminal?.term.focus();
  }

  /** Opens a pane after the others, in the focused pane's working directory, and focuses it. */
  async open(): Promise<void> {
    const from = this.current();
    const cwd = await from?.ready.then((t) => t?.cwd()).catch(() => undefined);

    const { element, chip, host } = this.paneElement();
    element.addEventListener("focusin", () => this.markFocused(this.panes.indexOf(pane)));
    element.addEventListener("mousedown", () => this.focus(this.panes.indexOf(pane)));
    element.addEventListener("contextmenu", (event) => this.contextMenu(event));

    let resolve: (terminal: PaneTerminal | undefined) => void = () => {};
    const pane: Pane = { id: this.nextId++, element, chip, zoom: 0, ready: new Promise((r) => (resolve = r)) };
    this.panes.push(pane);
    this.layout = addPane(this.layout, pane.id);
    // Laid out first, so the terminal opens at its pane's size.
    this.render();
    this.markFocused(this.panes.length - 1);

    try {
      const opened = await openTerminal(
        this.backend,
        host,
        this.settings,
        cwd,
        (session) => this.onSession(pane, session),
        () => pane.zoom,
      );
      opened.term.attachCustomKeyEventHandler((event) => this.onKey(opened, event));
      pane.terminal = opened;
      resolve(opened);
    } catch (error) {
      resolve(undefined);
      this.remove(pane);
      throw error;
    }
    if (this.current() === pane) this.give(pane);
  }

  /** Closes pane `index` without asking. Focus moves to the pane that takes its place, else the one before. */
  async close(index: number): Promise<void> {
    const pane = this.panes[index];
    if (!pane) return;
    pane.note?.flush();
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
    this.give(pane);
  }

  /** Gives the focused pane's terminal the keyboard again, e.g. after the settings dialogue closes. */
  focusCurrent(): void {
    const pane = this.current();
    if (pane) this.give(pane);
  }

  /** Restyles every open pane after the settings changed; `themeChanged` re-reads the theme colours too. */
  async applySettings(settings: Settings, themeChanged: boolean): Promise<void> {
    this.styleRoot(settings);
    if ((this.layout.mode ?? "grid") !== settings.tiling.layout) {
      this.relayout(setMode(this.layout, settings.tiling.layout));
    }
    // Each pane keeps its zoom offset on top of the new font size.
    await Promise.all(
      this.panes.map(async (pane) => {
        const terminal = await pane.ready;
        if (!terminal) return;
        if (themeChanged) refreshTheme(terminal.term);
        await applyFont(terminal.term, settings, pane.zoom);
      }),
    );
  }

  /** A `pane-cwd` report: updates the pane running that session, or keeps it until the pane hears its id. */
  private onCwd(place: PaneCwd): void {
    this.places.set(place.paneId, place);
    const pane = this.panes.find((p) => p.session === place.paneId);
    if (pane) this.showPlace(pane, place);
  }

  /** A `pane-command` report: relabels the pane running that session once its place is known. */
  private onCommand(report: PaneCommand): void {
    this.commands.set(report.paneId, report.command);
    const pane = this.panes.find((p) => p.session === report.paneId);
    const place = this.places.get(report.paneId);
    if (pane && place) this.showPlace(pane, place);
  }

  /** Pane `pane` now runs shell session `session`. */
  private onSession(pane: Pane, session: number): void {
    if (pane.session !== undefined) this.forget(pane.session);
    pane.session = session;
    const place = this.places.get(session);
    if (place) this.showPlace(pane, place);
  }

  /** Drops what was heard about session `session`. */
  private forget(session: number): void {
    this.places.delete(session);
    this.commands.delete(session);
  }

  /**
   * Shows the pane's repository in its tint, or its folder in the neutral chip outside a repository, followed by
   * what runs in the pane.
   */
  private showPlace(pane: Pane, place: PaneCwd): void {
    const command = pane.session === undefined ? undefined : this.commands.get(pane.session);
    if (place.repo) {
      const others = tintCounts(this.panes.filter((p) => p !== pane).map((p) => p.tint));
      pane.tint = this.tints.assign(place.repo.root, others);
      showPaneChip(pane.element, pane.chip, chipLabel(place.repo.name, command), pane.tint);
    } else {
      pane.tint = undefined;
      showPaneChip(pane.element, pane.chip, chipLabel(folderName(place.cwd), command));
    }
  }

  private remove(pane: Pane): void {
    const index = this.panes.indexOf(pane);
    if (index < 0) return;
    if (pane.session !== undefined) this.forget(pane.session);
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
    if (this.shortcut(event)) return false;
    return !handleClipboardKey(this.backend, terminal.term, event, this.platform);
  }

  /**
   * Steps the focused terminal pane's zoom offset one pixel in or out, or back to 0, keeping its size within the
   * zoom range, then refits it so its shell gets the new size.
   */
  private zoom(pane: Pane, action: ZoomAction): void {
    const terminal = pane.terminal;
    if (!terminal) return;
    const settings = this.settings();
    const base = settings.font.size;
    const current = zoomedSize(base, pane.zoom);
    const next = action === "reset" ? base : zoomedSize(current, action === "in" ? 1 : -1);
    if (action !== "reset" && next === current) return;
    pane.zoom = next - base;
    applyFont(terminal.term, settings, pane.zoom).catch((error: unknown) => this.report(error));
  }

  /**
   * Carries out a layout, pane, settings or zoom shortcut on keydown. Returns true when `event` is one of those
   * keys, which then must not reach the pane's shell or Heynote. Zoom keys act only in terminal panes; in a
   * Heynote pane they reach Heynote.
   */
  private shortcut(event: KeyboardEvent): boolean {
    const layout = layoutAction(event, this.platform);
    if (layout) {
      if (event.type === "keydown") {
        event.preventDefault();
        this.actLayout(layout);
      }
      return true;
    }
    if (settingsShortcut(event, this.platform)) {
      // In the macOS app the app menu's ⌘, opens the settings; here the key is only kept from the shell.
      if (!this.viaMenu() && event.type === "keydown") {
        event.preventDefault();
        this.openSettings();
      }
      return true;
    }
    const action = paneAction(event, this.platform);
    if (action) {
      // In the macOS app ⌘T and ⌘W come from the Shell menu; here those keys are only kept from the shell.
      // Cancelling them would stop the menu: WKWebView hands a key to the menu bar only when the page leaves it.
      const viaMenu = this.viaMenu() && action.type !== "focus";
      if (!viaMenu && event.type === "keydown") {
        event.preventDefault();
        this.act(action);
      }
      return true;
    }
    const zoom = zoomAction(event, this.platform);
    const pane = this.current();
    if (zoom && pane && !pane.note) {
      if (event.type === "keydown") {
        event.preventDefault();
        this.zoom(pane, zoom);
      }
      return true;
    }
    return false;
  }

  private report(error: unknown): void {
    const term = this.current()?.terminal?.term;
    if (term) term.write(`\r\n${String(error)}\r\n`);
    else this.root.textContent = `tiili could not start the terminal: ${String(error)}`;
  }
}
