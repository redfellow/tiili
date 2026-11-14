import type { MenuItem } from "./backend";

let closeOpen: (() => void) | undefined;

/**
 * Shows an HTML right-click menu of `items` at (`x`, `y`), kept inside the window. It closes when an item is
 * chosen, on a click outside it, on Escape, or when another menu opens.
 */
export function showContextMenu(items: MenuItem[], x: number, y: number): void {
  closeOpen?.();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");

  const close = () => {
    menu.remove();
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    if (closeOpen === close) closeOpen = undefined;
  };
  const onOutside = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };

  const entries = (list: MenuItem[], prefix: string): MenuItem[] =>
    list.flatMap((item) =>
      "items" in item
        ? entries(item.items, `${prefix}${item.label} ▸ `)
        : "separator" in item || !prefix
          ? [item]
          : [{ label: prefix + item.label, action: item.action }],
    );
  // The HTML menu shows a submenu's items inline, each after the submenu's label.
  for (const item of entries(items, "")) {
    if ("items" in item) continue;
    if ("separator" in item) {
      const line = document.createElement("div");
      line.className = "context-menu-separator";
      line.setAttribute("role", "separator");
      menu.append(line);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-menu-item";
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    // mousedown keeps the terminal's focus and selection, which Copy needs.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      close();
      item.action();
    });
    menu.append(button);
  }

  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width))}px`;
  menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - height))}px`;

  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
  closeOpen = close;
}
