import { DEFAULT_SETTINGS, FONT_RANGES, normalize, type Settings } from "./settings";
import { createSettingsSession } from "./settingsSession";
import { THEMES } from "./themes";

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
/** Suggestions for the font family field; any installed font can be typed. */
const COMMON_MONO_FONTS = [
  "Geist Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Iosevka", "Source Code Pro", "Hack",
  "IBM Plex Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "DejaVu Sans Mono", "Ubuntu Mono",
];

export interface SettingsDialogOptions {
  initial: Settings;
  /** Applies settings live; called on every change, and with the opening settings again on Cancel. */
  apply: (settings: Settings) => Promise<void> | void;
  /** Saves settings; called when the user presses Save, and the dialogue closes once it resolves. */
  save: (settings: Settings) => Promise<void>;
  /** Called after the dialogue closes, e.g. to give the terminal its focus back. */
  onClose: () => void;
}

export interface SettingsDialog {
  open(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  return element("label", { className: "settings-field" }, element("span", {}, label), control);
}

function numberInput(name: string, range: { min: number; max: number; step: number }): HTMLInputElement {
  return element("input", {
    type: "number", name, min: String(range.min), max: String(range.max), step: String(range.step),
  });
}

function weightSelect(name: string): HTMLSelectElement {
  return element("select", { name }, ...WEIGHTS.map((w) => element("option", { value: String(w) }, String(w))));
}

const same = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b);

/** A focusable single-select list of the themes; Up/Down, Home/End and clicks select at once. */
function themeList(onSelect: () => void) {
  let value: string = THEMES[0].id;
  const items = THEMES.map((t) => {
    const item = element("div", { className: "settings-theme", id: `settings-theme-${t.id}` }, t.name);
    item.setAttribute("role", "option");
    item.dataset.theme = t.id;
    return item;
  });
  const list = element("div", { className: "settings-themes", tabIndex: 0 }, ...items);
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Theme");

  /** Marks `id` selected and scrolls it into view, without applying it. */
  const show = (id: string) => {
    value = id;
    for (const item of items) {
      const selected = item.dataset.theme === id;
      item.setAttribute("aria-selected", String(selected));
      if (selected) {
        list.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
      }
    }
  };
  const select = (index: number) => {
    const id = THEMES[Math.max(0, Math.min(THEMES.length - 1, index))].id;
    if (id === value) return;
    show(id);
    onSelect();
  };

  list.addEventListener("keydown", (event) => {
    const index = THEMES.findIndex((t) => t.id === value);
    const moves: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: THEMES.length - 1 };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  });
  list.addEventListener("click", (event) => {
    const item = (event.target as Element).closest<HTMLElement>("[role=option]");
    if (!item) return;
    list.focus();
    select(THEMES.findIndex((t) => t.id === item.dataset.theme));
  });

  return { list, show, value: () => value };
}

/**
 * Builds the settings dialogue into `document.body`: Theme and Font sections, Reset to defaults, Cancel and Save.
 * Every change applies at once as a preview; only Save writes it, and Cancel, Esc and × go back to the opening settings.
 */
