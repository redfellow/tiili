import { openUrl } from "@tauri-apps/plugin-opener";
import { releasePageUrl } from "./updates";

/** The most items the panel lists; See all changes has the rest. */
export const WHATS_NEW_LIMIT = 6;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

/**
 * Shows the What's new panel for `version` in this window, on the first start after an in-app update: the first
 * items of the release's What's new list, a See all changes link to the release page and Close (or Esc).
 * `onClose` runs once the panel has closed.
 */
export function showWhatsNewDialog(version: string, items: string[], onClose: () => void = () => undefined): void {
  const title = element("h2", { id: "whats-new-title" }, `What's new in tiili ${version}`);
  const list = element("ul", { className: "update-notes update-items", tabIndex: 0 },
    ...items.slice(0, WHATS_NEW_LIMIT).map((item) => element("li", {}, item)));
  const url = releasePageUrl(version);
  const allChanges = element("a", { className: "update-all-changes", href: url }, "See all changes");
  const status = element("p", { className: "settings-status" });
  status.setAttribute("role", "status");
  const close = element("button", { type: "button", className: "settings-save" }, "Close");

  const dialog = element("dialog", { className: "settings update-dialog whats-new" },
    element("form", { method: "dialog" },
      element("header", { className: "settings-header" }, title),
      list,
      allChanges,
      status,
      element("footer", { className: "settings-footer" }, element("div", { className: "settings-actions" }, close))));
  dialog.setAttribute("aria-labelledby", title.id);

  // Esc closes; it stops here, so a pane behind doesn't act on it.
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose();
  });
  allChanges.addEventListener("click", (event) => {
    event.preventDefault();
    status.textContent = "";
    openUrl(url).catch((error: unknown) => {
      status.textContent = `Couldn't open the release page: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  close.addEventListener("click", () => dialog.close());

  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}
