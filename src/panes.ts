import { AttentionGate, type AttentionMark, type AttentionSignal, requestedSignal } from "./attention";
import type {
  Backend,
  MenuItem,
  MovePayload,
  PaneLaunch,
  PaneMovePayload,
  PaneAttentionRequest,
  PaneOpenRequest,
  SessionId,
  TabMenuId,
  TabMovePayload,
} from "./backend";
import { attachClipboardMenus, handleClipboardKey } from "./clipboard";
import { confirmCloseTab } from "./closeTabDialog";
import {
  attentionShortcut,
  FIND_MENU_ITEMS,
  findAction,
  layoutAction,
  paneAction,
  settingsShortcut,
  tabAction,
  zenAction,
  zoomAction,
  type FindAction,
  type LayoutAction,
  type PaneAction,
  type Platform,
  type TabAction,
  type ZoomAction,
} from "./keymap";
import { move, reset, setMode, type PaneId } from "./layout/model";
import { EXIT_HOLD_MS, prefersReducedMotion } from "./layout/motion";
import { openHeynote } from "./heynotePane";
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
import {
  restorePlans,
  snapshotWindow,
  type PaneRestore,
  type PaneSnapshot,
  type Restored,
  type SavedTab,
  type TabRestore,
} from "./session";
import type { Settings } from "./settings";
import { zoomedSize } from "./responsive";
import { give, Tab, type Pane, type TabHooks } from "./tab";
import {
  badgeCount,
  insertBeside,
  neighbourIndex,
  reorder,
  stepIndex,
  tabLabel,
  tabOf,
  type TabStrip,
} from "./tabs";
import { applyFont, openTerminal, refreshTheme, type AdoptedSession, type PaneTerminal } from "./terminal";
import { paneTint } from "./tints";
import { menuEntries, tabMenuEntries } from "./windowMenu";
import { windowTitle } from "./windowTitle";

/** Changes settle this long before the window tells the app its state for the next launch. */
const SAVE_SETTLE_MS = 500;
/** The tab action each of the macOS Shell menu's tab items carries out. */
const TAB_MENU_ACTIONS: Partial<Record<TabMenuId, TabAction>> = {
  tabNew: "new",
  tabNext: "next",
  tabPrevious: "previous",
  tabMoveNext: "moveNext",
  tabMovePrevious: "movePrevious",
};

/** The attribute naming a tab strip entry's tab index, where a pane's grab strip can be dropped. */
const TAB_INDEX = "data-tab-index";

/** The Zen icon on a pane's title row: a pane between two side brackets. */
const ZEN_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="6" height="10" ' +
  'rx="0.5"/><path d="M2.5 5v6M13.5 5v6"/></svg>';

/** A pane `tiili open` asked for: the program it runs and the title its chip shows. */
interface Requested extends PaneLaunch {
  title?: string;
}

/**
 * The window's tabs, one shown at a time, each with its panes in grid order tiled into its own grid (see {@link Tab}).
 * Keys, menus, attention, the window's name and title and moves between windows act on the shown tab's focused pane.
 */
export class Panes {
  /** In strip order; never empty. */
  private tabs: Tab[] = [];
  /** The index of the shown tab. */
  private shown = 0;
  /** Pane ids are unique across the window's tabs, so a pane keeps its id when it moves to another tab. */
  private nextId = 1;
  /**
   * Set while a popped-out tab's panes arrive: focusing them then is not the user looking at them, so their marks
   * move with them ("Mark moves") instead of clearing.
   */
  private arriving = false;
  private contextMenu: (event: MouseEvent) => void = () => {};
  private readonly tabHooks: TabHooks;
  /** The top bar's tab strip, once attached. */
  private strip: TabStrip | undefined;
  /** The strip entry a dragged pane is over. */
  private tabDropTarget: HTMLElement | undefined;
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

