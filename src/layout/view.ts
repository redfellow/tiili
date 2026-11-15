import { resizeTrack, type Axis, type LayoutState, type PaneId } from "./model";
import { flipFrames, prefersReducedMotion, type Rect } from "./motion";

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
  /** Panes start moving to a new layout: terminals hold their size until `motionEnd`. */
  motionStart(): void;
  /** The panes are laid out in their new places, about to glide there: terminals take their final font and grid. */
  motionPlay(): Map<PaneId, number>;
  /** The panes have reached their new places: terminals refit once to their final size. */
  motionEnd(): void;
  /** The Zen pane's width in CSS pixels at the saved Zen width, for a pane area `areaWidth` wide. */
  zenWidth(areaWidth: number): number;
  /** `widthPx` kept between the Zen pane's narrowest and widest width for a pane area `areaWidth` wide. */
  zenClamp(widthPx: number, areaWidth: number): number;
  /** A Zen edge drag started: the Zen terminal holds its size until it ends. */
  zenResizeStart(): void;
  /** A Zen edge drag ended with the Zen pane `widthPx` wide: the terminal refits once and the width is saved. */
  zenResizeEnd(widthPx: number): void;
  /** Pane `from`'s grab strip was dropped on `under`, outside the grid; true when the drop was taken. */
  dropOutside?(from: PaneId, under: Element): boolean;
  /** A pane's grab strip moved over `under` outside the grid, or back over the grid or nothing (null). */
  dragOutside?(under: Element | null): void;
}

/** The pane id stored on each pane element. */
const PANE_ID = "paneId";

/** The width of the miniature that follows the pointer while a pane is dragged. */
const DRAG_PREVIEW_WIDTH = 200;

