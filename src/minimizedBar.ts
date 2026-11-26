import type { MenuItem } from "./backend";
import { showContextMenu } from "./context-menu";
import { fitBadges, titlePlacement, type BadgeState } from "./minimized";

/** One minimized pane's badge. */
export interface BadgeEntry {
  /** The pane's id. */
  id: number;
  /** The command the pane runs, else its chip text; `was running: <command>` for one session restore brought back. */
  label: string;
  /** The pane's repository tint; undefined untinted. */
  tint?: number;
  state: BadgeState;
}

/** What the peek shows of a minimized pane, lent to it while it is open. */
export interface PeekSource {
  command: string;
  /** The pane's repository, or its folder outside one. */
  repository: string;
  /** When the pane's shell started, in epoch milliseconds. */
  since: number;
  /** The pane's terminal host element, shown scaled in the peek and handed back by `done`. */
  host: HTMLElement;
  /** The host's size in the pane, which the peek keeps so the terminal's PTY size does not change. */
  width: number;
  height: number;
  /** The peek closed: the host goes back to its pane, and the focused pane takes the keyboard again. */
  done: () => void;
}

/** What the badges ask of their window. */
export interface BadgeHooks {
  /** Restores pane `id` in its tab, with the focus. */
  restore: (id: number) => void;
  /** The right-click menu of pane `id`'s badge. */
  menu: (id: number) => Promise<MenuItem[]>;
  /** Lends pane `id`'s terminal to the peek; undefined when it has none to show. */
  peek: (id: number) => PeekSource | undefined;
}

/** The window's minimized-pane badges in its top bar. */
export interface MinimizedBar {
  /** Shows `entries`, one badge each, in the order they were minimized. */
  update: (entries: BadgeEntry[]) => void;
  /** Output arrived for pane `id`: its swatch pulses until output has stopped for a while. */
  active: (id: number) => void;
  /** Opens pane `id`'s peek, held open as if the user had clicked into it. */
  peek: (id: number) => void;
}

/** The parts of the top bar the badges sit among. */
export interface BadgeBarParts {
  bar: HTMLElement;
  strip: HTMLElement;
  /** The right-hand buttons. */
  actions: HTMLElement;
  /** The macOS overlay bar's centred title, which moves out of the badges' way. */
  title?: HTMLElement;
}

/** How long after the last output a badge stops pulsing, in milliseconds. */
const ACTIVE_MS = 1500;
/** How long the pointer rests on a badge before its peek opens, in milliseconds. */
const HOVER_MS = 300;
/** How long a touch or pen press on a badge lasts before its peek opens, in milliseconds. */
const LONG_PRESS_MS = 500;
/** How long the pointer may be off both the badge and its peek before the peek closes, in milliseconds. */
const LEAVE_MS = 200;
/** The space kept clear on each side of the title, in pixels. */
const TITLE_MARGIN = 8;
/** The gap between badges, in pixels; matches the stylesheet's. */
const GAP = 2;
/** The widest a peek's terminal is shown, in pixels. */
const PEEK_WIDTH = 560;

/** How long a pane has run, from `ms` milliseconds: `<1m`, `5m`, `2h 5m` or `3d 2h`. */
function uptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/**
 * The badges in `container`, which sits in the top bar after the tab strip: one per minimized pane, those that do not
 * fit collapsed into a `+N` badge listing them. Clicking a badge restores its pane, right-clicking opens its menu,
 * and resting the pointer on it (or a long press) opens its peek. On the macOS overlay bar the title moves out of the
 * badges' and tabs' way, and hides when there is no room for it.
 */