  private constructor(
    private readonly backend: Backend,
    private readonly root: HTMLElement,
    private readonly platform: Platform,
    private readonly settings: () => Settings,
    private readonly openSettings: () => void,
    private readonly saveZenWidth: (columns: number) => Promise<void>,
  ) {
    this.tabHooks = {
      rendered: () => {
        this.reportOrder();
        this.updateStrip();
        this.scheduleSave();
      },
      dropOutside: (tab, from, under) => this.dropOnTab(tab, from, under),
      dragOutside: (under) => this.markTabDropTarget(under),
      marked: (session) => this.marks.has(session),
      savedZenColumns: () => this.settings().zen.width,
      zenResized: (columns) => {
        this.saveZenColumns(columns).catch((error: unknown) => this.report(error));
      },
    };
    this.tabs = [new Tab(root, settings().tiling.layout, this.tabHooks)];
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
   * edge drag saves the new Zen width through `saveZenWidth`. Shells, clipboard, menus and the window come from
   * `backend`.
   */
  static async create(
    backend: Backend,
    root: HTMLElement,
    platform: Platform,
    settings: () => Settings,
    openSettings: () => void,
    saveZenWidth: (columns: number) => Promise<void>,
  ): Promise<Panes> {
    const panes = new Panes(backend, root, platform, settings, openSettings, saveZenWidth);
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
      () => panes.menuItems(),
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
      await backend.onAppEvent("pane-close-request", (request) => {
        panes
          .closeRequested(request.session)
          .then(
            () => control.closed(request.requestId),
            (error: unknown) => control.closed(request.requestId, String(error)),
          )
          .catch((error: unknown) => console.error(error));
      });
      await backend.onAppEvent("pane-attention-request", (request) => panes.attentionRequested(request));
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
        const tab = TAB_MENU_ACTIONS[payload as TabMenuId];
        if (payload === "zen") panes.toggleZen();
        else if (tab) panes.actTab(tab);
        else panes.act({ type: payload as "new" | "close" | "moveToNewWindow" });
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

  /** The shown tab. */
  private get tab(): Tab {
    return this.tabs[this.shown] ?? (this.tabs[0] as Tab);
  }

  /** The shown tab's focused pane, which the keys and menus act on. */
  private current(): Pane | undefined {
    return this.tab.current();
  }

  /** Every pane of the window, tab by tab. */
  private allPanes(): Pane[] {
    return this.tabs.flatMap((tab) => tab.panes);
  }

  /** The tab holding `pane`. */
  private tabOf(pane: Pane): Tab | undefined {
    return this.tabs.find((tab) => tab.panes.includes(pane));
  }

  /** Moves the focused pane or resets the grid to even sizes; in Zen the grid shows again first. */
  actLayout(action: LayoutAction): void {
    const pane = this.current();
    if (!pane) return;
    const tab = this.tab;
    // In Zen the grid shows again first.
    tab.setZen(undefined);
    tab.relayout(action === "reset" ? reset(tab.layout) : move(tab.layout, pane.id, action.move));
  }

  /** Carries out a pane shortcut. Focusing a pane number that is not open in the shown tab does nothing. */
  act(action: PaneAction): void {
    const report = (error: unknown) => this.report(error);
    const pane = this.current();
    if (action.type === "new") this.open().catch(report);
    else if (action.type === "heynote") this.openHeynote().catch(report);
    else if (action.type === "close") {
      if (pane) this.close(pane).catch(report);
    } else if (action.type === "newWindow") this.newWindow().catch(report);
    else if (action.type === "moveToNewWindow") this.movePane(undefined).catch(report);
    else this.focus(action.index);
  }

  /**
   * Carries out a tab shortcut: a new tab beside the shown one, the next or previous tab (wrapping), or the focused
   * pane moved to the next or previous tab, which does nothing past the first or last tab.
   */
  actTab(action: TabAction): void {
    const report = (error: unknown) => this.report(error);
    const count = this.tabs.length;
    if (action === "new") this.newTab().catch(report);
    else if (action === "next" || action === "previous") this.showTab(stepIndex(this.shown, count, action === "next" ? 1 : -1));
    else {
      const target = neighbourIndex(this.shown, count, action === "moveNext" ? 1 : -1);
      const pane = this.current();
      if (target !== undefined && pane) this.moveToTab(pane, target);
    }
  }

  /** Gives the window its top bar's tab strip, which shows the tabs from now on. */
  attachStrip(strip: TabStrip): void {
    this.strip = strip;
    this.updateStrip();
  }

  /** Adds an empty tab at strip index `at`, hidden until it is shown. */
  private addTab(at: number): Tab {
    const tab = new Tab(this.root, this.settings().tiling.layout, this.tabHooks);
    tab.hide();
    this.tabs.splice(at, 0, tab);
    if (at <= this.shown) this.shown++;
    return tab;
  }

  /** Opens a new tab beside the shown one with one pane in the focused pane's folder, and shows it. */
  async newTab(): Promise<void> {
    const cwd = await this.currentCwd();
    const tab = this.addTab(insertBeside(this.shown));
    this.showTab(this.tabs.indexOf(tab));
    await this.openPane(tab, cwd);
  }

  /** Shows tab `index` and gives its focused pane the keyboard; does nothing when there is no such tab. */
  showTab(index: number): void {
    const next = this.tabs[index];
    if (!next) return;
    const old = this.tabs[this.shown];
    if (old && old !== next) old.hide();
    this.shown = index;
    next.show();
    this.shownChanged();
    this.scheduleSave();
  }

  /** After another tab is shown: its focused pane takes the keyboard, the window's name and title follow it. */
  private shownChanged(): void {
    const tab = this.tab;
    const pane = tab.current();
    if (pane) {
      this.markFocused(tab, tab.focused);
      give(pane);
    } else {
      this.showTitle();
      this.updateStrip();
    }
  }

  /** Moves tab `from` to strip index `to`, for a drag in the strip. */
  reorderTab(from: number, to: number): void {
    const shown = this.tab;
    this.tabs = reorder(this.tabs, from, to);
    this.shown = this.tabs.indexOf(shown);
    this.reportOrder();
    this.updateStrip();
    this.scheduleSave();
  }

  /**
   * Gives tab `index` the lasting name `name`; an empty one brings the automatic label back, and undefined (a rename
   * given up) keeps the old one. The focused pane gets the keyboard back.
   */
  renameTab(index: number, name: string | undefined): void {
    const tab = this.tabs[index];
    if (tab && name !== undefined) tab.name = name.trim() === "" ? undefined : name.trim();
    this.updateStrip();
    this.scheduleSave();
    this.focusCurrent();
  }

  /** Opens tab `index`'s right-click menu: Rename…, Pop Out (where there are other windows to make) and Close Tab. */
  async tabMenu(index: number, event: MouseEvent): Promise<void> {
    const tab = this.tabs[index];
    if (!tab) return;
    const report = (error: unknown) => this.report(error);
    const items: MenuItem[] = [
      { label: "Rename…", action: () => this.strip?.rename(this.tabs.indexOf(tab)) },
      ...(this.backend.moves && this.tabs.length > 1
        ? [{ label: "Pop Out", action: () => this.popOutTab(this.tabs.indexOf(tab)).catch(report) }]
        : []),
      { separator: true },
      { label: "Close Tab", action: () => this.closeTab(this.tabs.indexOf(tab)).catch(report) },
    ];
    const show = await this.backend.contextMenu(items);
    await show(event);
  }

  /** Closes tab `index` and its panes, asking first when it holds more than one. */
  async closeTab(index: number): Promise<void> {
    const tab = this.tabs[index];
    if (!tab) return;
    const panes = [...tab.panes];
    if (panes.length > 1 && !(await confirmCloseTab(panes.length))) {
      this.focusCurrent();
      return;
    }
    await Promise.all(panes.map((pane) => this.close(pane)));
  }

  /** Takes empty tab `tab` out of the window, showing its neighbour when it was the shown one. The last tab stays. */
  private dropTab(tab: Tab): void {
    const index = this.tabs.indexOf(tab);
    if (index < 0 || this.tabs.length === 1) return;
    const wasShown = index === this.shown;
    tab.dispose();
    this.tabs.splice(index, 1);
    if (wasShown) {
      this.shown = Math.min(index, this.tabs.length - 1);
      this.tab.show();
      this.shownChanged();
    } else {
      if (index < this.shown) this.shown--;
      this.updateStrip();
    }
    this.reportOrder();
    this.scheduleSave();
  }

  /**
   * Moves `pane` last into tab `target`'s grid, or into a new tab beside its own for "new", keeping its shell and
   * scrollback; that tab is shown with the pane focused. A tab left empty closes. Moving a tab's only pane to a new
   * tab, or a pane to its own tab, does nothing.
   */
  moveToTab(pane: Pane, target: number | "new"): void {
    const source = this.tabOf(pane);
    if (!source) return;
    let tab: Tab | undefined;
    if (target === "new") {
      if (source.panes.length === 1) return;
      tab = this.addTab(insertBeside(this.tabs.indexOf(source)));
    } else tab = this.tabs[target];
    if (!tab || tab === source) return;
    pane.note?.flush();
    this.showTab(this.tabs.indexOf(tab));
    // Into the target's grid first, so the source's grid no longer holds the element and does not fade it out.
    tab.add(pane);
    source.remove(pane);
    // Without motion the target's grid does not refit its terminals; the source held this one when it was hidden.
    if (prefersReducedMotion()) pane.terminal?.releaseSize(true);
    if (source.panes.length === 0) this.dropTab(source);
    this.markFocused(tab, tab.panes.indexOf(pane));
    give(pane);
  }

  /** A pane's grab strip dropped on `under`: moves the pane to the strip entry's tab when `under` is in one. */
  private dropOnTab(tab: Tab, from: PaneId, under: Element): boolean {
    const entry = under.closest<HTMLElement>(`[${TAB_INDEX}]`);
    const pane = tab.byId(from);
    if (!entry || !pane) return false;
    this.moveToTab(pane, Number(entry.getAttribute(TAB_INDEX)));
    return true;
  }

  /** Highlights the strip entry under a dragged pane's grab strip. */
  private markTabDropTarget(under: Element | null): void {
    const entry = under?.closest<HTMLElement>(`[${TAB_INDEX}]`) ?? undefined;
    if (entry === this.tabDropTarget) return;
    this.tabDropTarget?.toggleAttribute("data-drop-target", false);
    this.tabDropTarget = entry;
    entry?.toggleAttribute("data-drop-target", true);
  }

  /** Shows the tabs in the strip: each labelled by its name or focused pane, background tabs with their marks. */
  private updateStrip(): void {
    if (!this.strip) return;
    const marked = new Set(this.marks.keys());
    const entries = this.tabs.map((tab, index) => {
      const pane = tab.current();
      return {
        label: tabLabel(tab.name, pane?.chip.textContent ?? ""),
        tint: pane?.tint,
        attention: index === this.shown ? 0 : badgeCount(tab.sessions(), marked),
      };
    });
    this.strip.update(entries, this.shown);
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

  /**
   * The right-click menu's move items: Move to Tab ▸ with the window's other tabs and New Tab, Move to New Window,
   * and Move to Window ▸ when other windows are open.
   */
  private async menuItems(): Promise<MenuItem[]> {
    const pane = this.current();
    const items: MenuItem[] = [{ separator: true }];
    if (pane) {
      const labels = this.tabs.map((tab) => tabLabel(tab.name, tab.current()?.chip.textContent ?? ""));
      const others: MenuItem[] = tabMenuEntries(labels, this.shown).map(({ index, text }) => ({
        label: text,
        action: () => this.moveToTab(pane, index),
      }));
      if (this.tab.panes.length > 1) {
        if (others.length > 0) others.push({ separator: true });
        others.push({ label: "New Tab", action: () => this.moveToTab(pane, "new") });
      }
      if (others.length > 0) items.push({ label: "Move to Tab", items: others });
    }
    const moves = this.backend.moves;
    if (!moves) return items.length > 1 ? items : [];
    const windows = await moves.list().catch(() => []);
    items.push({ label: "Move to New Window", action: () => this.act({ type: "moveToNewWindow" }) });
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
   * pane saves its notes and reopens there. The pane lands in the target window's shown tab. Moving a window's only
   * pane to a new window does nothing; moving it to another window closes this one.
   */
  async movePane(target: string | undefined): Promise<void> {
    const moves = this.backend.moves;
    const pane = this.current();
    if (!moves || !pane) return;
    if (target === undefined && this.allPanes().length === 1) return;
    const terminal = pane.terminal;
    // The pane arrives as a normal one, and this window shows its grid again.
    const owner = this.tabOf(pane);
    if (owner?.zen === pane.id) owner.setZen(undefined);
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
        await moves.attach(session, (bytes) => terminal.output(bytes)).catch(() => undefined);
        throw error;
      }
    }
    this.remove(pane);
    terminal?.detach();
    if (this.allPanes().length === 0) await this.closeEmptyWindow();
  }

  /**
   * Pop Out: moves tab `index` whole, its name, grid sizes, focused pane and every pane with its shell and scrollback,
   * to a new window under one move. Does nothing for the window's only tab.
   */
  async popOutTab(index: number): Promise<void> {
    const moves = this.backend.moves;
    const tab = this.tabs[index];
    if (!moves || !tab || this.tabs.length === 1) return;
    const panes = [...tab.panes];
    const focusedPane = panes[tab.focused];
    const detached: { session: SessionId; terminal: PaneTerminal }[] = [];
    const moved: Pane[] = [];
    const skipped: Pane[] = [];
    try {
      const payloads: PaneMovePayload[] = [];
      let focused = 0;
      for (const pane of panes) {
        if (pane === focusedPane) focused = payloads.length;
        if (pane.note) {
          pane.note.flush();
          payloads.push({ kind: "heynote" });
          moved.push(pane);
          continue;
        }
        const terminal = pane.terminal;
        const session = terminal?.session();
        // A pane whose shell has not started yet has nothing to move; it is closed once the tab has moved.
        if (!terminal || session === undefined) {
          if (pane === focusedPane) focused = 0;
          skipped.push(pane);
          continue;
        }
        // Output from here on waits in the core, so none lands after the scrollback is read and none is lost.
        await moves.detach(session);
        detached.push({ session, terminal });
        payloads.push({ kind: "terminal", session, scrollback: await terminal.serialize(), zoom: pane.zoom });
        moved.push(pane);
      }
      const { colSizes, rowSizes } = tab.layout;
      await moves.move(undefined, {
        kind: "tab",
        name: tab.name,
        layout: { colSizes, rowSizes },
        focused,
        panes: payloads,
      });
    } catch (error) {
      await Promise.all(
        detached.map(({ session, terminal }) =>
          moves.attach(session, (bytes) => terminal.output(bytes)).catch(() => undefined),
        ),
      );
      throw error;
    }
    // The panes keep their attention marks: they go with them to the new window ("Mark moves").
    for (const pane of moved) {
      this.remove(pane);
      pane.terminal?.detach();
    }
    // A pane still opening ends here, its shell with it, once that shell has started.
    await Promise.all(skipped.map((pane) => this.close(pane)));
  }

  /**
   * Opens what another window sent here under `token`, focused in the shown tab: the Heynote pane, or a terminal
   * pane that takes over the moved shell with its scrollback and zoom. A popped-out tab becomes a tab of its own
   * (this window's empty first tab, else a new one shown beside the shown one) with its name, grid sizes and focused
   * pane. Resolves to false when nothing waits under `token`.
   */
  async arrive(token: string): Promise<boolean> {
    const payload = await this.backend.moves?.take(token);
    if (!payload) return false;
    if (payload.kind === "tab") await this.arriveTab(payload);
    else if (payload.kind === "heynote") await this.openHeynote();
    else await this.open(undefined, payload);
    return true;
  }

  /** Builds popped-out tab `payload` here; see {@link arrive}. */
  private async arriveTab(payload: TabMovePayload): Promise<void> {
    let tab = this.tab;
    if (tab.panes.length > 0) {
      tab = this.addTab(insertBeside(this.shown));
      this.showTab(this.tabs.indexOf(tab));
    }
    tab.name = payload.name;
    // Each pane is given the keyboard as it opens, and the focused one again at the end: none of it clears a mark.
    this.arriving = true;
    try {
      for (const pane of payload.panes) {
        if (pane.kind === "heynote") await this.openHeynote(tab);
        else await this.openPane(tab, undefined, pane);
      }
      const { colSizes, rowSizes } = payload.layout;
      if (colSizes.length === tab.layout.colSizes.length && rowSizes.length === tab.layout.rowSizes.length) {
        tab.relayout({ ...tab.layout, colSizes, rowSizes });
      }
      if (tab.shown) this.focus(Math.min(payload.focused, tab.panes.length - 1));
    } finally {
      this.arriving = false;
    }
  }

  /**
   * Opens a new Heynote pane after the shown tab's others and focuses it, however many are open already. The
   * Heynote pages keep each other in sync through the note store (see `heynote/bridge.js`), in this window and
   * in every other tiili window, so the pane opens in the window that asked for it.
   */
  async openHeynote(tab: Tab = this.tab): Promise<void> {
    const { element, chip, zenButton, host } = this.paneElement();
    const pane: Pane = { id: this.nextId++, element, chip, zenButton, zoom: 0, ready: Promise.resolve(undefined) };
    this.listen(pane);
    showPaneChip(element, chip, "Heynote");
    pane.note = openHeynote(
      this.backend,
      host,
      this.platform,
      (event) => this.shortcut(event),
      () => this.paneFocused(pane),
    );
    pane.note.frame.addEventListener("load", () => {
      if (this.current() === pane) pane.note?.focus();
    });
    // In Zen a pane the user opens is shown alone.
    tab.add(pane, true);
    this.markFocused(tab, tab.panes.length - 1);
  }

  /** Focus follows the keyboard and clicks into `pane`, in whichever tab it is by then. */
  private listen(pane: Pane): void {
    pane.element.addEventListener("focusin", () => this.paneFocused(pane));
    pane.element.addEventListener("mousedown", () => {
      this.paneFocused(pane);
      give(pane);
    });
  }

  /** `pane` got the focus: it becomes its tab's focused pane. */
  private paneFocused(pane: Pane): void {
    const tab = this.tabOf(pane);
    if (tab) this.markFocused(tab, tab.panes.indexOf(pane));
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
      if (!this.tab.dragged()) this.toggleZen();
    });
    // Dragging the top edge onto another pane swaps the two; dragging inside the terminal still selects.
    const grab = document.createElement("div");
    grab.className = "pane-grab";
    const host = document.createElement("div");
    host.className = "pane-terminal";
    element.append(title, host, grab);
    return { element, chip, zenButton, host };
  }