export function createSettingsDialog(options: SettingsDialogOptions): SettingsDialog {
  const session = createSettingsSession(options.initial);

  const theme = themeList(() => change(read()));
  const family = element("input", { type: "text", name: "family", spellcheck: false, autocomplete: "off" });
  family.setAttribute("list", "settings-font-families");
  const families = element("datalist", { id: "settings-font-families" },
    ...COMMON_MONO_FONTS.map((name) => element("option", { value: name })));
  const size = numberInput("size", FONT_RANGES.size);
  const weight = weightSelect("weight");
  const weightBold = weightSelect("weightBold");
  const ligatures = element("input", { type: "checkbox", name: "ligatures" });
  const lineHeight = numberInput("lineHeight", FONT_RANGES.lineHeight);
  const letterSpacing = numberInput("letterSpacing", FONT_RANGES.letterSpacing);
  const status = element("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  const close = element("button", { type: "button", className: "settings-close", title: "Close" }, "×");
  close.setAttribute("aria-label", "Close");
  const reset = element("button", { type: "button", className: "settings-reset" }, "Reset to defaults");
  const cancel = element("button", { type: "button", className: "settings-cancel" }, "Cancel");
  const save = element("button", { type: "button", className: "settings-save" }, "Save");

  const form = element("form", { method: "dialog" },
    element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close),
    element("fieldset", {}, element("legend", {}, "Theme"), theme.list),
    element("fieldset", {},
      element("legend", {}, "Font"),
      field("Family", family), families,
      field("Size (px)", size),
      field("Weight", weight),
      field("Bold weight", weightBold),
      field("Line height", lineHeight),
      field("Letter spacing (px)", letterSpacing),
      element("label", { className: "settings-check" }, ligatures, element("span", {}, "Ligatures")),
    ),
    status,
    element("footer", { className: "settings-footer" },
      reset, element("div", { className: "settings-actions" }, cancel, save)),
  );
  const dialog = element("dialog", { className: "settings" }, form);
  dialog.setAttribute("aria-label", "Settings");
  document.body.append(dialog);

  const show = (settings: Settings) => {
    theme.show(settings.theme);
    family.value = settings.font.family;
    size.value = String(settings.font.size);
    weight.value = String(settings.font.weight);
    weightBold.value = String(settings.font.weightBold);
    ligatures.checked = settings.font.ligatures;
    lineHeight.value = String(settings.font.lineHeight);
    letterSpacing.value = String(settings.font.letterSpacing);
  };

  const read = (): Settings => normalize({
    theme: theme.value(),
    font: {
      family: family.value,
      size: size.valueAsNumber,
      weight: Number(weight.value),
      weightBold: Number(weightBold.value),
      ligatures: ligatures.checked,
      lineHeight: lineHeight.valueAsNumber,
      letterSpacing: letterSpacing.valueAsNumber,
    },
  });

  const report = (error: unknown) => {
    status.textContent = String(error);
  };

  const apply = (settings: Settings) => {
    Promise.resolve(options.apply(settings)).catch(report);
  };

  const change = (next: Settings) => {
    if (session.edit(next)) apply(next);
  };

  let saving = false;

  /** Cancel, Esc and ×: back to the settings from when the dialogue opened, unsaved. */
  const revert = () => {
    if (saving) return;
    const draft = session.draft;
    const saved = session.cancel();
    if (!same(draft, saved)) apply(saved);
    dialog.close();
  };

  /** Save: write the previewed settings and close; on failure stay open with the error. */
  const commit = async () => {
    if (saving) return;
    saving = true;
    save.disabled = cancel.disabled = true;
    try {
      await options.save(session.draft);
      session.commit();
      status.textContent = "";
      dialog.close();
    } catch (error) {
      report(error);
    } finally {
      saving = false;
      save.disabled = cancel.disabled = false;
    }
  };

  // Apply while the user types; once a field is left, show the value that was actually applied.
  form.addEventListener("input", () => change(read()));
  form.addEventListener("change", () => {
    change(read());
    show(session.draft);
  });
  // Submitting the form would close the dialogue without deciding; only Save and Cancel close it.
  form.addEventListener("submit", (event) => event.preventDefault());
  reset.addEventListener("click", () => {
    change(DEFAULT_SETTINGS);
    show(session.draft);
  });
  save.addEventListener("click", () => void commit());
  cancel.addEventListener("click", revert);
  close.addEventListener("click", revert);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    revert();
  });
  dialog.addEventListener("close", () => options.onClose());

  return {
    open() {
      if (dialog.open) return;
      status.textContent = "";
      dialog.showModal();
      // Shown once open, so the selected theme can scroll into view.
      show(session.saved);
      theme.list.focus();
    },
  };
}