export function createMinimizedBar(container: HTMLElement, parts: BadgeBarParts, hooks: BadgeHooks): MinimizedBar {
  container.className = "top-bar-badges";
  container.setAttribute("data-tauri-drag-region", "");
  let entries: BadgeEntry[] = [];
  let shownKey = "";
  const badges = new Map<number, HTMLElement>();
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "top-bar-badge top-bar-badge-more";
  plus.tabIndex = -1;
  plus.hidden = true;
  plus.addEventListener("mousedown", (event) => event.preventDefault());
  plus.addEventListener("click", () => openList());

  // The pulse: when each pane's output last arrived, and which badges show it.
  const lastOutput = new Map<number, number>();
  const pulsing = new Set<number>();
  let pulseFrame = 0;
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  const showPulse = () => {
    pulseFrame = 0;
    for (const [id, badge] of badges) badge.toggleAttribute("data-active", pulsing.has(id));
  };
  const schedulePulse = () => {
    pulseFrame ||= requestAnimationFrame(showPulse);
  };
  const expirePulse = () => {
    pulseTimer = undefined;
    const now = Date.now();
    for (const id of [...pulsing]) {
      if (now - (lastOutput.get(id) ?? 0) >= ACTIVE_MS) {
        pulsing.delete(id);
        lastOutput.delete(id);
      }
    }
    schedulePulse();
    if (pulsing.size > 0) pulseTimer = setTimeout(expirePulse, ACTIVE_MS / 3);
  };

  const badgeElement = (entry: BadgeEntry, inList: boolean): HTMLElement => {
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "top-bar-badge";
    badge.tabIndex = -1;
    badge.dataset.state = entry.state.kind;
    badge.setAttribute("aria-label", `Restore ${entry.label}`);
    if (entry.tint !== undefined) badge.style.setProperty("--badge-tint", `var(--tint-${entry.tint})`);
    const swatch = document.createElement("span");
    swatch.className = entry.state.kind === "needs-you" ? "pane-chip-brick" : "top-bar-badge-swatch";
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "top-bar-badge-label";
    label.textContent = entry.label;
    badge.append(swatch, label);
    if (entry.state.kind === "exited") {
      const code = document.createElement("span");
      code.className = "top-bar-badge-code";
      code.textContent = String(entry.state.code);
      badge.append(code);
    }
    badge.toggleAttribute("data-active", pulsing.has(entry.id));
    // Not a keyboard target: the terminal keeps the keyboard, and clicks leave its focus alone.
    badge.addEventListener("mousedown", (event) => event.preventDefault());
    badge.addEventListener("click", () => {
      if (pressed === entry.id) {
        pressed = undefined;
        return;
      }
      closeList();
      closePeek();
      hooks.restore(entry.id);
    });
    badge.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      cancelHover();
      hooks
        .menu(entry.id)
        .then((items) => showContextMenu(items, event.clientX, event.clientY))
        .catch(() => undefined);
    });
    if (!inList) listenForPeek(badge, entry.id);
    return badge;
  };

  // Fits the badges in the free space, then moves the title out of their way.
  let layoutFrame = 0;
  const scheduleLayout = () => {
    layoutFrame ||= requestAnimationFrame(layout);
  };
  const layout = () => {
    layoutFrame = 0;
    const list = [...badges.values()];
    list.forEach((badge) => (badge.hidden = false));
    plus.hidden = true;
    if (list.length > 0) {
      const widths = list.map((badge) => badge.offsetWidth + GAP);
      plus.textContent = `+${list.length}`;
      plus.hidden = false;
      const plusWidth = plus.offsetWidth + GAP;
      const { shown, hidden } = fitBadges(widths, container.clientWidth + GAP, plusWidth);
      list.forEach((badge, index) => (badge.hidden = index >= shown));
      plus.hidden = hidden === 0;
      plus.textContent = `+${hidden}`;
      plus.setAttribute("aria-label", `${hidden} more minimized panes`);
    }
    placeTitle();
  };

  const placeTitle = () => {
    const { title } = parts;
    if (!title) return;
    const bar = parts.bar.getBoundingClientRect();
    const visible = [...container.children].filter((child) => !(child as HTMLElement).hidden);
    const last = visible[visible.length - 1];
    const strip = parts.strip.hidden ? undefined : parts.strip.getBoundingClientRect();
    const start = container.getBoundingClientRect().left;
    const end = Math.max(strip?.right ?? start, last?.getBoundingClientRect().right ?? start) - bar.left;
    const actions = parts.actions.getBoundingClientRect().left - bar.left;
    const width = title.offsetWidth + 2 * TITLE_MARGIN;
    const place = titlePlacement(bar.width, width, end, actions);
    title.style.visibility = place.kind === "hidden" ? "hidden" : "";
    title.style.transform = place.kind === "slid" ? `translateX(calc(-50% + ${place.x}px))` : "";
  };

  const observer = new ResizeObserver(scheduleLayout);
  observer.observe(parts.bar);
  observer.observe(container);
  observer.observe(parts.strip);
  observer.observe(parts.actions);

  // The +N list: the badges that did not fit, which restore and right-click as the badges do.
  let list: HTMLElement | undefined;
  const closeList = () => {
    list?.remove();
    list = undefined;
    document.removeEventListener("mousedown", onListOutside, true);
    document.removeEventListener("keydown", onListKey, true);
  };
  const onListOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!list?.contains(target) && !plus.contains(target)) closeList();
  };
  const onListKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeList();
  };
  const openList = () => {
    if (list) {
      closeList();
      return;
    }
    const overflow = entries.filter((entry) => badges.get(entry.id)?.hidden);
    if (overflow.length === 0) return;
    list = document.createElement("div");
    list.className = "top-bar-badge-list";
    list.setAttribute("role", "menu");
    list.append(...overflow.map((entry) => badgeElement(entry, true)));
    document.body.append(list);
    const at = plus.getBoundingClientRect();
    const { width } = list.getBoundingClientRect();
    list.style.top = `${at.bottom + 4}px`;
    list.style.left = `${Math.max(0, Math.min(at.left, window.innerWidth - width - 4))}px`;
    document.addEventListener("mousedown", onListOutside, true);
    document.addEventListener("keydown", onListKey, true);
  };

  // The peek: a popover under the bar lending the pane's terminal, scaled to fit.
  let peek: { id: number; element: HTMLElement; source: PeekSource; held: boolean } | undefined;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let uptimeTimer: ReturnType<typeof setInterval> | undefined;
  /** The badge a long press just opened a peek on, whose click then restores nothing. */
  let pressed: number | undefined;

  const cancelHover = () => {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
  };
  const stayOpen = () => {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  };
  const leaveSoon = () => {
    cancelHover();
    if (!peek || peek.held) return;
    stayOpen();
    leaveTimer = setTimeout(closePeek, LEAVE_MS);
  };

  const onPeekOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (peek && !peek.element.contains(target) && !badges.get(peek.id)?.contains(target)) closePeek();
  };
  // Escape closes the peek before the terminal hears it.
  const onPeekKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePeek();
  };

  const closePeek = () => {
    cancelHover();
    stayOpen();
    clearInterval(uptimeTimer);
    if (!peek) return;
    const { element, source } = peek;
    peek = undefined;
    document.removeEventListener("mousedown", onPeekOutside, true);
    window.removeEventListener("keydown", onPeekKey, true);
    source.host.style.width = "";
    source.host.style.height = "";
    source.host.style.transform = "";
    element.remove();
    source.done();
  };

  const openPeek = (id: number, held: boolean) => {
    cancelHover();
    stayOpen();
    if (peek?.id === id) {
      peek.held ||= held;
      return;
    }
    closePeek();
    closeList();
    const source = hooks.peek(id);
    if (!source) return;
    const element = document.createElement("div");
    element.className = "top-bar-peek";
    const info = document.createElement("div");
    info.className = "top-bar-peek-info";
    const command = document.createElement("span");
    command.className = "top-bar-peek-command";
    command.textContent = source.command;
    const repository = document.createElement("span");
    repository.textContent = source.repository;
    const up = document.createElement("span");
    const showUptime = () => (up.textContent = `up ${uptime(Date.now() - source.since)}`);
    showUptime();
    uptimeTimer = setInterval(showUptime, 30_000);
    info.append(command, repository, up);
    // The terminal keeps its size in the pane, so its PTY does not change; it is only drawn smaller.
    const width = Math.max(1, source.width);
    const height = Math.max(1, source.height);
    const scale = Math.min(1, Math.min(PEEK_WIDTH, window.innerWidth - 16) / width);
    const frame = document.createElement("div");
    frame.className = "top-bar-peek-frame";
    frame.style.width = `${width * scale}px`;
    frame.style.height = `${height * scale}px`;
    source.host.style.width = `${width}px`;
    source.host.style.height = `${height}px`;
    source.host.style.transform = `scale(${scale})`;
    frame.append(source.host);
    element.append(info, frame);
    element.addEventListener("pointerenter", stayOpen);
    element.addEventListener("pointerleave", leaveSoon);
    // Clicking in keeps the peek open and gives its terminal the keyboard.
    element.addEventListener("pointerdown", () => {
      if (peek) peek.held = true;
    });
    document.body.append(element);
    const bar = parts.bar.getBoundingClientRect();
    const at = badges.get(id)?.getBoundingClientRect();
    const { width: shownWidth } = element.getBoundingClientRect();
    element.style.top = `${bar.bottom + 4}px`;
    element.style.left = `${Math.max(4, Math.min(at?.left ?? 4, window.innerWidth - shownWidth - 4))}px`;
    peek = { id, element, source, held };
    document.addEventListener("mousedown", onPeekOutside, true);
    window.addEventListener("keydown", onPeekKey, true);
  };

  function listenForPeek(badge: HTMLElement, id: number): void {
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    badge.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      if (peek?.id === id) {
        stayOpen();
        return;
      }
      cancelHover();
      hoverTimer = setTimeout(() => openPeek(id, false), HOVER_MS);
    });
    badge.addEventListener("pointerleave", leaveSoon);
    badge.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || event.button !== 0) return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        pressed = id;
        openPeek(id, true);
      }, LONG_PRESS_MS);
    });
    const endPress = () => clearTimeout(pressTimer);
    badge.addEventListener("pointerup", endPress);
    badge.addEventListener("pointercancel", endPress);
  }

  return {
    update: (next) => {
      entries = next;
      const key = JSON.stringify(next);
      if (key === shownKey) return;
      shownKey = key;
      const ids = new Set(next.map((entry) => entry.id));
      if (peek && !ids.has(peek.id)) closePeek();
      closeList();
      for (const id of [...pulsing]) if (!ids.has(id)) pulsing.delete(id);
      badges.clear();
      for (const entry of next) badges.set(entry.id, badgeElement(entry, false));
      container.replaceChildren(...badges.values(), plus);
      layout();
    },
    active: (id) => {
      lastOutput.set(id, Date.now());
      if (pulsing.has(id) || !badges.has(id)) return;
      pulsing.add(id);
      schedulePulse();
      pulseTimer ??= setTimeout(expirePulse, ACTIVE_MS / 3);
    },
    peek: (id) => openPeek(id, true),
  };
}