  /**
   * Opens a pane after the shown tab's others and focuses it: in `start` when given (a new window's first pane), else
   * in the focused pane's working directory. With `adopt` the pane takes over a shell moved from another window
   * instead, at that pane's zoom.
   */
  async open(start?: string, adopt?: AdoptedSession & { zoom: number }): Promise<void> {
    const cwd = adopt ? undefined : (start ?? (await this.currentCwd()));
    await this.openPane(this.tab, cwd, adopt);
  }

  /**
   * Reopens the window as the last session left it: each of its tabs with its name, panes in their saved order,
   * folders, zoom and titles, the Heynote panes, the tiling and track sizes, then the focus of each tab; the shown tab
   * is the one that was shown. A terminal pane shows its saved scrollback (when Restore scrollback and commands is
   * on) and what ran in it before its new shell starts; nothing runs again. Resolves to false, opening nothing, when
   * the window had no pane.
   */
  async restore(restored: Restored): Promise<boolean> {
    const plan = restorePlans(restored, this.settings().behaviour.restoreScrollback);
    if (!plan) return false;
    // The window's first tab is the one it opens with; each further tab is added after the others, hidden.
    const tabs = plan.tabs.map((_, index) => (index === 0 ? (this.tabs[0] as Tab) : this.addTab(this.tabs.length)));
    const restoring = plan.tabs.map((tabPlan, index) => this.restoreTab(tabs[index] as Tab, tabPlan));
    this.showTab(plan.active);
    await Promise.all(restoring);
    return true;
  }

