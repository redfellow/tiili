import { DEFAULT_SETTINGS, FONT_RANGES, normalize, type Settings } from "./settings";
import { THEMES } from "./themes";

const SAVE_DELAY_MS = 300;
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
/** Suggestions for the font family field; any installed font can be typed. */
const COMMON_MONO_FONTS = [
  "Geist Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Iosevka", "Source Code Pro", "Hack",
  "IBM Plex Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "DejaVu Sans Mono", "Ubuntu Mono",
];

export interface SettingsDialogOptions {
  initial: Settings;
  /** Applies settings live; called on every change. */
  apply: (settings: Settings) => Promise<void> | void;
  /** Saves settings; called once the user has stopped changing them for a moment. */
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

/** Builds the settings dialogue into `document.body`: Theme and Font sections, Reset to defaults, live apply. */
export function createSettingsDialog(options: SettingsDialogOptions): SettingsDialog {
  let current = options.initial;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const theme = element("select", { name: "theme" },
    ...THEMES.map((t) => element("option", { value: t.id }, t.name)));
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

  const form = element("form", { method: "dialog" },
    element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close),
    element("fieldset", {}, element("legend", {}, "Theme"), field("Theme", theme)),
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
    element("footer", { className: "settings-footer" }, status, reset),
  );
  const dialog = element("dialog", { className: "settings" }, form);
  dialog.setAttribute("aria-label", "Settings");
  document.body.append(dialog);

  const show = (settings: Settings) => {
    theme.value = settings.theme;
    family.value = settings.font.family;
    size.value = String(settings.font.size);
    weight.value = String(settings.font.weight);
    weightBold.value = String(settings.font.weightBold);
    ligatures.checked = settings.font.ligatures;
    lineHeight.value = String(settings.font.lineHeight);
    letterSpacing.value = String(settings.font.letterSpacing);
  };

  const read = (): Settings => normalize({
    theme: theme.value,
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

  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      options.save(current).then(() => { status.textContent = ""; }, report);
    }, SAVE_DELAY_MS);
  };

  const change = (next: Settings) => {
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    Promise.resolve(options.apply(next)).catch(report);
    scheduleSave();
  };

  // Apply while the user types; once a field is left, show the value that was actually applied.
  form.addEventListener("input", () => change(read()));
  form.addEventListener("change", () => {
    change(read());
    show(current);
  });
  reset.addEventListener("click", () => {
    change(DEFAULT_SETTINGS);
    show(current);
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => options.onClose());

  return {
    open() {
      if (dialog.open) return;
      show(current);
      dialog.showModal();
      theme.focus();
    },
  };
}
