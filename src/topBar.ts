import type { Platform } from "./keymap";

export interface TopBarOptions {
  platform: Platform;
  /** True when the bar sits in the macOS overlay title bar, beside the native window buttons. */
  overlay: boolean;
  onNewPane: () => void;
  onClosePane: () => void;
  onResetLayout: () => void;
  onSettings: () => void;
}

interface TopBarButton {
  name: string;
  /** The shortcut that does the same: macOS first, then Windows and Linux. */
  shortcut: [mac: string, other: string];
  icon: string;
  action: () => void;
}

const SVG_OPEN =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const ICONS = {
  newPane: `${SVG_OPEN}<path d="M8 3v10M3 8h10"/></svg>`,
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
 * Fills `bar`, the window's top bar, with the New pane, Close pane, Reset layout and Settings buttons on its
 * right. Each button's tooltip names it with the platform's shortcut. In the macOS overlay title bar the bar
 * leaves room for the native window buttons and shows the title; dragging the bar moves the window.
 */
export function createTopBar(bar: HTMLElement, options: TopBarOptions): void {
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

  const buttons: TopBarButton[] = [
    { name: "New pane", shortcut: ["⌘T", "Ctrl+Shift+T"], icon: ICONS.newPane, action: options.onNewPane },
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
  for (const { name, shortcut, icon, action } of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-bar-button";
    button.title = `${name} (${platform === "macos" ? shortcut[0] : shortcut[1]})`;
    button.setAttribute("aria-label", name);
    // Not a keyboard target: the terminal keeps the keyboard, and clicks leave its focus alone.
    button.tabIndex = -1;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", action);
    button.innerHTML = icon;
    group.append(button);
  }
  bar.append(group);
}
