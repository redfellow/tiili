import { openUrl } from "@tauri-apps/plugin-opener";
import { skipVersion, type FoundUpdate } from "./updates";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Shows the update dialog for `update` in this window: the new and current versions, the release notes as plain
 * text, and Install now (with progress, then a restart), Later and Skip this version. A `.deb` install can't update
 * itself, so it gets Open release page instead of Install now. `onClose` runs once the dialog has closed.
 */
export function showUpdateDialog(update: FoundUpdate, onClose: () => void = () => undefined): void {
  const deb = update.kind === "deb";
  const title = element("h2", { id: "update-dialog-title" }, deb ? "A new version is available" : "Install update?");
  const summary = element("p", { className: "update-summary" },
    `tiili ${update.version} is available (you have ${update.currentVersion}).`);
  const notes = element("pre", { className: "update-notes", tabIndex: 0, hidden: !update.notes }, update.notes);
  const progress = element("progress", { className: "update-progress", max: 1, hidden: true });
  const status = element("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  const later = element("button", { type: "button" }, "Later");
  const skip = element("button", { type: "button", className: "settings-reset" }, "Skip this version");
  const primary = element("button", { type: "button", className: "settings-save" },
    deb ? "Open release page" : "Install now");

  const dialog = element("dialog", { className: "settings update-dialog" },
    element("form", { method: "dialog" },
      element("header", { className: "settings-header" }, title),
      summary,
      notes,
      progress,
      status,
      element("footer", { className: "settings-footer" },
        skip, element("div", { className: "settings-actions" }, later, primary))));
  dialog.setAttribute("aria-labelledby", title.id);

  let installing = false;
  const lock = (on: boolean) => {
    installing = on;
    later.disabled = skip.disabled = primary.disabled = on;
  };
  const close = () => {
    if (!installing) dialog.close();
  };

  // Esc is Later, except while installing; it stops here, so the settings page or a pane behind doesn't act on it.
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose();
  });
  later.addEventListener("click", close);
  skip.addEventListener("click", () => {
    skipVersion(update.version);
    close();
  });
  primary.addEventListener("click", () => {
    status.textContent = "";
    if (deb) {
      openUrl(update.releaseUrl).catch((error: unknown) => {
        status.textContent = `Couldn't open the release page: ${message(error)}`;
      });
      return;
    }
    lock(true);
    progress.hidden = false;
    progress.removeAttribute("value");
    update
      .install((fraction) => {
        if (fraction === undefined) progress.removeAttribute("value");
        else progress.value = fraction;
      })
      .catch((error: unknown) => {
        progress.hidden = true;
        status.textContent = `Couldn't install the update: ${message(error)}`;
        lock(false);
      });
  });

  document.body.append(dialog);
  dialog.showModal();
  primary.focus();
}
