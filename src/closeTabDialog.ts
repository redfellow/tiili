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
 * Asks whether to close a tab and its `count` panes, whose shells end with them. Resolves to true only when the user
 * chose Close Tab.
 */
export function confirmCloseTab(count: number): Promise<boolean> {
  return new Promise((resolve) => {
    const title = element("h2", { id: "close-tab-dialog-title" }, "Close this tab?");
    const text = element("p", { className: "link-dialog-scheme" }, `Its ${count} panes close, and their shells end.`);
    const cancel = element("button", { type: "button" }, "Cancel");
    const close = element("button", { type: "button", className: "settings-save" }, "Close Tab");
    const dialog = element(
      "dialog",
      { className: "settings link-dialog" },
      element(
        "form",
        { method: "dialog" },
        element("header", { className: "settings-header" }, title),
        text,
        element("footer", { className: "settings-footer" }, element("div", { className: "settings-actions" }, cancel, close)),
      ),
    );
    dialog.setAttribute("aria-labelledby", title.id);

    let chosen = false;
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(chosen);
    });
    cancel.addEventListener("click", () => dialog.close());
    close.addEventListener("click", () => {
      chosen = true;
      dialog.close();
    });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
