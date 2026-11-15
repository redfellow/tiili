import { AttentionGate, type AttentionMark, type AttentionSignal } from "./attention";
import type { Backend, MenuItem, MovePayload, PaneLaunch, PaneOpenRequest, SessionId } from "./backend";
import { attachClipboardMenus, handleClipboardKey } from "./clipboard";
import {
  attentionShortcut,
  FIND_MENU_ITEMS,
  findAction,
  layoutAction,
  paneAction,
  settingsShortcut,
  zenAction,
  zoomAction,
  type FindAction,
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
import { EXIT_HOLD_MS, prefersReducedMotion } from "./layout/motion";
import { TileView } from "./layout/view";
import { zenColumns, zenWidthPx } from "./layout/zen";
import { openHeynote, type HeynoteFrame } from "./heynotePane";
import {
  chipLabel,
  createPaneChip,
  PANE_COMMAND_EVENT,
  PANE_CWD_EVENT,
  placeLabel,
  showPaneAttention,
  showPaneChip,
  type PaneCommand,
  type PaneCwd,
} from "./paneChip";
import { restorePlan, snapshotWindow, type PaneRestore, type PaneSnapshot, type Restored } from "./session";
import type { Settings } from "./settings";
import { zoomedSize } from "./responsive";
import { applyFont, openTerminal, refreshTheme, type AdoptedSession, type PaneTerminal } from "./terminal";
import { paneTint } from "./tints";
import { menuEntries } from "./windowMenu";
import { windowTitle } from "./windowTitle";

/** A pane can't be resized below this many columns and rows of its terminal. */
const MIN_COLS = 20;
const MIN_ROWS = 4;
/** Cell size used for the minimum before any terminal has been laid out. */
const FALLBACK_CELL = { width: 8, height: 17 };
/** Changes settle this long before the window tells the app its state for the next launch. */
const SAVE_SETTLE_MS = 500;
/** The width xterm keeps beside the text for its scrollbar, which the Zen width adds to its columns. */
const SCROLLBAR_WIDTH = 8;

/** The Zen icon on a pane's title row: a pane between two side brackets. */
const ZEN_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="6" height="10" ' +
  'rx="0.5"/><path d="M2.5 5v6M13.5 5v6"/></svg>';

/** One pane: its element in the grid and, once its shell has started, its terminal. */
interface Pane {
  id: PaneId;
  element: HTMLElement;
  /** The title chip naming the pane's repository or folder and what runs in it. */
  chip: HTMLElement;
  /** The Zen icon at the right end of the title row. */
  zenButton: HTMLElement;
  ready: Promise<PaneTerminal | undefined>;
  terminal?: PaneTerminal;
  /** The id of the shell session now running in the pane. */
  session?: number;
  /** The pane's project tint; `undefined` outside a repository. */
  tint?: number;
  /** Set for a Heynote pane, which holds Heynote instead of a terminal. */
  note?: HeynoteFrame;
  /** Pixels added to the Settings font size by the zoom keys; a new pane starts at 0, a reopened one at its saved zoom. */
  zoom: number;
  /** Merges and rate-limits the bells and notifications of a terminal pane's shell. */
  gate?: AttentionGate;
  /** The name `tiili open --title` gave the pane, which its chip shows instead of its place. */
  title?: string;
}

/** A pane `tiili open` asked for: the program it runs and the title its chip shows. */
interface Requested extends PaneLaunch {
  title?: string;
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
  /** The latest `pane-cwd` report per session; a report can arrive before its pane knows its session id. */
  private readonly places = new Map<number, PaneCwd>();
  /** The latest `pane-command` report per session, kept like `places`. */
  private readonly commands = new Map<number, string>();
  /** The window name last told to the app, so an unchanged one is not sent again. */
  private reportedName = "";
  /** The window title last set, so an unchanged one is not set again. */
  private shownTitle = "tiili >_";
  /** The session order last reported to the app, for `tiili list`. */
  private reportedOrder = "";
  /** Every marked session app-wide, so a pane that arrives from another window shows its mark. */
  private marks = new Map<number, AttentionMark>();
  /** The pending state report for the next launch, once changes settle. */
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** The state reports in flight, one after another so an older one never lands after a newer one. */
  private saving: Promise<void> = Promise.resolve();
  /** The pane Zen mode shows alone in this window, or undefined while the grid shows. */
  private zen: PaneId | undefined;

  private constructor(
    private readonly backend: Backend,
    private readonly root: HTMLElement,
    private readonly platform: Platform,
    private readonly settings: () => Settings,
    private readonly openSettings: () => void,
    private readonly saveSettings: (next: Settings) => Promise<void>,
  ) {
    this.view = new TileView(root, {
      element: (id) => this.byId(id)?.element ?? document.createElement("div"),
      minSize: () => this.minSize(),
      resizeStart: () => this.panes.forEach((pane) => pane.terminal?.holdSize()),
      resizeEnd: (before, after) => {
        this.layout = after;
        const changed = new Set(changedPanes(before, after));
        this.panes.forEach((pane) => pane.terminal?.releaseSize(changed.has(pane.id)));
        this.scheduleSave();
      },
      // Panes stay in their places while one is shown alone.
      swap: (from, to) => {
        if (this.zen === undefined) this.relayout(swap(this.layout, from, to));
      },
      // Terminals scale with their moving panes and refit once they are in place, so each shell sees one size change.
      // Panes hidden by Zen keep holding their size until Zen ends.
      motionStart: () => this.shown().forEach((pane) => pane.terminal?.holdSize()),
      // Terminals take their final font and grid up front, so the glide scales the text gradually instead of
      // snapping it to a new size at the end.
      motionPlay: () =>
        new Map(this.shown().flatMap((pane) => (pane.terminal ? [[pane.id, pane.terminal.refitNow()] as const] : []))),
      motionEnd: () => this.shown().forEach((pane) => pane.terminal?.releaseSize(true)),
      zenWidth: (area) => {
        const { cell, chrome } = this.zenMetrics();
        return zenWidthPx(this.settings().zen.width, cell, area, chrome);
      },
      zenClamp: (width, area) => {
        const { cell, chrome } = this.zenMetrics();
        return zenWidthPx(zenColumns(width, cell, chrome), cell, area, chrome);
      },
      zenResizeStart: () => this.zenPane()?.terminal?.holdSize(),
      zenResizeEnd: (width) => {
        this.zenPane()?.terminal?.releaseSize(true);
        this.saveZenWidth(width).catch((error: unknown) => this.report(error));
      },
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
   * `settings()`; the settings shortcut and the right-click menu's Settings… item call `openSettings`, and a Zen
   * edge drag saves the new Zen width through `saveSettings`. Shells, clipboard, menus and the window come from
   * `backend`.
   */
  static async create(
    backend: Backend,
    root: HTMLElement,
    platform: Platform,
    settings: () => Settings,
    openSettings: () => void,
    saveSettings: (next: Settings) => Promise<void>,
  ): Promise<Panes> {
    const panes = new Panes(backend, root, platform, settings, openSettings, saveSettings);
    await backend.onAppEvent(PANE_CWD_EVENT, (place) => panes.onCwd(place));
    await backend.onAppEvent(PANE_COMMAND_EVENT, (command) => panes.onCommand(command));
    if (backend.attention) {
      await backend.onAppEvent("attention-changed", ({ marks }) => panes.showMarks(marks));
      await backend.onAppEvent("attention-focus", (session) => panes.focusSession(session));
      // Coming back to the window is looking at its focused pane.
      window.addEventListener("focus", () => panes.clearCurrent());
      panes.showMarks(await backend.attention.list().catch(() => []));
    }
    panes.contextMenu = await attachClipboardMenus(
      backend,
      () => panes.current()?.terminal?.term,
      platform,
      openSettings,
      (action) => {
        // While the find bar's field has the keyboard, the Edit menu's Copy, Paste and Select All act on it.
        const find = panes.current()?.terminal?.find;
        if (find?.hasFocus()) {
          find
            .clipboard(action, () => backend.readClipboard(), (text) => backend.writeClipboard(text))
            .catch((error: unknown) => console.error(error));
          return true;
        }
        const note = panes.current()?.note;
        note?.clipboard(action).catch((error: unknown) => console.error(error));
        return note !== undefined;
      },
      backend.moves ? () => panes.moveItems() : undefined,
      () => panes.current()?.terminal?.links,
    );
    if (backend.moves) {
      const report = (error: unknown) => panes.report(error);
      // The Shell menu's Move to Window ▸ choice, sent to the focused window with the target's label.
      await backend.onAppEvent("move-to-window", (label) => panes.movePane(label).catch(report));
      // A pane another window sent to this one, already open.
      await backend.onAppEvent("pane-arrive", ({ token }) => panes.arrive(token).catch(report));
    }
    if (backend.paneControl) {
      const control = backend.paneControl;
      await backend.onAppEvent("pane-open-request", (request) => {
        panes
          .openRequested(request)
          .then(
            (pane) => control.done(request.requestId, { pane }),
            (error: unknown) => control.done(request.requestId, { error: String(error) }),
          )
          .catch((error: unknown) => console.error(error));
      });
    }
    if (backend.session) {
      // The app is ending or this last window is closing: the latest state and scrollback are saved first.
      await backend.onAppEvent("session-flush", () => {
        panes.flush().catch((error: unknown) => console.error(error));
      });
    }
    if (panes.viaMenu()) {
      // ⌘T, ⌘W, ⌃⌘N and ⇧⌘↩ are Shell menu items on macOS, so the webview may never see those keys.
      await backend.onAppEvent("pane", (payload) => {
        if (payload === "zen") panes.toggleZen();
        else panes.act({ type: payload });
      });
      // The Shell menu's New Window (⌘N), sent to the focused window only.
      await backend.onAppEvent("new-window", () => panes.act({ type: "newWindow" }));
      // The Edit menu's Find… (⌘F), Find Next (⌘G) and Find Previous (⇧⌘G).
      await backend.onAppEvent("clipboard", (payload) => {
        const action = FIND_MENU_ITEMS[payload];
        if (action) panes.find(action);
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

  /** Moves the focused pane or resets the grid to even sizes; in Zen the grid shows again first. */
  actLayout(action: LayoutAction): void {
    const pane = this.current();
    if (!pane) return;
    this.setZen(undefined);
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
    else if (action.type === "heynote") this.openHeynote().catch(report);
    else if (action.type === "close") this.close(this.focused).catch(report);
    else if (action.type === "newWindow") this.newWindow().catch(report);
    else if (action.type === "moveToNewWindow") this.movePane(undefined).catch(report);
    else this.focus(action.index);
  }

  /**
   * Carries out a find action in the focused pane: a terminal pane opens its find bar or steps through its matches,
   * a Heynote pane opens Heynote's own search or steps through it.
   */
  find(action: FindAction): void {
    const pane = this.current();
    if (pane?.note) {
      pane.note.find(action);
      return;
    }
    const bar = pane?.terminal?.find;
    if (!bar) return;
    if (action === "find") bar.open();
    else bar.step(action);
  }

  /** The folder of the focused pane's shell, where a new pane or window starts; undefined when it can't be read. */
  private async currentCwd(): Promise<string | undefined> {
    return this.current()
      ?.ready.then((t) => t?.cwd())
      .catch(() => undefined);
  }

  /** Opens a new tiili window, cascaded from this one, whose pane starts in the focused pane's folder. */
  async newWindow(): Promise<void> {
    await this.backend.newWindow(await this.currentCwd());
  }

  /** The right-click menu's move items: Move to New Window, and Move to Window ▸ when other windows are open. */
  private async moveItems(): Promise<MenuItem[]> {
    const moves = this.backend.moves;
    if (!moves) return [];
    const windows = await moves.list().catch(() => []);
    const items: MenuItem[] = [
      { separator: true },
      { label: "Move to New Window", action: () => this.act({ type: "moveToNewWindow" }) },
    ];
    if (windows.length > 0) {
      items.push({
        label: "Move to Window",
        items: menuEntries(windows).map(({ label, text }) => ({
          label: text,
          action: () => this.movePane(label).catch((error: unknown) => this.report(error)),
        })),
      });
    }
    return items;
  }

  /**
   * Moves the focused pane to window `target`, or to a new window when absent. A terminal pane's shell keeps
   * running: its output is kept from the moment the scrollback is read until the target pane attaches. A Heynote
   * pane saves its notes and reopens there. Moving a window's only pane to a new window does nothing; moving it to
   * another window closes this one.
   */
  async movePane(target: string | undefined): Promise<void> {
    const moves = this.backend.moves;
    const pane = this.current();
    if (!moves || !pane) return;
    if (target === undefined && this.panes.length === 1) return;
    const terminal = pane.terminal;
    // The pane arrives as a normal one, and this window shows its grid again.
    if (this.zen === pane.id) this.setZen(undefined);
    if (pane.note) {
      pane.note.flush();
      await moves.move(target, { kind: "heynote" });
    } else {
      const session = terminal?.session();
      if (!terminal || session === undefined) return;
      // Output from here on waits in the core, so none lands after the scrollback is read and none is lost.
      await moves.detach(session);
      const payload: MovePayload = { kind: "terminal", session, scrollback: "", zoom: pane.zoom };
      try {
        payload.scrollback = await terminal.serialize();
        await moves.move(target, payload);
      } catch (error) {
        await moves.attach(session, (bytes) => terminal.term.write(bytes)).catch(() => undefined);
        throw error;
      }
    }
    this.remove(pane);
    terminal?.detach();
    if (this.panes.length === 0) await this.closeEmptyWindow();
  }

  /**
   * Opens the pane another window sent here under `token`, focused: the Heynote pane, or a terminal pane that takes
   * over the moved shell with its scrollback and zoom. Resolves to false when nothing waits under `token`.
   */
  async arrive(token: string): Promise<boolean> {
    const payload = await this.backend.moves?.take(token);
    if (!payload) return false;
    if (payload.kind === "heynote") await this.openHeynote();
    else await this.open(undefined, payload);
    return true;
  }

  /**
   * Opens a new Heynote pane after the others and focuses it, however many are open in this window already. The
   * Heynote pages keep each other in sync through the note store (see `heynote/bridge.js`), in this window and
   * in every other tiili window, so the pane opens in the window that asked for it.
   */
  async openHeynote(): Promise<void> {
    const { element, chip, zenButton, host } = this.paneElement();
    const pane: Pane = { id: this.nextId++, element, chip, zenButton, zoom: 0, ready: Promise.resolve(undefined) };
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
    if (this.zen !== undefined) this.setZen(pane.id);
    this.render();
    this.markFocused(this.panes.length - 1);
  }

  /**
   * A pane's element: its title row with the chip and the Zen icon, the host its content goes in and the grab strip.
   * The icon and a double-click on the title row toggle Zen; the pane's own mousedown has focused it by then.
   */
  private paneElement(): { element: HTMLElement; chip: HTMLElement; zenButton: HTMLElement; host: HTMLElement } {
    const element = document.createElement("div");
    element.className = "pane";
    const title = document.createElement("div");
    title.className = "pane-title";
    const chip = createPaneChip();
    const zenButton = document.createElement("button");
    zenButton.type = "button";
    zenButton.className = "pane-zen-toggle";
    zenButton.title = `Zen mode ${this.platform === "macos" ? "⇧⌘↩" : "Ctrl+Shift+Enter"}`;
    zenButton.setAttribute("aria-label", "Zen mode");
    // Not a keyboard target: the terminal keeps the keyboard, and clicks leave its focus alone.
    zenButton.tabIndex = -1;
    zenButton.innerHTML = ZEN_ICON;
    zenButton.addEventListener("mousedown", (event) => event.preventDefault());
    zenButton.addEventListener("click", () => this.toggleZen());
    title.append(chip, zenButton);
    title.addEventListener("dblclick", (event) => {
      if (event.target instanceof Element && event.target.closest(".pane-zen-toggle")) return;
      if (!this.view.dragged()) this.toggleZen();
    });
    // Dragging the top edge onto another pane swaps the two; dragging inside the terminal still selects.
    const grab = document.createElement("div");
    grab.className = "pane-grab";
    const host = document.createElement("div");
    host.className = "pane-terminal";
    element.append(title, host, grab);
    return { element, chip, zenButton, host };
  }

  /** Gives pane `pane`'s terminal or Heynote the keyboard. */
  private give(pane: Pane): void {
    if (pane.note) pane.note.focus();
    else pane.terminal?.term.focus();
  }

  /**
   * Opens a pane after the others and focuses it: in `start` when given (a new window's first pane), else in the
   * focused pane's working directory. With `adopt` the pane takes over a shell moved from another window instead,
   * at that pane's zoom.
   */
  async open(start?: string, adopt?: AdoptedSession & { zoom: number }): Promise<void> {
    await this.openPane(adopt ? undefined : (start ?? (await this.currentCwd())), adopt);
  }

  /**
   * Reopens the window as the last session left it: its panes in their saved order, folders, zoom and titles, the
   * Heynote pane, the tiling and track sizes, then the focus. A terminal pane shows its saved scrollback (when
   * Restore scrollback and commands is on) and what ran in it before its new shell starts; nothing runs again.
   * Resolves to false, opening nothing, when the window had no pane.
   */
  async restore(restored: Restored): Promise<boolean> {
    const plan = restorePlan(restored, this.settings().behaviour.restoreScrollback);
    if (!plan) return false;
    if (plan.mode) this.layout = setMode(this.layout, plan.mode);
    // Each pane is placed before the first terminal opens, so every terminal opens at its pane's final size.
    const opening = plan.panes.map((pane) =>
      pane.kind === "heynote" ? this.openHeynote() : this.openPane(pane.cwd, undefined, undefined, pane),
    );
    if (plan.sizes) {
      this.layout = { ...this.layout, ...plan.sizes };
      this.render();
    }
    this.focus(plan.focused);
    const results = await Promise.allSettled(opening);
    // A pane whose shell could not start says so in its terminal; the others stay.
    this.focus(Math.min(plan.focused, this.panes.length - 1));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) this.report(failed.reason);
    return true;
  }

  /**
   * Opens the pane `tiili open` asked for after the others, as {@link open} does, but leaves the focus where it is.
   * Resolves to its session; rejects when the program could not start, after removing the pane.
   */
  async openRequested(request: PaneOpenRequest): Promise<SessionId> {
    const pane = await this.openPane(request.cwd ?? undefined, undefined, {
      command: request.command,
      path: request.path ?? undefined,
      title: request.title ?? undefined,
    });
    if (pane.session === undefined) throw new Error("the pane's program did not start");
    return pane.session;
  }

  /**
   * Opens a terminal pane after the others in `cwd`: focused, unless it is a `requested` one, which also runs that
   * program instead of a shell. A `restored` pane takes its saved zoom and title and shows its preface first.
   */
  private async openPane(
    cwd: string | undefined,
    adopt?: AdoptedSession & { zoom: number },
    requested?: Requested,
    restored?: PaneRestore,
  ): Promise<Pane> {
    const { element, chip, zenButton, host } = this.paneElement();
    element.addEventListener("focusin", () => this.markFocused(this.panes.indexOf(pane)));
    element.addEventListener("mousedown", () => this.focus(this.panes.indexOf(pane)));
    element.addEventListener("contextmenu", (event) => this.contextMenu(event));

    let resolve: (terminal: PaneTerminal | undefined) => void = () => {};
    const pane: Pane = {
      id: this.nextId++,
      element,
      chip,
      zenButton,
      zoom: adopt?.zoom ?? restored?.zoom ?? 0,
      ready: new Promise((r) => (resolve = r)),
      gate: new AttentionGate(),
      title: requested?.title ?? restored?.title,
    };
    if (pane.title !== undefined) showPaneChip(element, chip, pane.title);
    const focused = this.current();
    const hadKeyboard = focused !== undefined && focused.element.contains(document.activeElement);
    this.panes.push(pane);
    this.layout = addPane(this.layout, pane.id);
    // In Zen a pane the user opens is shown alone; one `tiili open` asked for joins the hidden grid.
    if (this.zen !== undefined && !requested) this.setZen(pane.id);
    // Laid out first, so the terminal opens at its pane's size.
    this.render();
    if (!requested) this.markFocused(this.panes.length - 1);
    // Re-rendering the grid can take the keyboard from the focused pane's terminal.
    else if (focused && hadKeyboard) this.give(focused);

    try {
      const opened = await openTerminal(
        this.backend,
        host,
        this.settings,
        cwd,
        (session) => this.onSession(pane, session),
        () => pane.zoom,
        () => this.close(this.panes.indexOf(pane)).catch((error) => this.report(error)),
        adopt,
        (signal) => this.onSignal(pane, signal),
        requested,
        restored,
      );
      opened.term.attachCustomKeyEventHandler((event) => this.onKey(opened, event));
      opened.find.interceptKeys((event) => this.shortcut(event));
      pane.terminal = opened;
      // Opened hidden by Zen: it keeps the size it opened at until Zen ends.
      if (this.hidden(pane)) opened.holdSize();
      resolve(opened);
    } catch (error) {
      resolve(undefined);
      this.remove(pane);
      throw error;
    }
    if (this.current() === pane) this.give(pane);
    return pane;
  }

  /** Closes pane `index` without asking. Focus moves to the pane that takes its place, else the one before. */
  async close(index: number): Promise<void> {
    const pane = this.panes[index];
    if (!pane) return;
    pane.note?.flush();
    if (pane.session !== undefined) this.clearMark(pane.session);
    this.remove(pane);
    if (this.panes.length === 0) await this.closeEmptyWindow();
    const terminal = await pane.ready;
    // The terminal stays on screen while its pane fades out.
    if (!prefersReducedMotion()) await new Promise((r) => setTimeout(r, EXIT_HOLD_MS));
    await terminal?.dispose();
  }

  /** Focuses pane `index` (0-based, in grid order: left to right, top to bottom); does nothing when there is no such pane. */
  focus(index: number): void {
    const pane = this.panes[index];
    if (!pane) return;
    // In Zen the pane that takes the focus is shown alone.
    if (this.zen !== undefined && this.zen !== pane.id) {
      this.setZen(pane.id);
      this.render();
    }
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
    // A new font or Zen width changes the Zen pane's width.
    this.view.sizeZen();
  }

  /** A `pane-cwd` report: updates the pane running that session, or keeps it until the pane hears its id. */
  private onCwd(place: PaneCwd): void {
    this.places.set(place.paneId, place);
    const pane = this.panes.find((p) => p.session === place.paneId);
    if (pane) this.showPlace(pane, place);
    this.scheduleSave();
  }

  /** A `pane-command` report: relabels the pane running that session once its place is known. */
  private onCommand(report: PaneCommand): void {
    this.commands.set(report.paneId, report.command);
    const pane = this.panes.find((p) => p.session === report.paneId);
    if (pane && pane === this.current()) this.showTitle();
    const place = this.places.get(report.paneId);
    if (pane && place) this.showPlace(pane, place);
    this.scheduleSave();
  }

  /** Pane `pane` now runs shell session `session`. */
  private onSession(pane: Pane, session: number): void {
    if (pane.session !== undefined) this.forget(pane.session);
    pane.session = session;
    this.reportOrder();
    showPaneAttention(pane.element, pane.chip, this.marks.get(session));
    if (pane === this.current()) this.showTitle();
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
   * what runs in the pane. A remote pane shows `host:place`, tinted by its host and repository, else by its host.
   * The core assigns the tint app-wide, so a repository has the same one in every window.
   */
  private showPlace(pane: Pane, place: PaneCwd): void {
    const command = pane.session === undefined ? undefined : this.commands.get(pane.session);
    pane.tint = paneTint(place);
    pane.terminal?.links.placeChanged(`${place.host ?? ""}\0${place.cwd}`);
    showPaneChip(pane.element, pane.chip, pane.title ?? chipLabel(placeLabel(place), command), pane.tint);
    if (pane === this.current()) this.reportName();
  }

  /** Tells the app this window's name, its focused pane's chip text, for other windows' Move to Window ▸. */
  private reportName(): void {
    const name = this.current()?.chip.textContent ?? "";
    if (!this.backend.moves || name === "" || name === this.reportedName) return;
    this.reportedName = name;
    this.backend.moves.setName(name).catch(() => undefined);
  }

  /** Sets the window's title from the focused pane's command: none for a Heynote pane or before one is reported. */
  private showTitle(): void {
    const pane = this.current();
    const command = pane?.session === undefined ? undefined : this.commands.get(pane.session);
    const title = windowTitle(command);
    if (title === this.shownTitle) return;
    this.shownTitle = title;
    this.backend.setTitle(title).catch(() => undefined);
  }

  private remove(pane: Pane): void {
    const index = this.panes.indexOf(pane);
    if (index < 0) return;
    if (pane.session !== undefined) this.forget(pane.session);
    const wasFocused = index === this.focused;
    this.panes.splice(index, 1);
    this.layout = removePane(this.layout, pane.id);
    // With one pane left Zen ends; when the Zen pane goes, the pane that takes the focus is shown alone.
    if (this.panes.length <= 1) this.setZen(undefined);
    else if (this.zen === pane.id) {
      const next = wasFocused ? Math.min(index, this.panes.length - 1) : this.focused - (index < this.focused ? 1 : 0);
      this.setZen(this.panes[Math.max(0, next)]?.id);
    }
    // The view takes the pane's element out once it has faded out.
    this.render();
    if (this.panes.length === 0) {
      this.focused = -1;
      this.showTitle();
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
    this.scheduleSave();
    if (document.hasFocus()) this.clearCurrent();
    this.reportName();
    this.showTitle();
  }

  /**
   * A bell or notification from pane `pane`'s shell: marks the pane unless the user is looking at it (it is the
   * focused pane of the focused window), once its gate lets the signal through.
   */
  private onSignal(pane: Pane, signal: AttentionSignal): void {
    const attention = this.backend.attention;
    const session = pane.session;
    if (!attention || !pane.gate || session === undefined) return;
    if (pane === this.current() && document.hasFocus()) return;
    const result = pane.gate.signal(signal, performance.now());
    if (!result) return;
    attention.mark(session, result.message, pane.chip.textContent ?? "").catch(() => undefined);
  }

  /** Shows `marks`, every marked session app-wide, on this window's panes. */
  private showMarks(marks: AttentionMark[]): void {
    this.marks = new Map(marks.map((mark) => [mark.session, mark]));
    for (const pane of this.panes) {
      const mark = pane.session === undefined ? undefined : this.marks.get(pane.session);
      showPaneAttention(pane.element, pane.chip, mark);
    }
    this.showZen();
  }

  /** Clears session `session`'s mark, if it has one; the app ignores a session without one. */
  private clearMark(session: number): void {
    // Asked even when no mark is known yet: one may be on its way from the app.
    this.marks.delete(session);
    this.backend.attention?.clear(session).catch(() => undefined);
  }

  /** The user looks at the focused pane: its mark clears. */
  private clearCurrent(): void {
    const session = this.current()?.session;
    if (session !== undefined) this.clearMark(session);
  }

  /** Focuses the pane running session `session`, for the next-pane shortcut; its mark clears. */
  private focusSession(session: number): void {
    const index = this.panes.findIndex((pane) => pane.session === session);
    if (index < 0) return;
    this.focus(index);
    this.clearMark(session);
  }

  /** Lays the panes out again: one row element per grid row, panes in order, with the dividers or the Zen pane. */
  private render(): void {
    this.view.render(this.layout, this.zen);
    this.showZen();
    this.reportOrder();
    this.scheduleSave();
  }

  /** Tells the app this window's state for the next launch once changes have settled. */
  private scheduleSave(): void {
    if (!this.backend.session) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.saveState().catch(() => undefined);
    }, SAVE_SETTLE_MS);
  }

  /** Tells the app this window's state now, after any report still in flight. */
  private saveState(): Promise<void> {
    const session = this.backend.session;
    if (!session) return Promise.resolve();
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const next = this.saving.then(async () => {
      const panes = await Promise.all(this.panes.map((pane) => this.snapshot(pane)));
      const focused = this.current()?.id;
      await session.update(snapshotWindow(this.layout, panes, focused, this.settings().behaviour.restoreScrollback));
    });
    this.saving = next.catch(() => undefined);
    return next;
  }

  /** Pane `pane` as the next launch reopens it: its kind, folder or host, zoom, title and what runs in it. */
  private async snapshot(pane: Pane): Promise<PaneSnapshot> {
    if (pane.note) return { id: pane.id, kind: "heynote", zoom: pane.zoom };
    const saved: PaneSnapshot = { id: pane.id, kind: "terminal", zoom: pane.zoom };
    if (pane.title !== undefined) saved.title = pane.title;
    const session = pane.session;
    if (session === undefined) return saved;
    const place = this.places.get(session);
    const cwd = place?.cwd ?? (await pane.terminal?.cwd().catch(() => undefined));
    if (cwd) saved.cwd = cwd;
    if (place?.host) saved.host = place.host;
    const running = await this.backend.session?.running(session).catch(() => undefined);
    if (running?.command) saved.command = running.command;
    if (running?.program) saved.program = running.program;
    return saved;
  }

  /**
   * Answers the app's `session-flush`: tells it the window's latest state and, with Restore scrollback and commands
   * on, saves each terminal pane's scrollback, then says it is done, which it does even when saving failed.
   */
  async flush(): Promise<void> {
    const session = this.backend.session;
    if (!session) return;
    try {
      await this.saveState().catch(() => undefined);
      if (this.settings().behaviour.restoreScrollback) {
        await Promise.all(
          this.panes.map(async (pane) => {
            if (!pane.terminal) return;
            await session.saveScrollback(pane.id, await pane.terminal.scrollback());
          }),
        ).catch(() => undefined);
      }
    } finally {
      await session.flushed();
    }
  }

  /** Closes the window after its last pane went, telling the app first that it has nothing to reopen. */
  private async closeEmptyWindow(): Promise<void> {
    await this.saveState().catch(() => undefined);
    await this.backend.closeWindow();
  }

  /** True when Zen shows another pane alone, so `pane` is hidden in the grid. */
  private hidden(pane: Pane): boolean {
    return this.zen !== undefined && pane.id !== this.zen;
  }

  /** The panes on screen: all of them, or in Zen the Zen pane only. */
  private shown(): Pane[] {
    return this.panes.filter((pane) => !this.hidden(pane));
  }

  private zenPane(): Pane | undefined {
    return this.zen === undefined ? undefined : this.byId(this.zen);
  }

  /**
   * Toggles Zen for the focused pane: it shows alone in the centre, or the grid shows again. With one pane Zen does
   * not apply. The pane keeps the keyboard.
   */
  toggleZen(): void {
    const pane = this.current();
    if (!pane || (this.zen === undefined && this.panes.length <= 1)) return;
    this.setZen(this.zen === undefined ? pane.id : undefined);
    this.render();
    this.give(pane);
  }

  /**
   * Sets which pane Zen shows, or none, without laying the panes out again. Panes that hide hold their terminal's
   * size, so their shells keep the grid size; panes that show again refit once. Ignored for a missing pane and while
   * one pane is open.
   */
  private setZen(id: PaneId | undefined): void {
    const next = id !== undefined && this.panes.length > 1 && this.byId(id) ? id : undefined;
    if (next === this.zen) return;
    const wasHidden = new Set(this.panes.filter((pane) => this.hidden(pane)));
    this.zen = next;
    for (const pane of this.panes) {
      const hidden = this.hidden(pane);
      if (hidden && !wasHidden.has(pane)) pane.terminal?.holdSize();
      else if (!hidden && wasHidden.has(pane)) pane.terminal?.releaseSize(true);
    }
  }

  /**
   * Shows the Zen icons: hidden with one pane, lit on the Zen pane, with a dot there while a hidden pane of this
   * window needs the user.
   */
  private showZen(): void {
    const single = this.panes.length <= 1;
    const marked = this.panes.some(
      (pane) => this.hidden(pane) && pane.session !== undefined && this.marks.has(pane.session),
    );
    for (const pane of this.panes) {
      const on = pane.id === this.zen;
      pane.zenButton.hidden = single;
      pane.zenButton.toggleAttribute("data-on", on);
      pane.zenButton.toggleAttribute("data-marked", on && marked);
      pane.zenButton.setAttribute("aria-pressed", String(on));
    }
  }

  /** The Zen pane's cell size and what it adds to its columns: its padding and the terminal's scrollbar. */
  private zenMetrics(): { cell: number; chrome: number } {
    const pane = this.zenPane() ?? this.current();
    const cell = pane?.terminal?.cellSize()?.width ?? FALLBACK_CELL.width;
    const style = pane ? getComputedStyle(pane.element) : undefined;
    const padding = (parseFloat(style?.paddingLeft ?? "") || 0) + (parseFloat(style?.paddingRight ?? "") || 0);
    return { cell, chrome: padding + (pane?.note ? 0 : SCROLLBAR_WIDTH) };
  }

  /** Saves the columns a Zen pane `width` pixels wide holds as the Zen width, which every window then uses. */
  private async saveZenWidth(width: number): Promise<void> {
    const { cell, chrome } = this.zenMetrics();
    const columns = zenColumns(width, cell, chrome);
    const settings = this.settings();
    if (columns === settings.zen.width) return;
    await this.saveSettings({ ...settings, zen: { ...settings.zen, width: columns } });
  }

  /** Tells the app the panes' sessions in grid order when it changed, so `tiili list` follows the grid. */
  private reportOrder(): void {
    const control = this.backend.paneControl;
    if (!control) return;
    const sessions = this.panes.flatMap((pane) => (pane.session === undefined ? [] : [pane.session]));
    const order = sessions.join(",");
    if (order === this.reportedOrder) return;
    this.reportedOrder = order;
    control.setOrder(sessions).catch(() => undefined);
  }

  /** xterm's key hook: layout, pane, settings, find and clipboard shortcuts are kept from the shell. */
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
    applyFont(terminal.term, settings, pane.zoom)
      // A larger or smaller font widens or narrows the Zen pane, once the new cells are laid out.
      .then(() => requestAnimationFrame(() => this.view.sizeZen()))
      .catch((error: unknown) => this.report(error));
    this.scheduleSave();
  }

  /**
   * Carries out a layout, next-pane, settings, Zen, pane, zoom or find shortcut on keydown. Returns true when `event` is
   * one of those keys, which then must not reach the pane's shell, its find bar's field or Heynote. Zoom and find
   * keys act only in terminal panes; in a Heynote pane they reach Heynote, whose own search the find keys open.
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
    if (this.backend.attention && attentionShortcut(event, this.platform)) {
      if (event.type === "keydown") {
        event.preventDefault();
        this.backend.attention.next().catch(() => undefined);
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
    if (zenAction(event, this.platform)) {
      // In the macOS app ⇧⌘↩ comes from the Shell menu; here the key is only kept from the shell.
      if (!this.viaMenu() && event.type === "keydown") {
        event.preventDefault();
        this.toggleZen();
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
    const find = findAction(event, this.platform);
    if (find && pane && !pane.note) {
      // In the macOS app ⌘F, ⌘G and ⇧⌘G come from the Edit menu; here those keys are only kept from the shell.
      if (!this.viaMenu() && event.type === "keydown") {
        event.preventDefault();
        this.find(find);
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