  /** Opens the saved panes of `tab` as `plan` says, then its sizes and focus; see {@link restore}. */
  private async restoreTab(tab: Tab, plan: TabRestore): Promise<void> {
    tab.name = plan.name;
    if (plan.mode) tab.layout = setMode(tab.layout, plan.mode);
    // Each pane is placed before the first terminal opens, so every terminal opens at its pane's final size.
    const opening = plan.panes.map((pane) =>
      pane.kind === "heynote" ? this.openHeynote(tab) : this.openPane(tab, pane.cwd, undefined, undefined, pane),
    );
    if (plan.sizes) tab.relayout({ ...tab.layout, ...plan.sizes });
    this.focusTab(tab, plan.focused);
    const results = await Promise.allSettled(opening);
    // A pane whose shell could not start says so in its terminal; the others stay.
    this.focusTab(tab, Math.min(plan.focused, tab.panes.length - 1));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) this.report(failed.reason);
  }

  /** Focuses pane `index` of `tab`; the keyboard goes to it when the tab is shown. */
  private focusTab(tab: Tab, index: number): void {
    this.markFocused(tab, index);
    const pane = tab.current();
    if (tab.shown && pane) give(pane);
  }

  /**
   * Opens the pane `tiili open` asked for after the others in the caller's tab (the shown one when the caller is
   * not found), as {@link open} does, but leaves the focus where it is and does not show that tab. Resolves to its
   * session; rejects when the program could not start, after removing the pane.
   */
  async openRequested(request: PaneOpenRequest): Promise<SessionId> {
    const index = tabOf(
      this.tabs.map((tab) => tab.sessions()),
      request.caller,
    );
    const tab = (index === undefined ? undefined : this.tabs[index]) ?? this.tab;
    const pane = await this.openPane(tab, request.cwd ?? undefined, undefined, {
      command: request.command,
      path: request.path ?? undefined,
      title: request.title ?? undefined,
    });
    if (pane.session === undefined) throw new Error("the pane's program did not start");
    return pane.session;
  }

  /**
   * Opens a terminal pane after tab `tab`'s others in `cwd`: focused, unless it is a `requested` one, which also runs
   * that program instead of a shell. A `restored` pane takes its saved zoom and title and shows its preface first.
   * A pane opened in a hidden tab keeps its size until the tab is shown.
   */
  private async openPane(
    tab: Tab,
    cwd: string | undefined,
    adopt?: AdoptedSession & { zoom: number },
    requested?: Requested,
    restored?: PaneRestore,
  ): Promise<Pane> {
    const { element, chip, zenButton, host } = this.paneElement();
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
    this.listen(pane);
    if (pane.title !== undefined) showPaneChip(element, chip, pane.title);
    const focused = this.current();
    const hadKeyboard = focused !== undefined && focused.element.contains(document.activeElement);
    // Laid out first, so the terminal opens at its pane's size. In Zen a pane the user opens is shown alone; one
    // `tiili open` asked for or a restored one joins the hidden grid.
    tab.add(pane, !requested && !restored);
    if (!requested) this.markFocused(tab, tab.panes.length - 1);
    // Re-rendering the grid can take the keyboard from the focused pane's terminal.
    else if (focused && hadKeyboard) give(focused);

    try {
      const opened = await openTerminal(
        this.backend,
        host,
        this.settings,
        cwd,
        (session) => this.onSession(pane, session),
        () => pane.zoom,
        () => this.close(pane).catch((error) => this.report(error)),
        adopt,
        (signal) => this.onSignal(pane, signal),
        requested,
        restored,
      );
      opened.term.attachCustomKeyEventHandler((event) => this.onKey(opened, event));
      opened.find.interceptKeys((event) => this.shortcut(event));
      pane.terminal = opened;
      // Its tab may have been hidden, or Zen may show another pane, while the shell started: it keeps this size
      // until it is shown.
      if (this.tabOf(pane)?.holds(pane)) opened.holdSize();
      resolve(opened);
    } catch (error) {
      resolve(undefined);
      this.remove(pane);
      throw error;
    }
    if (this.current() === pane) give(pane);
    return pane;
  }

  /**
   * Closes `pane` without asking. Focus moves to the pane that takes its place, else the one before. Closing a tab's
   * last pane closes the tab; closing the window's last pane closes the window.
   */
  async close(pane: Pane): Promise<void> {
    if (!this.tabOf(pane)) return;
    pane.note?.flush();
    if (pane.session !== undefined) this.clearMark(pane.session);
    this.remove(pane);
    if (this.allPanes().length === 0) await this.closeEmptyWindow();
    const terminal = await pane.ready;
    // The terminal stays on screen while its pane fades out.
    if (!prefersReducedMotion()) await new Promise((r) => setTimeout(r, EXIT_HOLD_MS));
    await terminal?.dispose();
  }

  /**
   * Focuses pane `index` of the shown tab (0-based, in grid order: left to right, top to bottom); does nothing when
   * the shown tab has no such pane.
   */
  focus(index: number): void {
    const tab = this.tab;
    const pane = tab.panes[index];
    if (!pane) return;
    // In Zen the pane that takes the focus is shown alone.
    tab.showAlone(pane);
    this.markFocused(tab, index);
    give(pane);
  }

  /** Gives the focused pane's terminal the keyboard again, e.g. after the settings dialogue closes. */
  focusCurrent(): void {
    const pane = this.current();
    if (pane) give(pane);
  }

  /** Restyles every open pane after the settings changed; `themeChanged` re-reads the theme colours too. */
  async applySettings(settings: Settings, themeChanged: boolean): Promise<void> {
    this.styleRoot(settings);
    for (const tab of this.tabs) {
      if ((tab.layout.mode ?? "grid") !== settings.tiling.layout) tab.relayout(setMode(tab.layout, settings.tiling.layout));
    }
    // Each pane keeps its zoom offset on top of the new font size.
    await Promise.all(
      this.allPanes().map(async (pane) => {
        const terminal = await pane.ready;
        if (!terminal) return;
        if (themeChanged) refreshTheme(terminal.term);
        await applyFont(terminal.term, settings, pane.zoom);
      }),
    );
    // A new font or Zen width changes the Zen pane's width.
    for (const tab of this.tabs) tab.sizeZen();
  }

  /** A `pane-cwd` report: updates the pane running that session, or keeps it until the pane hears its id. */
  private onCwd(place: PaneCwd): void {
    this.places.set(place.paneId, place);
    const pane = this.allPanes().find((p) => p.session === place.paneId);
    if (pane) this.showPlace(pane, place);
    this.scheduleSave();
  }

  /** A `pane-command` report: relabels the pane running that session once its place is known. */
  private onCommand(report: PaneCommand): void {
    this.commands.set(report.paneId, report.command);
    const pane = this.allPanes().find((p) => p.session === report.paneId);
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
    this.updateStrip();
  }

  /** Tells the app this window's name, its shown tab's focused pane's chip text, for other windows' Move to Window ▸. */
  private reportName(): void {
    const name = this.current()?.chip.textContent ?? "";
    if (!this.backend.moves || name === "" || name === this.reportedName) return;
    this.reportedName = name;
    this.backend.moves.setName(name).catch(() => undefined);
  }

  /**
   * Sets the window's title from the shown tab's focused pane's command: none for a Heynote pane or before one is
   * reported.
   */
  private showTitle(): void {
    const pane = this.current();
    const command = pane?.session === undefined ? undefined : this.commands.get(pane.session);
    const title = windowTitle(command);
    if (title === this.shownTitle) return;
    this.shownTitle = title;
    this.backend.setTitle(title).catch(() => undefined);
  }

  /** Takes `pane` out of its tab; a tab left empty closes, unless it is the window's last. */
  private remove(pane: Pane): void {
    const tab = this.tabOf(pane);
    if (!tab) return;
    if (pane.session !== undefined) this.forget(pane.session);
    // The tab's grid takes the pane's element out once it has faded out.
    const wasFocused = tab.remove(pane);
    const next = tab.current();
    if (tab.panes.length === 0) {
      if (this.tabs.length > 1) this.dropTab(tab);
      else this.showTitle();
    } else if (wasFocused && next) {
      tab.showAlone(next);
      this.markFocused(tab, tab.focused);
      if (tab.shown) give(next);
    }
  }

  /** Marks pane `index` as tab `tab`'s focused pane; in the shown tab the window's name and title follow it. */
  private markFocused(tab: Tab, index: number): void {
    if (index < 0) return;
    tab.markFocused(index);
    this.scheduleSave();
    if (tab.shown) {
      if (document.hasFocus()) this.clearCurrent();
      this.reportName();
      this.showTitle();
    }
    this.updateStrip();
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

  /**
   * `tiili attention` from the pane running `request.session`: its message marks the pane as a notification escape
   * code would (made safe, rate-limited, and not while the user looks at the pane), or `clear` takes its mark away.
   */
  attentionRequested(request: PaneAttentionRequest): void {
    const pane = this.allPanes().find((p) => p.session === request.session);
    if (!pane) return;
    if (request.clear) {
      this.clearMark(request.session);
      return;
    }
    const signal = requestedSignal(request.message ?? "");
    if (signal) this.onSignal(pane, signal);
  }

  /** `tiili close`: closes the pane running `session` as its close control would, without asking. */
  async closeRequested(session: SessionId): Promise<void> {
    const pane = this.allPanes().find((p) => p.session === session);
    if (!pane) throw new Error(`no pane runs session ${session} in this window`);
    await this.close(pane);
  }

  /** Shows `marks`, every marked session app-wide, on this window's panes and its background tabs. */
  private showMarks(marks: AttentionMark[]): void {
    this.marks = new Map(marks.map((mark) => [mark.session, mark]));
    for (const pane of this.allPanes()) {
      const mark = pane.session === undefined ? undefined : this.marks.get(pane.session);
      showPaneAttention(pane.element, pane.chip, mark);
    }
    for (const tab of this.tabs) tab.showZen();
    this.updateStrip();
  }

  /** Clears session `session`'s mark, if it has one; the app ignores a session without one. */
  private clearMark(session: number): void {
    // Asked even when no mark is known yet: one may be on its way from the app.
    this.marks.delete(session);
    this.backend.attention?.clear(session).catch(() => undefined);
  }

  /** The user looks at the focused pane: its mark clears. */
  private clearCurrent(): void {
    if (this.arriving) return;
    const session = this.current()?.session;
    if (session !== undefined) this.clearMark(session);
  }

  /**
   * Focuses the pane running session `session`, for the next-pane shortcut, showing its tab first; its mark clears.
   */
  private focusSession(session: number): void {
    const index = tabOf(
      this.tabs.map((tab) => tab.sessions()),
      session,
    );
    const tab = index === undefined ? undefined : this.tabs[index];
    const pane = tab?.panes.find((p) => p.session === session);
    if (index === undefined || !tab || !pane) return;
    if (index !== this.shown) this.showTab(index);
    this.focus(tab.panes.indexOf(pane));
    this.clearMark(session);
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

  /**
   * Tells the app this window's state now, after any report still in flight: every tab with its panes, the shown tab
   * active. A tab with no pane is left out.
   */
  private saveState(): Promise<void> {
    const session = this.backend.session;
    if (!session) return Promise.resolve();
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const next = this.saving.then(async () => {
      const keep = this.settings().behaviour.restoreScrollback;
      const tabs: SavedTab[] = [];
      let activeTab = 0;
      for (const tab of this.tabs) {
        const panes = await Promise.all(tab.panes.map((pane) => this.snapshot(pane)));
        const saved = snapshotWindow(tab.layout, panes, tab.current()?.id, keep).tabs[0];
        if (!saved) continue;
        if (tab === this.tab) activeTab = tabs.length;
        tabs.push({ ...saved, name: tab.name });
      }
      await session.update({ tabs, activeTab });
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
          this.allPanes().map(async (pane) => {
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

  /**
   * Toggles Zen for the shown tab's focused pane: it shows alone in the centre, or the grid shows again. With one pane
   * Zen does not apply. The pane keeps the keyboard.
   */
  toggleZen(): void {
    const pane = this.current();
    if (!pane) return;
    this.tab.toggleZen();
    give(pane);
  }

  /** Saves `columns` as the Zen width when it changed, which every window then uses. */
  private async saveZenColumns(columns: number): Promise<void> {
    if (columns === this.settings().zen.width) return;
    await this.saveZenWidth(columns);
  }

  /**
   * Tells the app the panes' sessions when their order changed, so `tiili list` follows the window: tab by tab in
   * strip order, in grid order inside each tab.
   */
  private reportOrder(): void {
    const control = this.backend.paneControl;
    if (!control) return;
    const tabs = this.tabs.map((tab) => tab.sessions());
    const order = JSON.stringify(tabs);
    if (order === this.reportedOrder) return;
    this.reportedOrder = order;
    control.setOrder(tabs).catch(() => undefined);
  }

  /** xterm's key hook: layout, tab, pane, settings, find and clipboard shortcuts are kept from the shell. */
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
      .then(() => requestAnimationFrame(() => this.tabOf(pane)?.sizeZen()))
      .catch((error: unknown) => this.report(error));
    this.scheduleSave();
  }

  /**
   * Carries out a layout, tab, next-pane, settings, Zen, pane, zoom or find shortcut on keydown. Returns true when
   * `event` is one of those keys, which then must not reach the pane's shell, its find bar's field or Heynote. Zoom and find
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
    const tab = tabAction(event, this.platform);
    if (tab) {
      // In the macOS app the ⇧⌘ and ⌃⇧⌘ tab keys come from the Shell menu, so here they are only kept from the shell;
      // Ctrl+Tab has no menu item, so the page carries it out.
      const viaMenu = this.viaMenu() && event.key !== "Tab";
      if (!viaMenu && event.type === "keydown") {
        event.preventDefault();
        this.actTab(tab);
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

  /**
   * Shows `error`: in the focused pane's terminal, else the first pane's that has one, else the console. Only
   * with no panes at all does it take the window's place.
   */
  private report(error: unknown): void {
    const panes = this.allPanes();
    if (panes.length === 0) {
      this.root.textContent = `tiili could not start the terminal: ${String(error)}`;
      return;
    }
    const term = this.current()?.terminal?.term ?? panes.find((pane) => pane.terminal)?.terminal?.term;
    if (term) term.write(`\r\n${String(error)}\r\n`);
    else console.error(error);
  }
}
