import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";
import type { ClipboardAction, Platform } from "./keymap";
import { matchCountLabel, SEARCH_LIMIT, type SearchDecorations, validRegex } from "./search";

/** Which way a search steps from the active match. */
export type FindDirection = "next" | "previous";

/** One terminal pane's find bar: its query, options and open state stay with the pane. */
export interface FindBar {
  /** Opens the bar, with a single-line terminal selection as the query, and gives its field the keyboard. */
  open(): void;
  /** Goes to the next or previous match; with the bar closed it opens first, and only opens without a query. */
  step(direction: FindDirection): void;
  /** Closes the bar, clears the highlights and gives the terminal the keyboard. */
  close(): void;
  /** Whether the bar's field has the keyboard. */
  hasFocus(): boolean;
  /** Carries out a clipboard action on the bar's field, for the native Edit menu while the field has the keyboard. */
  clipboard(action: ClipboardAction, read: () => Promise<string>, write: (text: string) => Promise<void>): Promise<void>;
  /** Re-reads the highlight colours after the theme changed and highlights the open search again. */
  refreshTheme(): void;
  /**
   * Sets the hook that sees each key pressed in the field first and returns true for the ones tiili keeps (pane,
   * layout, settings and find shortcuts); those never reach the field.
   */
  interceptKeys(handler: (event: KeyboardEvent) => boolean): void;
  dispose(): void;
}

type Option = "caseSensitive" | "wholeWord" | "regex";

/** The keys the bar's tooltips name, per platform. */
function keyNames(platform: Platform): { next: string; previous: string } {
  return platform === "macos"
    ? { next: "Enter, ⌘G", previous: "⇧Enter, ⇧⌘G" }
    : { next: "Enter, F3", previous: "Shift+Enter, Shift+F3" };
}

function button(className: string, text: string, title: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `find-bar-button ${className}`;
  element.textContent = text;
  element.title = title;
  element.setAttribute("aria-label", title);
  // Clicking keeps the keyboard where it is (the field), rather than giving it to the terminal under the bar.
  element.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  return element;
}

/**
 * Lays a find bar over the top right of `host`, the pane's terminal area (over its whole width when the pane is
 * narrow), so the terminal and its shell keep their size. It searches `term` with `addon`, drawing matches in
 * `decorations()`.
 */
export function createFindBar(
  host: HTMLElement,
  term: Terminal,
  addon: SearchAddon,
  platform: Platform,
  decorations: () => SearchDecorations,
): FindBar {
  const options: Record<Option, boolean> = { caseSensitive: false, wholeWord: false, regex: false };
  let opened = false;
  /** The terminal selection the last search left on its active match, which is not the user's own selection. */
  let selectedMatch = "";
  let intercept: (event: KeyboardEvent) => boolean = () => false;
  const keys = keyNames(platform);

  const frame = document.createElement("div");
  frame.className = "find-bar-frame";
  const bar = document.createElement("div");
  bar.className = "find-bar";
  bar.hidden = true;
  bar.setAttribute("role", "search");
  const field = document.createElement("input");
  field.type = "text";
  field.className = "find-bar-field";
  field.placeholder = "Find";
  field.spellcheck = false;
  field.autocomplete = "off";
  field.setAttribute("aria-label", "Find in terminal");
  const count = document.createElement("span");
  count.className = "find-bar-count";
  count.setAttribute("aria-live", "polite");
  const toggles: [Option, HTMLButtonElement][] = [
    ["caseSensitive", button("find-bar-toggle", "Aa", "Match case")],
    ["wholeWord", button("find-bar-toggle", "W", "Whole word")],
    ["regex", button("find-bar-toggle", ".*", "Regular expression")],
  ];
  const previous = button("find-bar-previous", "↑", `Previous match (${keys.previous})`);
  const next = button("find-bar-next", "↓", `Next match (${keys.next})`);
  const close = button("find-bar-close", "×", "Close (Esc)");
  bar.append(field, count, ...toggles.map(([, toggle]) => toggle), previous, next, close);
  frame.append(bar);
  host.append(frame);
  // The pane gives its terminal the keyboard on mousedown; inside the bar the field keeps it.
  bar.addEventListener("mousedown", (event) => event.stopPropagation());

  const showError = (error: boolean) => {
    if (error) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    bar.classList.toggle("find-bar-error", error);
  };

  const results = addon.onDidChangeResults(({ resultIndex, resultCount }) => {
    if (!opened || field.value === "") return;
    count.textContent = matchCountLabel(resultIndex, resultCount, resultCount >= SEARCH_LIMIT);
  });

  /** Searches for the field's query; `incremental` keeps the active match while it still matches. */
  const search = (direction: FindDirection, incremental = false) => {
    const query = field.value;
    if (query === "") {
      showError(false);
      addon.clearDecorations();
      count.textContent = "";
      return;
    }
    if (options.regex && !validRegex(query)) {
      showError(true);
      addon.clearDecorations();
      count.textContent = "";
      return;
    }
    showError(false);
    const searchOptions: ISearchOptions = { ...options, decorations: decorations(), incremental };
    const found = direction === "next" ? addon.findNext(query, searchOptions) : addon.findPrevious(query, searchOptions);
    if (!found) count.textContent = matchCountLabel(-1, 0, false);
    // The addon selects the active match; that selection must not later replace the user's query (a regex with it).
    selectedMatch = found ? term.getSelection() : "";
  };

  /** Highlights the open search afresh, e.g. with new colours or options. */
  const research = () => {
    if (!opened || field.value === "") return;
    addon.clearDecorations();
    search("next", true);
  };

  const show = () => {
    const selection = term.getSelection();
    if (selection !== "" && selection !== selectedMatch && !selection.includes("\n")) field.value = selection;
    if (!opened) {
      opened = true;
      bar.hidden = false;
    }
    field.focus();
    field.select();
  };

  const hide = () => {
    opened = false;
    bar.hidden = true;
    addon.clearDecorations();
    count.textContent = "";
    term.focus();
  };

  field.addEventListener("input", () => search("next", true));
  field.addEventListener("keydown", (event) => {
    if (intercept(event)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      search(event.shiftKey ? "previous" : "next");
    } else if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
  });
  for (const [option, toggle] of toggles) {
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      options[option] = !options[option];
      toggle.setAttribute("aria-pressed", String(options[option]));
      field.focus();
      research();
    });
  }
  previous.addEventListener("click", () => {
    field.focus();
    search("previous");
  });
  next.addEventListener("click", () => {
    field.focus();
    search("next");
  });
  close.addEventListener("click", hide);

  return {
    open: show,
    step: (direction) => {
      if (!opened) {
        // Opened without its selection prefill, so the last query steps on.
        opened = true;
        bar.hidden = false;
        field.focus();
        field.select();
        if (field.value === "") return;
      }
      search(direction);
    },
    close: hide,
    hasFocus: () => opened && document.activeElement === field,
    clipboard: async (action, read, write) => {
      if (action === "copy") {
        const text = field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
        if (text) await write(text);
      } else if (action === "paste") {
        const text = (await read()).replace(/\r?\n/g, " ");
        if (text) {
          field.setRangeText(text, field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length, "end");
          search("next", true);
        }
      } else {
        field.select();
      }
    },
    refreshTheme: research,
    interceptKeys: (handler) => {
      intercept = handler;
    },
    dispose: () => {
      results.dispose();
      frame.remove();
    },
  };
}
