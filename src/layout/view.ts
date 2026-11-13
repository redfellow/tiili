import { resizeTrack, type Axis, type LayoutState, type PaneId } from "./model";

/** What the view asks of the panes it lays out. */
export interface TileHooks {
  /** The element of pane `id`; it carries a `.pane-grab` strip on its top edge. */
  element(id: PaneId): HTMLElement;
  /** The smallest size in CSS pixels a pane may be resized to. */
  minSize(): { width: number; height: number };
  /** A divider drag started: terminals hold their size until it ends. */
  resizeStart(): void;
  /** A divider drag ended, going from `before` to `after`. */
  resizeEnd(before: LayoutState, after: LayoutState): void;
  /** Pane `from`'s grab strip was dropped on pane `to`. */
  swap(from: PaneId, to: PaneId): void;
}

/** The pane id stored on each pane element. */
const PANE_ID = "paneId";

function sum(sizes: number[], count: number): number {
  return sizes.slice(0, count).reduce((total, s) => total + s, 0);
}

/**
 * Where a divider sits along its axis: after `before` of `count` tracks whose fractions add up to `fraction`,
 * with the panes' gap between tracks.
 */
function trackEdge(fraction: number, before: number, count: number): string {
  return `calc(${fraction} * (100% - ${count - 1} * var(--pane-gap)) + ${before} * var(--pane-gap))`;
}

/**
 * Renders a layout into `root`: one flex row per grid row, rows and the panes of full rows grown by their
 * track fractions, and divider hit areas over the gaps between tracks. Dragging a divider resizes its two
 * tracks live; dragging a pane's grab strip onto another pane swaps them.
 */
