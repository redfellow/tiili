import type { Platform } from "./keymap";
import type { TabEntry, TabStrip } from "./tabs";

/** What the tab strip asks of its window. */
export interface TabStripOptions {
  /** Shows tab `index`. */
  onShow: (index: number) => void;
  /** Moves tab `from` to strip index `to`. */
  onReorder: (from: number, to: number) => void;
  /** Names tab `index` `name`; empty brings the automatic label back. Also called with undefined when a rename ends unchanged. */
  onRename: (index: number, name: string | undefined) => void;
  /** Opens tab `index`'s right-click menu. */
  onMenu: (index: number, event: MouseEvent) => void;
}

export interface TopBarOptions {
  platform: Platform;
  /** True when the bar sits in the macOS overlay title bar, beside the native window buttons. */
  overlay: boolean;
  onNewPane: () => void;
  onHeynote: () => void;
  onClosePane: () => void;
  onResetLayout: () => void;
  onSettings: () => void;
  /** Shows the count of panes that need you; off where the backend keeps no attention marks. */
  attentionCount?: boolean;
  /** The window's tab strip, on the bar's left. */
  tabs: TabStripOptions;
}

/**
 * What the top bar shows after it is made: the count of panes that need you, across all windows, and the window's
 * tabs.
 */
export interface TopBar {
  setAttentionCount: (count: number) => void;
  tabs: TabStrip;
}

/** How far the pointer moves on a tab before it is dragged rather than clicked, in pixels. */
const DRAG_THRESHOLD = 4;

/**
 * The tab strip in `strip`: one entry per tab in strip order, the shown one highlighted, each labelled in its focused
 * pane's tint with a brick and count when its panes need the user. Hidden with one tab. Clicking shows a tab,
 * dragging reorders, right-clicking opens its menu, and a renamed tab's label becomes a field until Enter or Escape.
 */
function tabStrip(strip: HTMLElement, options: TabStripOptions): TabStrip {
  strip.className = "top-bar-tabs";
  strip.hidden = true;
  let entries: TabEntry[] = [];
  let shown = 0;
  let renaming: number | undefined;

  const entryAt = (x: number, y: number): number | undefined => {
    const tab = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tab-index]");
    return tab && strip.contains(tab) ? Number(tab.dataset.tabIndex) : undefined;
  };

  const render = () => {
    strip.hidden = entries.length < 2;
    strip.replaceChildren(
      ...entries.map((entry, index) => {
        const tab = document.createElement("div");
        tab.className = "top-bar-tab";
        tab.dataset.tabIndex = String(index);
        tab.toggleAttribute("data-shown", index === shown);
        if (entry.tint !== undefined) {
          tab.dataset.tint = String(entry.tint);
          tab.style.setProperty("--tab-tint", `var(--tint-${entry.tint})`);
          tab.style.setProperty("--tab-tint-on", `var(--tint-${entry.tint}-on)`);
        }
        if (entry.attention > 0) {
          const brick = document.createElement("span");
          brick.className = "pane-chip-brick";
          brick.setAttribute("aria-hidden", "true");
          const count = document.createElement("span");
          count.className = "top-bar-tab-count";
          count.textContent = String(entry.attention);
          tab.append(brick, count);
        }
        if (index === renaming) tab.append(renameField(index, entry.label));
        else {
          const label = document.createElement("span");
          label.className = "top-bar-tab-label";
          label.textContent = entry.label;
          tab.append(label);
          tab.title = entry.label;
          listen(tab, index);
        }
        return tab;
      }),
    );
  };

  const renameField = (index: number, label: string): HTMLInputElement => {
    const field = document.createElement("input");
    field.className = "top-bar-tab-rename";
    field.value = label;
    field.setAttribute("aria-label", "Tab name");
    let done = false;
    const finish = (name: string | undefined) => {
      if (done) return;
      done = true;
      renaming = undefined;
      render();
      options.onRename(index, name);
    };
    field.addEventListener("keydown", (event) => {
      // The field's keys are its own: no pane or tab shortcut acts on them.
      event.stopPropagation();
      if (event.key === "Enter") finish(field.value);
      else if (event.key === "Escape") finish(undefined);
    });
    field.addEventListener("blur", () => finish(field.value));
    requestAnimationFrame(() => {
      field.focus();
      field.select();
    });
    return field;
  };

  const listen = (tab: HTMLElement, index: number) => {
    tab.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      options.onMenu(index, event);
    });
    tab.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      // Keeps the keyboard in the focused pane.
      event.preventDefault();
      const start = { x: event.clientX, y: event.clientY };
      let dragging = false;
      tab.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
        dragging = true;
        tab.toggleAttribute("data-dragging", true);
        const over = entryAt(e.clientX, e.clientY);
        strip.querySelectorAll<HTMLElement>("[data-tab-index]").forEach((other) => {
          other.toggleAttribute("data-drop-target", over !== index && Number(other.dataset.tabIndex) === over);
        });
      };
      const up = (e: PointerEvent) => {
        tab.removeEventListener("pointermove", move);
        tab.removeEventListener("pointerup", up);
        tab.removeEventListener("pointercancel", up);
        if (!dragging) {
          options.onShow(index);
          return;
        }
        // The capture keeps the dragged tab under the pointer for hit tests, so look past it.
        tab.style.pointerEvents = "none";
        const to = e.type === "pointerup" ? entryAt(e.clientX, e.clientY) : undefined;
        tab.style.pointerEvents = "";
        render();
        if (to !== undefined && to !== index) options.onReorder(index, to);
      };
      tab.addEventListener("pointermove", move);
      tab.addEventListener("pointerup", up);
      tab.addEventListener("pointercancel", up);
    });
  };

  return {
    update: (next, nextShown) => {
      entries = next;
      shown = nextShown;
      // A rename in progress keeps its field until it ends.
      if (renaming === undefined) render();
    },
    rename: (index) => {
      if (!entries[index]) return;
      renaming = index;
      render();
    },
  };
}