/** How long after a drag ends a double-click still counts as part of the drag. */
const DRAG_SETTLE_MS = 500;

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
  /** The pane animations now playing. */
  private running: Animation[] = [];
  /** Closing panes pinned at their last rect while they fade out. */
  private leaving: HTMLElement[] = [];
  /** Counts layout changes, so only the latest one's animations end the motion. */
  private generation = 0;
  /** True between `motionStart` and `motionEnd`. */
  private moving = false;
  /** The pane shown alone in the centre, or undefined when the grid shows. */
  private zen: PaneId | undefined;
  /** When the last drag that moved the pointer ended, for telling a double-click from a drag. */
  private draggedAt = -Infinity;
  /** True while a Zen edge is dragged, so a window resize doesn't undo the width being dragged. */
  private zenDragging = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly hooks: TileHooks,
  ) {
    root.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    if (typeof ResizeObserver === "function") new ResizeObserver(() => this.sizeZen()).observe(root);
  }

  /** True when a pane or edge drag ended a moment ago: a double-click then is part of the drag. */
  dragged(): boolean {
    return performance.now() - this.draggedAt < DRAG_SETTLE_MS;
  }

  /** Sizes the Zen pane again from the saved Zen width, e.g. after its font size or the setting changed. */
  sizeZen(): void {
    const box = this.zenBox();
    if (!box || this.zenDragging) return;
    this.placeZen(box, this.hooks.zenWidth(this.root.clientWidth));
  }

  /** Makes the Zen box `width` pixels wide, centred in the pane area. */
  private placeZen(box: HTMLElement, width: number): void {
    box.style.width = `${width}px`;
    box.style.left = `calc(50% - ${width / 2}px)`;
  }

  private zenBox(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(":scope > .pane-zen");
  }

  /**
   * Lays `state` out again, moving the pane elements into place. Panes that move glide from their old rect to the
   * new one, new panes grow in and panes no longer in `state` shrink and fade out, unless the OS asks for reduced
   * motion. A change while panes are still moving starts from where they are on screen.
   *
   * With `zen`, that pane shows alone in a centred box at the Zen width; the others stay laid out in the grid,
   * hidden, so their terminals keep running and keep their place and size.
   */
  render(state: LayoutState, zen?: PaneId): void {
    this.zen = zen !== undefined && state.order.includes(zen) ? zen : undefined;
    const animate = !prefersReducedMotion();
    // Measured before the running animations stop, so the panes start from where they are seen.
    const before = animate ? this.measure() : new Map<PaneId, Rect>();
    const elements = new Map<PaneId, HTMLElement>();
    this.panes().forEach((element) => elements.set(Number(element.dataset[PANE_ID]), element));
    this.stopMotion();
    if (!animate) {
      this.endMotion();
      this.layOut(state);
      return;
    }
    if (!this.moving) {
      this.moving = true;
      this.hooks.motionStart();
    }
    this.layOut(state);
    const fontRatios = this.hooks.motionPlay();
    const generation = ++this.generation;
    const rootRect = this.root.getBoundingClientRect();
    for (const [id, motion] of flipFrames(before, this.measure())) {
      if (motion.kind !== "exit") {
        const element = this.root.querySelector<HTMLElement>(`.pane[data-pane-id="${id}"]`);
        if (element) {
          const options = { duration: motion.duration, easing: motion.easing };
          this.running.push(element.animate(motion.frames, options));
          if (motion.kind === "move") this.running.push(...this.steadyContent(element, id, before, fontRatios, options));
        }
        continue;
      }
      const element = elements.get(id);
      const rect = before.get(id);
      if (!element || !rect) continue;
      // Kept at its last rect, above the other panes, until it has faded out.
      Object.assign(element.style, {
        position: "absolute",
        left: `${rect.left - rootRect.left}px`,
        top: `${rect.top - rootRect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        pointerEvents: "none",
      });
      // Above the panes that grow into its place, so the fade-out is seen.
      element.style.zIndex = "1";
      this.root.append(element);
      this.leaving.push(element);
      const animation = element.animate(motion.frames, { duration: motion.duration, easing: motion.easing, fill: "forwards" });
      animation.finished.then(() => this.unpin(element)).catch(() => undefined);
      this.running.push(animation);
    }
    Promise.all(this.running.map((animation) => animation.finished))
      .then(() => {
        if (generation === this.generation) this.endMotion();
      })
      .catch(() => undefined);
  }

  /**
   * Keeps a gliding pane's content from being stretched by the pane's own scale: the terminal and title scale
   * evenly instead, the terminal from its old font size to its new one, so the text grows or shrinks gradually.
   */
  private steadyContent(
    element: HTMLElement,
    id: PaneId,
    before: Map<PaneId, Rect>,
    fontRatios: Map<PaneId, number>,
    options: KeyframeAnimationOptions,
  ): Animation[] {
    const from = before.get(id);
    const to = element.getBoundingClientRect();
    if (!from || to.width <= 0 || to.height <= 0) return [];
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const animations: Animation[] = [];
    for (const [selector, uniform] of [
      [".pane-terminal", fontRatios.get(id) ?? 1],
      [".pane-title", 1],
    ] as const) {
      const child = element.querySelector<HTMLElement>(`:scope > ${selector}`);
      if (!child) continue;
      animations.push(
        child.animate(
          [
            { transformOrigin: "0 0", transform: `scale(${uniform / sx}, ${uniform / sy})` },
            { transformOrigin: "0 0", transform: "none" },
          ],
          options,
        ),
      );
    }
    return animations;
  }

  /** The pane elements laid out in the grid or the Zen box, without the ones fading out. */
  private panes(): HTMLElement[] {
    return Array.from(
      this.root.querySelectorAll<HTMLElement>(":scope > .pane-row > .pane, :scope > .pane-zen > .pane"),
    );
  }

  /** Each laid-out pane's rect on screen, by pane id. */
  private measure(): Map<PaneId, Rect> {
    const rects = new Map<PaneId, Rect>();
    for (const element of this.panes()) {
      const { left, top, width, height } = element.getBoundingClientRect();
      rects.set(Number(element.dataset[PANE_ID]), { left, top, width, height });
    }
    return rects;
  }

  /** Stops the animations playing and drops the panes still fading out. */
  private stopMotion(): void {
    const running = this.running;
    this.running = [];
    running.forEach((animation) => animation.cancel());
    this.leaving.forEach((element) => this.unpin(element));
  }

  /** Takes a faded-out pane out of the view and clears its pinning. */
  private unpin(element: HTMLElement): void {
    this.leaving = this.leaving.filter((e) => e !== element);
    element.remove();
    for (const property of ["position", "left", "top", "width", "height", "pointer-events", "z-index"]) {
      element.style.removeProperty(property);
    }
  }

  /** The panes are at rest: terminals may refit. */
  private endMotion(): void {
    if (!this.moving) return;
    this.moving = false;
    this.hooks.motionEnd();
  }

  /**
   * Builds the rows, panes and dividers for `state`. In Zen the Zen pane goes into a centred box with an edge handle
   * on each side and a placeholder keeps its grid slot; the other panes are hidden in place and there are no dividers.
   */
  private layOut(state: LayoutState): void {
    this.state = state;
    const zen = this.zen;
    let zenElement: HTMLElement | undefined;
    const rows = Array.from({ length: state.rows }, (_, r) => {
      const row = document.createElement("div");
      row.className = "pane-row";
      const ids = state.order.slice(r * state.cols, (r + 1) * state.cols);
      row.append(
        ...ids.map((id) => {
          const element = this.hooks.element(id);
          element.dataset[PANE_ID] = String(id);
          element.toggleAttribute("data-zen-hidden", zen !== undefined && id !== zen);
          if (id !== zen) return element;
          zenElement = element;
          const placeholder = document.createElement("div");
          placeholder.className = "pane-placeholder";
          return placeholder;
        }),
      );
      return row;
    });
    this.root.toggleAttribute("data-zen", zenElement !== undefined);
    if (zenElement) {
      zenElement.style.flexGrow = "1";
      const box = document.createElement("div");
      box.className = "pane-zen";
      box.append(this.zenEdge("left"), zenElement, this.zenEdge("right"));
      this.placeZen(box, this.hooks.zenWidth(this.root.clientWidth));
      this.root.replaceChildren(...rows, box);
    } else {
      const dividers: HTMLElement[] = [];
      for (let i = 0; i + 1 < state.cols; i++) dividers.push(this.divider("col", i));
      for (let i = 0; i + 1 < state.rows; i++) dividers.push(this.divider("row", i));
      this.root.replaceChildren(...rows, ...dividers);
    }
    this.applySizes(state);
  }

  private zenEdge(side: "left" | "right"): HTMLElement {
    const edge = document.createElement("div");
    edge.className = `pane-zen-edge pane-zen-edge-${side}`;
    edge.dataset.side = side;
    return edge;
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
    const edge = event.target.closest<HTMLElement>(".pane-zen-edge");
    if (edge) {
      this.dragZenEdge(edge, event);
      return;
    }
    // Panes can't be dragged onto each other while one is shown alone.
    if (this.zen !== undefined) return;
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
      if (current !== start) this.draggedAt = performance.now();
      this.hooks.resizeEnd(start, current);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onEnd);
    divider.addEventListener("pointercancel", onEnd);
  }

  /**
   * Widens or narrows the Zen pane as an edge is dragged, both edges moving alike so it stays centred, between its
   * narrowest and widest width; the terminal holds its size until the edge is let go, then the width is saved.
   */
  private dragZenEdge(edge: HTMLElement, down: PointerEvent): void {
    const box = this.zenBox();
    if (!box) return;
    down.preventDefault();
    const outward = edge.dataset.side === "left" ? -1 : 1;
    // The width it is set to, not its rect, which a glide still playing scales.
    const start = parseFloat(box.style.width) || box.getBoundingClientRect().width;
    const area = this.root.clientWidth;
    let width = start;
    edge.setPointerCapture(down.pointerId);
    edge.toggleAttribute("data-dragging", true);
    this.zenDragging = true;
    this.hooks.zenResizeStart();

    const onMove = (event: PointerEvent) => {
      width = this.hooks.zenClamp(start + 2 * outward * (event.clientX - down.clientX), area);
      this.placeZen(box, width);
    };
    const onEnd = () => {
      edge.removeEventListener("pointermove", onMove);
      edge.removeEventListener("pointerup", onEnd);
      edge.removeEventListener("pointercancel", onEnd);
      edge.toggleAttribute("data-dragging", false);
      this.zenDragging = false;
      if (width !== start) this.draggedAt = performance.now();
      this.hooks.zenResizeEnd(width);
    };
    edge.addEventListener("pointermove", onMove);
    edge.addEventListener("pointerup", onEnd);
    edge.addEventListener("pointercancel", onEnd);
  }

  /** A miniature of `pane` as it looks now: a scaled-down copy of its elements, kept from taking part in the page. */
  private dragPreview(pane: HTMLElement): HTMLElement {
    const { width, height } = pane.getBoundingClientRect();
    const scale = Math.min(1, DRAG_PREVIEW_WIDTH / Math.max(width, 1));
    const ghost = document.createElement("div");
    ghost.className = "pane-drag-ghost";
    ghost.style.width = `${width * scale}px`;
    ghost.style.height = `${height * scale}px`;
    const copy = pane.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-drag-source");
    copy.removeAttribute("data-drop-target");
    copy.querySelectorAll("textarea, .pane-grab, .find-bar-frame").forEach((e) => e.remove());
    Object.assign(copy.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${width}px`,
      height: `${height}px`,
      flex: "none",
      transformOrigin: "0 0",
      transform: `scale(${scale})`,
    });
    ghost.append(copy);
    return ghost;
  }

  /**
   * While a grab strip is dragged, shows a miniature of the pane following the pointer with the source pane dimmed,
   * so the drag is visible from the first pixels; highlights the pane under the pointer and swaps with it on drop.
   */
  private dragPane(grab: HTMLElement, source: HTMLElement, down: PointerEvent): void {
    const from = Number(source.dataset[PANE_ID]);
    let target: HTMLElement | undefined;
    let ghost: HTMLElement | undefined;
    /** The element under the pointer outside the grid, where the window may take the pane. */
    let outside: Element | undefined;
    grab.setPointerCapture(down.pointerId);

    const mark = (pane: HTMLElement | undefined) => {
      if (pane === target) return;
      target?.toggleAttribute("data-drop-target", false);
      target = pane;
      target?.toggleAttribute("data-drop-target", true);
    };
    /** The drag has begun once the pointer has moved a few pixels: until then a click is just a click. */
    const begin = () => {
      ghost = this.dragPreview(source);
      document.body.append(ghost);
      source.toggleAttribute("data-drag-source", true);
      document.documentElement.toggleAttribute("data-pane-dragging", true);
    };
    const onMove = (event: PointerEvent) => {
      if (!ghost && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > 3) begin();
      if (ghost) ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
      const point = document.elementFromPoint(event.clientX, event.clientY);
      const under = point?.closest<HTMLElement>(".pane");
      mark(under && under !== source && this.root.contains(under) ? under : undefined);
      outside = ghost && point && !this.root.contains(point) ? point : undefined;
      this.hooks.dragOutside?.(outside ?? null);
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
      if (outside) this.hooks.dragOutside?.(null);
      if (ghost) this.draggedAt = performance.now();
      if (drop && to !== undefined) this.hooks.swap(from, to);
      else if (drop && outside) this.hooks.dropOutside?.(from, outside);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    grab.addEventListener("pointermove", onMove);
    grab.addEventListener("pointerup", onUp);
    grab.addEventListener("pointercancel", onCancel);
  }
}