export class TileView {
  private state: LayoutState | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly hooks: TileHooks,
  ) {
    root.addEventListener("pointerdown", (event) => this.onPointerDown(event));
  }

  /** Lays `state` out again, moving the pane elements into place. */
  render(state: LayoutState): void {
    this.state = state;
    const rows = Array.from({ length: state.rows }, (_, r) => {
      const row = document.createElement("div");
      row.className = "pane-row";
      const ids = state.order.slice(r * state.cols, (r + 1) * state.cols);
      row.append(
        ...ids.map((id) => {
          const element = this.hooks.element(id);
          element.dataset[PANE_ID] = String(id);
          return element;
        }),
      );
      return row;
    });
    const dividers: HTMLElement[] = [];
    for (let i = 0; i + 1 < state.cols; i++) dividers.push(this.divider("col", i));
    for (let i = 0; i + 1 < state.rows; i++) dividers.push(this.divider("row", i));
    this.root.replaceChildren(...rows, ...dividers);
    this.applySizes(state);
  }

  private divider(axis: Axis, index: number): HTMLElement {
    const divider = document.createElement("div");
    divider.className = `pane-divider pane-divider-${axis}`;
    divider.dataset.axis = axis;
    divider.dataset.index = String(index);
    return divider;
  }

  /** Sets track sizes and divider positions for `state` without rebuilding the DOM. */
  private applySizes(state: LayoutState): void {
    const rows = this.root.querySelectorAll<HTMLElement>(":scope > .pane-row");
    const fullRows = state.order.length % state.cols === 0 ? state.rows : state.rows - 1;
    rows.forEach((row, r) => {
      row.style.flexGrow = String(state.rowSizes[r]);
      const panes = Array.from(row.children) as HTMLElement[];
      panes.forEach((pane, c) => {
        // The panes of a short last row share its width equally.
        pane.style.flexGrow = String(r < fullRows ? state.colSizes[c] : 1);
      });
    });
    this.root.querySelectorAll<HTMLElement>(":scope > .pane-divider").forEach((divider) => {
      const index = Number(divider.dataset.index);
      if (divider.dataset.axis === "col") {
        divider.style.left = trackEdge(sum(state.colSizes, index + 1), index, state.cols);
        // Column dividers run down the full rows only.
        divider.style.height =
          fullRows === state.rows ? "100%" : trackEdge(sum(state.rowSizes, fullRows), fullRows - 1, state.rows);
      } else {
        divider.style.top = trackEdge(sum(state.rowSizes, index + 1), index, state.rows);
      }
    });
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !(event.target instanceof HTMLElement)) return;
    const divider = event.target.closest<HTMLElement>(".pane-divider");
    if (divider) {
      this.dragDivider(divider, event);
      return;
    }
    const grab = event.target.closest<HTMLElement>(".pane-grab");
    const pane = grab?.closest<HTMLElement>(".pane");
    if (grab && pane) this.dragPane(grab, pane, event);
  }

  /** Resizes the divider's two tracks as the pointer moves; the terminals refit once it is let go. */
  private dragDivider(divider: HTMLElement, down: PointerEvent): void {
    const start = this.state;
    if (!start) return;
    down.preventDefault();
    const axis = divider.dataset.axis as Axis;
    const index = Number(divider.dataset.index);
    const count = axis === "col" ? start.cols : start.rows;
    const style = getComputedStyle(this.root);
    const gap = parseFloat(axis === "col" ? style.columnGap : style.rowGap) || 0;
    const rect = this.root.getBoundingClientRect();
    const space = (axis === "col" ? rect.width : rect.height) - (count - 1) * gap;
    if (space <= 0) return;
    const minSize = this.hooks.minSize();
    const min = (axis === "col" ? minSize.width : minSize.height) / space;
    const origin = axis === "col" ? down.clientX : down.clientY;

    let current = start;
    divider.setPointerCapture(down.pointerId);
    divider.toggleAttribute("data-dragging", true);
    this.hooks.resizeStart();

    const onMove = (event: PointerEvent) => {
      const delta = ((axis === "col" ? event.clientX : event.clientY) - origin) / space;
      current = resizeTrack(start, axis, index, delta, min);
      this.state = current;
      this.applySizes(current);
    };
    const onEnd = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onEnd);
      divider.removeEventListener("pointercancel", onEnd);
      divider.toggleAttribute("data-dragging", false);
      this.hooks.resizeEnd(start, current);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onEnd);
    divider.addEventListener("pointercancel", onEnd);
  }

  /**
   * While a grab strip is dragged, shows a ghost label following the pointer with the source pane dimmed, so the
   * drag is visible from the first pixels; highlights the pane under the pointer and swaps with it on drop.
   */
  private dragPane(grab: HTMLElement, source: HTMLElement, down: PointerEvent): void {
    const from = Number(source.dataset[PANE_ID]);
    let target: HTMLElement | undefined;
    let ghost: HTMLElement | undefined;
    grab.setPointerCapture(down.pointerId);

    const mark = (pane: HTMLElement | undefined) => {
      if (pane === target) return;
      target?.toggleAttribute("data-drop-target", false);
      target = pane;
      target?.toggleAttribute("data-drop-target", true);
    };
    /** The drag has begun once the pointer has moved a few pixels: until then a click is just a click. */
    const begin = () => {
      ghost = document.createElement("div");
      ghost.className = "pane-drag-ghost";
      ghost.textContent = source.querySelector(".pane-chip")?.textContent?.trim() || "Terminal";
      document.body.append(ghost);
      source.toggleAttribute("data-drag-source", true);
      document.documentElement.toggleAttribute("data-pane-dragging", true);
    };
    const onMove = (event: PointerEvent) => {
      if (!ghost && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > 3) begin();
      if (ghost) ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
      const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".pane");
      mark(under && under !== source && this.root.contains(under) ? under : undefined);
    };
    const finish = (drop: boolean) => {
      grab.removeEventListener("pointermove", onMove);
      grab.removeEventListener("pointerup", onUp);
      grab.removeEventListener("pointercancel", onCancel);
      const to = target ? Number(target.dataset[PANE_ID]) : undefined;
      mark(undefined);
      ghost?.remove();
      source.toggleAttribute("data-drag-source", false);
      document.documentElement.toggleAttribute("data-pane-dragging", false);
      if (drop && to !== undefined) this.hooks.swap(from, to);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    grab.addEventListener("pointermove", onMove);
    grab.addEventListener("pointerup", onUp);
    grab.addEventListener("pointercancel", onCancel);
  }
}
