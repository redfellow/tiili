import type { AttentionGate } from "./attention";
import type { HeynoteFrame } from "./heynotePane";
import type { TilingMode } from "./layout";
import { addPane, changedPanes, emptyLayout, removePane, swap, type LayoutState, type PaneId } from "./layout/model";
import { TileView } from "./layout/view";
import type { PaneTerminal } from "./terminal";

/** A pane can't be resized below this many columns and rows of its terminal. */
const MIN_COLS = 20;
const MIN_ROWS = 4;
/** Cell size used for the minimum before any terminal has been laid out. */
const FALLBACK_CELL = { width: 8, height: 17 };

/** One pane: its element in the grid and, once its shell has started, its terminal. */
export interface Pane {
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
  /** Merges and rate-limits the bells and notifications of a terminal pane's shell. */
  gate?: AttentionGate;
  /** The name `tiili open --title` gave the pane, which its chip shows instead of its place. */
  title?: string;
}

/** Gives pane `pane`'s terminal or Heynote the keyboard. */
export function give(pane: Pane): void {
  if (pane.note) pane.note.focus();
  else pane.terminal?.term.focus();
}

/** What a tab asks of its window. */
export interface TabHooks {
  /** The tab's grid was laid out again: its panes or their order may have changed. */
  rendered(tab: Tab): void;
  /** Pane `from`'s grab strip was dropped on `under`, outside this tab's grid; true when the window took the pane. */
  dropOutside(tab: Tab, from: PaneId, under: Element): boolean;
  /** Pane `from`'s grab strip is over `under` (null when over nothing), outside this tab's grid. */
  dragOutside(under: Element | null): void;
}

/**
 * One tab of a window: its panes in grid order, tiled by its own layout into its own container under the window's
 * panes area, and its focused pane. A hidden tab's container is not displayed and its terminals hold their size, so
 * their shells keep running at the size they had; showing the tab refits each once.
 */
export class Tab {
  /** Always in the order of `layout.order`. */
  panes: Pane[] = [];
  layout: LayoutState;
  focused = -1;
  /** The lasting name the user gave the tab; its label follows the focused pane's chip without one. */
  name: string | undefined;
  readonly container: HTMLElement;
  private readonly view: TileView;
  private hidden = false;

  constructor(
    parent: HTMLElement,
    mode: TilingMode,
    private readonly hooks: TabHooks,
  ) {
    this.container = document.createElement("div");
    this.container.className = "pane-tab";
    parent.append(this.container);
    this.layout = emptyLayout(mode);
    this.view = new TileView(this.container, {
      element: (id) => this.byId(id)?.element ?? document.createElement("div"),
      minSize: () => this.minSize(),
      resizeStart: () => this.panes.forEach((pane) => pane.terminal?.holdSize()),
      resizeEnd: (before, after) => {
        this.layout = after;
        const changed = new Set(changedPanes(before, after));
        this.panes.forEach((pane) => pane.terminal?.releaseSize(changed.has(pane.id)));
      },
      swap: (from, to) => this.relayout(swap(this.layout, from, to)),
      // Terminals scale with their moving panes and refit once they are in place, so each shell sees one size change.
      motionStart: () => this.panes.forEach((pane) => pane.terminal?.holdSize()),
      // Terminals take their final font and grid up front, so the glide scales the text gradually instead of
      // snapping it to a new size at the end. A hidden tab's terminals keep their size until it is shown.
      motionPlay: () =>
        this.hidden
          ? new Map()
          : new Map(this.panes.flatMap((pane) => (pane.terminal ? [[pane.id, pane.terminal.refitNow()] as const] : []))),
      motionEnd: () => {
        if (!this.hidden) this.panes.forEach((pane) => pane.terminal?.releaseSize(true));
      },
      dropOutside: (from, under) => this.hooks.dropOutside(this, from, under),
      dragOutside: (under) => this.hooks.dragOutside(under),
    });
  }

  /** Whether the tab is shown in its window. */
  get shown(): boolean {
    return !this.hidden;
  }

  current(): Pane | undefined {
    return this.panes[this.focused];
  }

  byId(id: PaneId): Pane | undefined {
    return this.panes.find((pane) => pane.id === id);
  }

  /** The sessions of the tab's panes in grid order. */
  sessions(): number[] {
    return this.panes.flatMap((pane) => (pane.session === undefined ? [] : [pane.session]));
  }

  /** Takes `layout` on, keeping focus on the pane that had it. */
  relayout(layout: LayoutState): void {
    const focused = this.current();
    const hadKeyboard = focused !== undefined && focused.element.contains(document.activeElement);
    this.layout = layout;
    this.panes = layout.order.map((id) => this.byId(id)).filter((pane): pane is Pane => pane !== undefined);
    this.render();
    if (focused) {
      this.markFocused(this.panes.indexOf(focused));
      // Moving the pane's element in the DOM takes the keyboard from its terminal.
      if (hadKeyboard) give(focused);
    }
  }

  /** Adds `pane` last in the grid; a pane added to a hidden tab holds its size until the tab is shown. */
  add(pane: Pane): void {
    this.panes.push(pane);
    this.layout = addPane(this.layout, pane.id);
    this.render();
    if (this.hidden) pane.terminal?.holdSize();
  }

  /**
   * Takes `pane` out of the grid; its element leaves once it has faded out, unless it is in another tab's grid by
   * then. Focus moves to the pane that takes its place, else the one before. Returns whether `pane` had the focus.
   */
  remove(pane: Pane): boolean {
    const index = this.panes.indexOf(pane);
    if (index < 0) return false;
    const wasFocused = index === this.focused;
    this.panes.splice(index, 1);
    this.layout = removePane(this.layout, pane.id);
    this.render();
    if (this.panes.length === 0) this.focused = -1;
    else if (wasFocused) this.markFocused(Math.min(index, this.panes.length - 1));
    else if (index < this.focused) this.markFocused(this.focused - 1);
    return wasFocused;
  }

  /** Marks pane `index` as the tab's focused pane. */
  markFocused(index: number): void {
    if (index < 0) return;
    this.focused = index;
    this.panes.forEach((pane, i) => {
      pane.element.toggleAttribute("data-focused", i === index);
    });
  }

  /** Hides the tab: its terminals keep their size, so their shells never see the hidden container's. */
  hide(): void {
    if (this.hidden) return;
    this.hidden = true;
    this.panes.forEach((pane) => pane.terminal?.holdSize());
    this.container.hidden = true;
  }

  /** Shows the tab: each terminal refits once to its pane. */
  show(): void {
    if (!this.hidden) return;
    this.hidden = false;
    this.container.hidden = false;
    this.panes.forEach((pane) => pane.terminal?.releaseSize(true));
  }

  /** Takes the tab out of its window. */
  dispose(): void {
    this.container.remove();
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

  private render(): void {
    this.view.render(this.layout);
    this.hooks.rendered(this);
  }
}