interface TopBarButton {
  name: string;
  /** The shortcut that does the same: macOS first, then Windows and Linux; none for Heynote. */
  shortcut?: [mac: string, other: string];
  icon: string;
  action: () => void;
}

const SVG_OPEN =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const ICONS = {
  newPane: `${SVG_OPEN}<path d="M8 3v10M3 8h10"/></svg>`,
  // A note page with a folded corner and a plus.
  heynote:
    `${SVG_OPEN}<path d="M9.5 2.5h-6v11h9v-8z"/><path d="M9.5 2.5v3h3"/><path d="M8 7.5v4M6 9.5h4"/></svg>`,
  closePane: `${SVG_OPEN}<path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  resetLayout:
    `${SVG_OPEN}<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.5"/><rect x="9" y="2.5" width="4.5" ` +
    'height="4.5" rx="0.5"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="0.5"/><rect x="9" y="9" ' +
    'width="4.5" height="4.5" rx="0.5"/></svg>',
  settings:
    `${SVG_OPEN}<circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 ` +
    '1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3"/><circle cx="8" cy="8" r="4.3"/></svg>',
};

/**
 * Fills `bar`, the window's top bar, with the New pane, Heynote, Close pane, Reset layout and Settings buttons on its
 * right, led by the count of panes that need you (hidden at zero), and the window's tab strip on its left. Each button's popover tooltip names it with the platform's shortcut. In the macOS overlay title bar the bar
 * leaves room for the native window buttons and shows the title; dragging the bar moves the window.
 */
export function createTopBar(bar: HTMLElement, options: TopBarOptions): TopBar {
  const { platform } = options;
  bar.classList.add("top-bar");
  bar.toggleAttribute("data-overlay", options.overlay);
  bar.setAttribute("data-tauri-drag-region", "");
  bar.replaceChildren();

  if (options.overlay) {
    const title = document.createElement("span");
    title.className = "top-bar-title";
    title.textContent = "tiili";
    title.setAttribute("data-tauri-drag-region", "");
    bar.append(title);
  }

  const strip = document.createElement("div");
  const tabs = tabStrip(strip, options.tabs);
  bar.append(strip);

  const buttons: TopBarButton[] = [
    { name: "New pane", shortcut: ["⌘T", "Ctrl+Shift+T"], icon: ICONS.newPane, action: options.onNewPane },
    { name: "Heynote", icon: ICONS.heynote, action: options.onHeynote },
    { name: "Close pane", shortcut: ["⌘W", "Ctrl+Shift+W"], icon: ICONS.closePane, action: options.onClosePane },
    {
      name: "Reset layout",
      shortcut: ["⌃⌘0", "Ctrl+Alt+Shift+0"],
      icon: ICONS.resetLayout,
      action: options.onResetLayout,
    },
    { name: "Settings", shortcut: ["⌘,", "Ctrl+,"], icon: ICONS.settings, action: options.onSettings },
  ];

  const group = document.createElement("div");
  group.className = "top-bar-actions";

  // The attention count: a brick and the number of marked panes.
  const count = document.createElement("span");
  const countNumber = document.createElement("span");
  const countTip = document.createElement("span");
  if (options.attentionCount) {
    count.className = "top-bar-button top-bar-attention";
    count.hidden = true;
    const brick = document.createElement("span");
    brick.className = "pane-chip-brick";
    brick.setAttribute("aria-hidden", "true");
    countNumber.className = "top-bar-attention-count";
    const tip = document.createElement("span");
    tip.className = "top-bar-tooltip";
    tip.setAttribute("role", "tooltip");
    const keys = document.createElement("kbd");
    keys.textContent = platform === "macos" ? "⌘J" : "Ctrl+Shift+J";
    tip.append(countTip, keys);
    count.append(brick, countNumber, tip);
    group.append(count);
  }

  for (const { name, shortcut, icon, action } of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-bar-button";
    button.setAttribute("aria-label", name);
    // Not a keyboard target: the terminal keeps the keyboard, and clicks leave its focus alone.
    button.tabIndex = -1;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", action);
    button.innerHTML = icon;
    // A styled popover instead of the native title tooltip: it shows at once on hover and names the shortcut.
    const tip = document.createElement("span");
    tip.className = "top-bar-tooltip";
    tip.setAttribute("role", "tooltip");
    const label = document.createElement("span");
    label.textContent = name;
    tip.append(label);
    if (shortcut) {
      const keys = document.createElement("kbd");
      keys.textContent = platform === "macos" ? shortcut[0] : shortcut[1];
      tip.append(keys);
    }
    button.append(tip);
    group.append(button);
  }
  bar.append(group);

  return {
    setAttentionCount: (n) => {
      count.hidden = n <= 0;
      countNumber.textContent = String(n);
      countTip.textContent = n === 1 ? "1 pane needs you" : `${n} panes need you`;
      count.setAttribute("aria-label", countTip.textContent);
    },
    tabs,
  };
}
