import { gridFor, TILING_MODES, type TilingMode } from "./layout";
import { MIN_RESPONSIVE_LINE_HEIGHT, MIN_RESPONSIVE_SIZE, RESPONSIVE_STRENGTH } from "./responsive";
import {
  APP_ICONS, type AppIcon, CURSOR_STYLES, DEFAULT_FONT_FAMILY, DEFAULT_SETTINGS, FONT_RANGES, INACTIVE_OPACITY, normalize, type Settings,
} from "./settings";
import { PROMPT_STYLES, type PromptSegment } from "./promptStyles";
import { REMOTE_SNIPPETS } from "./remoteSnippets";
import { createSettingsSession, same } from "./settingsSession";
import { THEMES, type Theme } from "./themes";
import { APP_VERSION } from "./version";

/** Fonts shipped with the app, listed under "Bundled". */
const BUNDLED_FONTS = [
  DEFAULT_FONT_FAMILY, "Victor Mono", "Commit Mono", "Recursive Mono", "Cascadia Code",
];
/**
 * Fonts to look for when the webview can't list the installed ones (`queryLocalFonts` is Chromium only); only the
 * ones that are actually installed show under "OS".
 */
const COMMON_MONO_FONTS = [
  "Geist Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Iosevka", "Source Code Pro", "Hack",
  "IBM Plex Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "DejaVu Sans Mono", "Ubuntu Mono",
];

export interface SettingsDialogOptions {
  initial: Settings;
  /** Shows the Dock icon choice; only macOS lets the user pick it. */
  showAppIcon: boolean;
  /** Applies settings live; called on every change, and with the opening settings again on Cancel. */
  apply: (settings: Settings) => Promise<void> | void;
  /** Saves settings; called when the user presses Save, and the settings close once it resolves. */
  save: (settings: Settings) => Promise<void>;
  /** Called after the settings close, e.g. to give the terminal its focus back or to close the settings window. */
  onClose: () => void;
  /** Puts text on the clipboard, for the Remote shells snippets' Copy buttons. */
  copy: (text: string) => Promise<void>;
}

export interface SettingsDialog {
  open(): void;
  /** Takes settings saved elsewhere (the splash's "tiili no-splash") as the saved and previewed settings. */
  adopt(settings: Settings): void;
}

export interface SettingsPage {
  /** Takes settings saved elsewhere (another window) as the saved and previewed settings. */
  adopt(settings: Settings): void;
  /** Goes back to the settings from when the page opened, unsaved, without closing; for the OS close control. */
  discard(): Promise<void>;
}

/** The settings form, ready to mount in a dialogue or a page. */
interface SettingsForm {
  form: HTMLFormElement;
  /** Fills the form with the saved settings on its first tab, focuses the theme list and lists installed fonts. */
  reset(): void;
  adopt(settings: Settings): void;
  /** Cancel, Esc and ×: back to the opening settings, unsaved, then closes. */
  revert(): Promise<void>;
  /** Back to the opening settings, unsaved, without closing. */
  discard(): Promise<void>;
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

/** A label and its control side by side, or with the control under the label when `stacked`. */
function field(label: string, control: HTMLElement, stacked = false): HTMLLabelElement {
  const className = stacked ? "settings-field settings-field-stacked" : "settings-field";
  return element("label", { className }, element("span", {}, label), control);
}

function numberInput(name: string, range: { min: number; max: number; step: number }): HTMLInputElement {
  return element("input", {
    type: "number", name, min: String(range.min), max: String(range.max), step: String(range.step),
  });
}

/** A slider with a filled track and a live readout; `input` is the range, `control` the row to put in a field. */
function rangeInput(name: string, range: { min: number; max: number; step: number }) {
  const input = numberInput(name, range);
  input.type = "range";
  const out = element("output", {}, "");
  const sync = () => {
    out.textContent = String(Number(input.value));
    input.style.setProperty("--fill", `${((input.valueAsNumber - range.min) / (range.max - range.min)) * 100}%`);
  };
  input.addEventListener("input", sync);
  const control = element("div", { className: "settings-range" }, input, out);
  return { input, control, sync };
}

let measureContext: CanvasRenderingContext2D | null | undefined;
function textWidth(font: string, text: string): number {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

/** True when `name` is a fixed-width font: its narrow and wide letters take the same width. */
function isMonospace(name: string): boolean {
  const font = `16px "${name}", sans-serif`;
  return Math.abs(textWidth(font, "iiiiiiii") - textWidth(font, "WWWWWWWW")) < 0.01;
}

/** True when `name` is installed: it changes the width of text that would otherwise use a generic font. */
function isInstalled(name: string): boolean {
  return ["monospace", "serif"].some(
    (base) => textWidth(`16px "${name}", ${base}`, "mmmmmmmmmmlli") !== textWidth(`16px ${base}`, "mmmmmmmmmmlli"),
  );
}

type LocalFontsWindow = { queryLocalFonts?: () => Promise<{ family: string }[]> };

/** The fixed-width font families installed on the machine, sorted: all of them where the webview can list fonts. */
async function installedMonospaceFonts(): Promise<string[]> {
  const query = (window as LocalFontsWindow).queryLocalFonts;
  let names: string[];
  try {
    names = query
      ? [...new Set((await query.call(window)).map((f) => f.family))].filter(isMonospace)
      : COMMON_MONO_FONTS.filter((n) => isInstalled(n) && isMonospace(n));
  } catch {
    // Permission to list fonts was refused.
    names = COMMON_MONO_FONTS.filter((n) => isInstalled(n) && isMonospace(n));
  }
  return names.filter((n) => !BUNDLED_FONTS.includes(n)).sort((a, b) => a.localeCompare(b));
}

/** Adds the muted "(default)" after a row's name. */
function markDefault(row: HTMLElement): void {
  row.append(element("span", { className: "settings-default" }, "(default)"));
}

const TILING_LABELS: Record<TilingMode, string> = {
  grid: "Grid",
  wide: "Wide grid",
  tall: "Tall grid",
  columns: "Side by side",
  rows: "Stacked",
};

/** A tiny picture of how seven panes tile in `mode`, drawn as bricks. */
function tilingIcon(mode: TilingMode): HTMLElement {
  const { cols, rows, cells } = gridFor(7, mode);
  const [width, height, gap] = [30, 18, 1];
  const rects = cells.map((cell) => {
    const w = (width - (cols - 1) * gap) / cols;
    const x = cell.col * cell.colSpan * (w + gap);
    const span = w * cell.colSpan + gap * (cell.colSpan - 1);
    const h = (height - (rows - 1) * gap) / rows;
    return `<rect x="${x.toFixed(2)}" y="${(cell.row * (h + gap)).toFixed(2)}" width="${span.toFixed(2)}" ` +
      `height="${h.toFixed(2)}" rx="0.5"/>`;
  });
  const icon = element("span", { className: "settings-layout-icon" });
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="currentColor">${rects.join("")}</svg>`;
  return icon;
}

const CURSOR_LABELS = { block: "Brick", underline: "Underline", bar: "Bar" } as const;
const APP_ICON_LABELS: Record<AppIcon, string> = { system: "Follow system appearance", light: "Light", dark: "Dark" };

interface PickItem { id: string; name: string }
interface PickGroup { label?: string; items: PickItem[] }

/**
 * A focusable single-select list in groups, for themes and fonts. Up/Down, Home/End and clicks select at once (the
 * choice applies as focus moves) unless `locked`. `render` decorates each row; groups can be replaced later.
 */
function pickList(
  label: string,
  onSelect: () => void,
  locked: () => boolean,
  render: (row: HTMLElement, item: PickItem) => void = () => {},
) {
  let value = "";
  let items: PickItem[] = [];
  let rows: HTMLElement[] = [];
  const list = element("div", { className: "settings-list", tabIndex: 0 });
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);

  /** Marks `id` selected and scrolls it into view, without applying it. */
  const show = (id: string) => {
    value = id;
    rows.forEach((row, i) => {
      const selected = items[i].id === id;
      row.setAttribute("aria-selected", String(selected));
      if (selected) {
        list.setAttribute("aria-activedescendant", row.id);
        row.scrollIntoView({ block: "nearest" });
      }
    });
  };
  const setGroups = (groups: PickGroup[]) => {
    items = groups.flatMap((g) => g.items);
    rows = [];
    const children: HTMLElement[] = [];
    for (const group of groups) {
      if (group.label) {
        const heading = element("div", { className: "settings-list-heading" }, group.label);
        heading.setAttribute("role", "presentation");
        children.push(heading);
      }
      for (const item of group.items) {
        const row = element("div", { className: "settings-option", id: `${label.replace(/\s+/g, "-")}-${rows.length}` });
        row.setAttribute("role", "option");
        row.dataset.id = item.id;
        render(row, item);
        rows.push(row);
        children.push(row);
      }
    }
    list.replaceChildren(...children);
    show(value);
  };
  const select = (index: number) => {
    const id = items[Math.max(0, Math.min(items.length - 1, index))]?.id;
    if (id === undefined || id === value || locked()) return;
    show(id);
    onSelect();
  };

  list.addEventListener("keydown", (event) => {
    const index = items.findIndex((i) => i.id === value);
    const moves: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: items.length - 1 };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  });
  list.addEventListener("click", (event) => {
    const row = (event.target as Element).closest<HTMLElement>("[role=option]");
    if (!row) return;
    list.focus();
    select(items.findIndex((i) => i.id === row.dataset.id));
  });

  return { list, show, setGroups, value: () => value };
}

/** A theme's colours for its swatch: terminal ground and text, and the accent. System shows light and dark halves. */
function swatchColours(theme: Theme) {
  const light = THEMES.find((t) => t.id === "tiili-light")!.tokens;
  const dark = THEMES.find((t) => t.id === "tiili-dark")!.tokens;
  const t = theme.kind === "system" ? light : theme.tokens;
  return {
    bg: theme.kind === "system"
      ? `linear-gradient(115deg, ${light["--term-bg"]} 50%, ${dark["--term-bg"]} 50%)`
      : t["--term-bg"]!,
    fg: t["--term-fg"]!,
    accent: t["--accent"]!,
  };
}

/** The theme list: System first, then the dark themes, then the light ones, each row led by a colour swatch. */
function themeList(onSelect: () => void, locked: () => boolean) {
  const byId = new Map<string, Theme>(THEMES.map((t) => [t.id, t]));
  const picker = pickList("Theme", onSelect, locked, (row, item) => {
    const theme = byId.get(item.id)!;
    const colours = swatchColours(theme);
    const swatch = element("span", { className: "settings-swatch" }, theme.kind === "system" ? "" : "Aa");
    swatch.setAttribute("aria-hidden", "true");
    swatch.style.setProperty("--sw-bg", colours.bg);
    swatch.style.setProperty("--sw-fg", colours.fg);
    swatch.style.setProperty("--sw-accent", colours.accent);
    row.append(swatch, element("span", {}, item.name));
    if (item.id === DEFAULT_SETTINGS.theme) markDefault(row);
  });
  const of = (kind: Theme["kind"]) => THEMES.filter((t) => t.kind === kind).map(({ id, name }) => ({ id, name }));
  picker.setGroups([{ items: of("system") }, { label: "Dark", items: of("dark") }, { label: "Light", items: of("light") }]);
  return picker;
}

/** A prompt drawn line by line in the current theme's terminal ground and ANSI colours, so it follows theme changes. */
function promptPreview(lines: PromptSegment[][]): HTMLElement {
  const preview = element("span", { className: "settings-prompt-preview" },
    ...lines.map((line) => element("span", {},
      ...line.map(({ text, ansi }) => {
        const run = element("span", {}, text);
        run.style.color = ansi === "fg" ? "var(--term-fg)" : `var(--ansi-${ansi})`;
        return run;
      }))));
  preview.setAttribute("aria-hidden", "true");
  return preview;
}

/** The prompt list: Off first, then the One-line and Two-line styles, each row with a preview of its prompt. */
function promptList(onSelect: () => void, locked: () => boolean) {
  const byId = new Map(PROMPT_STYLES.map((style) => [style.id as string, style]));
  const picker = pickList("Prompt", onSelect, locked, (row, item) => {
    const style = byId.get(item.id)!;
    row.append(element("span", {}, item.name));
    if (style.preview.length > 0) row.append(promptPreview(style.preview));
    if (style.preview.length > 1) row.classList.add("settings-option-tall");
    if (item.id === DEFAULT_SETTINGS.prompt) markDefault(row);
  });
  const of = (group: string | undefined) =>
    PROMPT_STYLES.filter((style) => style.group === group).map(({ id, label }) => ({ id, name: label }));
  picker.setGroups([{ items: of(undefined) }, { label: "One-line", items: of("One-line") },
    { label: "Two-line", items: of("Two-line") }]);
  // Short enough to show whole, so no style hides below a scroll.
  picker.list.classList.add("settings-list-whole");
  return picker;
}

/**
 * Builds the settings form: a Style tab (Theme, Cursor, Inactive terminals), a Typography tab (Font) and a Behaviour
 * tab (Tiling, Responsive text, Panes, Remote shells, Startup), with Reset to defaults, Cancel and Save. Every change
 * applies at once as a preview; only Save writes it, and Cancel and × go back to the opening settings. Either one then
 * calls `close`.
 */
function createSettingsForm(options: SettingsDialogOptions, close: () => void): SettingsForm {
  const session = createSettingsSession(options.initial);

  const theme = themeList(() => change(read()), () => saving);
  const prompt = promptList(() => change(read()), () => saving);
  let osFonts: string[] = [];
  const family = pickList("Font family", () => change(read()), () => saving, (row, item) => {
    row.style.fontFamily = `"${item.name}", monospace`;
    row.textContent = item.name;
    if (item.id === DEFAULT_FONT_FAMILY) markDefault(row);
  });
  /** Fills the family list: a Bundled and an OS group, with `selected` kept even if it is in neither. */
  const renderFamilies = (selected: string) => {
    const listed = (names: string[]) => names.map((name) => ({ id: name, name }));
    const os = osFonts.includes(selected) || BUNDLED_FONTS.includes(selected) ? osFonts : [...osFonts, selected];
    family.setGroups([{ label: "Bundled", items: listed(BUNDLED_FONTS) }, { label: "OS", items: listed(os) }]);
    family.show(selected);
  };
  const tiling = pickList("Tiling", () => change(read()), () => saving, (row, item) => {
    row.append(tilingIcon(item.id as TilingMode), element("span", {}, item.name));
    if (item.id === DEFAULT_SETTINGS.tiling.layout) markDefault(row);
  });
  tiling.setGroups([{ items: TILING_MODES.map((id) => ({ id, name: TILING_LABELS[id] })) }]);
  const responsiveOn = element("input", { type: "checkbox", name: "responsiveEnabled" });
  const responsiveStrength = rangeInput("responsiveStrength", RESPONSIVE_STRENGTH);
  const size = rangeInput("size", FONT_RANGES.size);
  const weight = rangeInput("weight", FONT_RANGES.weight);
  const weightBold = rangeInput("weightBold", FONT_RANGES.weightBold);
  const ligatures = element("input", { type: "checkbox", name: "ligatures" });
  const lineHeight = rangeInput("lineHeight", FONT_RANGES.lineHeight);
  const letterSpacing = rangeInput("letterSpacing", FONT_RANGES.letterSpacing);
  const cursorStyle = element("select", { name: "cursorStyle" },
    ...CURSOR_STYLES.map((style) => element("option", { value: style }, CURSOR_LABELS[style])));
  const cursorBlink = element("input", { type: "checkbox", name: "cursorBlink" });
  const inactiveOpacity = rangeInput("inactiveOpacity", INACTIVE_OPACITY);
  const inactiveDesaturate = element("input", { type: "checkbox", name: "inactiveDesaturate" });
  const hoverHighlight = element("input", { type: "checkbox", name: "hoverHighlight" });
  const startupSplash = element("input", { type: "checkbox", name: "startupSplash" });
  const appIcon = element("select", { name: "appIcon" },
    ...APP_ICONS.map((icon) => element("option", { value: icon }, APP_ICON_LABELS[icon])));
  const status = element("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  const closeButton = element("button", { type: "button", className: "settings-close", title: "Close" }, "×");
  closeButton.setAttribute("aria-label", "Close");
  const reset = element("button", { type: "button", className: "settings-reset" }, "Reset to defaults");
  const confirmReset = element("button", { type: "button", className: "settings-reset" }, "Reset");
  const keepSettings = element("button", { type: "button", className: "settings-reset" }, "Keep");
  const confirmLabel = element("span", { id: "settings-confirm-label" }, "Reset all settings?");
  const confirm = element("div", { className: "settings-confirm", hidden: true },
    confirmLabel, confirmReset, keepSettings);
  confirm.setAttribute("role", "group");
  confirm.setAttribute("aria-labelledby", confirmLabel.id);
  const cancel = element("button", { type: "button", className: "settings-cancel" }, "Cancel");
  const save = element("button", { type: "button", className: "settings-save" }, "Save");

  const fontFields = element("fieldset", {},
    element("legend", {}, "Font"),
    field("Family", family.list, true),
    field("Size (px)", size.control),
    field("Weight", weight.control),
    field("Bold weight", weightBold.control),
    field("Line height", lineHeight.control),
    field("Letter spacing (px)", letterSpacing.control),
    element("label", { className: "settings-check" }, ligatures, element("span", {}, "Ligatures")),
  );

  const cursorFields = element("fieldset", {},
    element("legend", {}, "Cursor"),
    field("Style", cursorStyle),
    element("label", { className: "settings-check" }, cursorBlink, element("span", {}, "Blink")),
  );

  const inactiveFields = element("fieldset", {},
    element("legend", {}, "Inactive terminals"),
    field("Opacity", inactiveOpacity.control),
    element("label", { className: "settings-check" }, inactiveDesaturate, element("span", {}, "Desaturate")),
  );

  const tilingFields = element("fieldset", {},
    element("legend", {}, "Tiling"),
    tiling.list,
    element("p", { className: "settings-hint" }, "How panes are arranged as you open and close them."),
  );

  const appIconFields = element("fieldset", {},
    element("legend", {}, "Dock icon"),
    field("Icon", appIcon),
  );

  const responsiveFields = element("fieldset", {},
    element("legend", {}, "Responsive text"),
    element("label", { className: "settings-check" }, responsiveOn, element("span", {}, "Shrink text in small panes")),
    field("Strength", responsiveStrength.control),
    element("p", { className: "settings-hint" },
      `Font size, line height and (slightly) letter spacing shrink as a pane gets smaller than the window, down to ` +
      `${MIN_RESPONSIVE_SIZE} px and a line height of ${MIN_RESPONSIVE_LINE_HEIGHT}. Higher strength shrinks faster.`),
  );

  const paneFields = element("fieldset", {},
    element("legend", {}, "Panes"),
    element("label", { className: "settings-check" }, hoverHighlight,
      element("span", {}, "Highlight the terminal under the mouse")),
  );

  // Nothing here is saved: each snippet is only shown and copied.
  const remoteFields = element("fieldset", {},
    element("legend", {}, "Remote shells"),
    element("p", { className: "settings-hint" },
      "Add the snippet for your shell to a remote machine's shell startup file, and a pane that connects there shows " +
      "that machine's folder and repository. tmux and screen on the remote machine hide it."),
    ...REMOTE_SNIPPETS.map(({ shell, text }) => {
      const label = `Copy the ${shell} snippet`;
      const copy = element("button", { type: "button", className: "settings-copy", title: label }, "Copy");
      copy.setAttribute("aria-label", label);
      copy.addEventListener("click", () => void options.copy(text).catch(() => {}));
      return element("div", { className: "settings-snippet" },
        element("div", { className: "settings-snippet-head" }, element("span", {}, shell), copy),
        element("pre", { tabIndex: 0 }, text));
    }),
  );

  const startupFields = element("fieldset", {},
    element("legend", {}, "Startup"),
    element("label", { className: "settings-check" }, startupSplash,
      element("span", {}, "Play the tiili splash when tiili opens")),
    element("p", { className: "settings-hint" }, "Any key or click skips it."),
  );

  const stylePanel = element("div", { className: "settings-panel", id: "settings-panel-style" },
    element("fieldset", {}, element("legend", {}, "Theme"), theme.list),
    element("fieldset", {},
      element("legend", {}, "Prompt"),
      prompt.list,
      element("p", { className: "settings-hint" },
        "Applies to open panes and new ones. A prompt set in your own shell config (PROMPT, PS1 or a prompt " +
        "function) always wins."),
    ),
    cursorFields,
    inactiveFields,
    ...(options.showAppIcon ? [appIconFields] : []),
  );
  const typography = element("div", { className: "settings-panel", id: "settings-panel-typography" }, fontFields);
  const behaviour = element("div", { className: "settings-panel", id: "settings-panel-behaviour" },
    tilingFields, responsiveFields, paneFields, remoteFields, startupFields);
  const panels = [stylePanel, typography, behaviour];
  const tabs = ["Style", "Typography", "Behaviour"].map((name, i) => {
    const tab = element("button", { type: "button", className: "settings-tab", id: `settings-tab-${i}` }, name);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[i].id);
    return tab;
  });
  const tabList = element("div", { className: "settings-tabs" }, ...tabs);
  tabList.setAttribute("role", "tablist");
  panels.forEach((panel, i) => {
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabs[i].id);
  });
  /** Shows tab `index` and its panel; `focus` moves the keyboard to the tab too. */
  const showTab = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus();
  };
  // Left and Right move between the tabs, wrapping round at either end.
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => showTab(i));
    tab.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" ? i + 1 : event.key === "ArrowLeft" ? i - 1 : undefined;
      if (next === undefined) return;
      event.preventDefault();
      showTab((next + tabs.length) % tabs.length, true);
    });
  });
  showTab(0);

  const header = element("header", { className: "settings-header" }, element("h2", {}, "Settings"), closeButton);
  const form = element("form", { method: "dialog" },
    header,
    tabList,
    stylePanel,
    typography,
    behaviour,
    status,
    element("footer", { className: "settings-footer" },
      element("span", { className: "settings-version" }, `tiili ${APP_VERSION}`),
      reset, confirm, element("div", { className: "settings-actions" }, cancel, save)),
  );
  const show = (settings: Settings) => {
    theme.show(settings.theme);
    prompt.show(settings.prompt);
    renderFamilies(settings.font.family);
    size.input.value = String(settings.font.size);
    size.sync();
    weight.input.value = String(settings.font.weight);
    weightBold.input.value = String(settings.font.weightBold);
    weight.sync();
    weightBold.sync();
    ligatures.checked = settings.font.ligatures;
    lineHeight.input.value = String(settings.font.lineHeight);
    letterSpacing.input.value = String(settings.font.letterSpacing);
    lineHeight.sync();
    letterSpacing.sync();
    cursorStyle.value = settings.cursor.style;
    cursorBlink.checked = settings.cursor.blink;
    inactiveOpacity.input.value = String(settings.inactive.opacity);
    inactiveOpacity.sync();
    inactiveDesaturate.checked = settings.inactive.desaturate;
    hoverHighlight.checked = settings.behaviour.hoverHighlight;
    startupSplash.checked = settings.behaviour.startupSplash;
    appIcon.value = settings.appIcon;
    tiling.show(settings.tiling.layout);
    responsiveOn.checked = settings.responsive.enabled;
    responsiveStrength.input.value = String(settings.responsive.strength);
    responsiveStrength.input.disabled = !settings.responsive.enabled;
    responsiveStrength.sync();
  };

  const read = (): Settings => normalize({
    theme: theme.value(),
    font: {
      family: family.value(),
      size: size.input.valueAsNumber,
      weight: weight.input.valueAsNumber,
      weightBold: weightBold.input.valueAsNumber,
      ligatures: ligatures.checked,
      lineHeight: lineHeight.input.valueAsNumber,
      letterSpacing: letterSpacing.input.valueAsNumber,
    },
    cursor: { style: cursorStyle.value, blink: cursorBlink.checked },
    tiling: { layout: tiling.value() },
    responsive: { enabled: responsiveOn.checked, strength: responsiveStrength.input.valueAsNumber },
    behaviour: { hoverHighlight: hoverHighlight.checked, startupSplash: startupSplash.checked },
    inactive: { opacity: inactiveOpacity.input.valueAsNumber, desaturate: inactiveDesaturate.checked },
    appIcon: appIcon.value,
    prompt: prompt.value(),
  });

  const report = (error: unknown) => {
    status.textContent = String(error);
  };

  const apply = (settings: Settings) => Promise.resolve(options.apply(settings)).catch(report);

  const change = (next: Settings) => {
    if (session.edit(next)) void apply(next);
  };

  /** Reset to defaults first asks in the footer; `focus` gives focus back to the button once answered. */
  const ask = (on: boolean, focus = false) => {
    reset.hidden = on;
    confirm.hidden = !on;
    if (on) keepSettings.focus();
    else if (focus) reset.focus();
  };

  let saving = false;
  /** While saving, nothing can be edited, so what is written is what stays applied. */
  const lock = (on: boolean) => {
    saving = on;
    fontFields.disabled = cursorFields.disabled = inactiveFields.disabled = on;
    responsiveFields.disabled = paneFields.disabled = startupFields.disabled = on;
    appIconFields.disabled = on;
    if (on) ask(false);
    reset.disabled = save.disabled = cancel.disabled = on;
    confirmReset.disabled = keepSettings.disabled = on;
    theme.list.setAttribute("aria-disabled", String(on));
    prompt.list.setAttribute("aria-disabled", String(on));
    family.list.setAttribute("aria-disabled", String(on));
    tiling.list.setAttribute("aria-disabled", String(on));
  };

  /** Back to the settings from when the form opened, unsaved; false while saving, when nothing changes. */
  const discard = async () => {
    if (saving) return false;
    ask(false);
    const draft = session.draft;
    const saved = session.cancel();
    if (!same(draft, saved)) await apply(saved);
    return true;
  };

  /** Cancel, Esc and ×: back to the opening settings, then close. */
  const revert = async () => {
    if (await discard()) close();
  };

  /** Save: write the previewed settings and close; on failure stay open with the error. */
  const commit = async () => {
    if (saving) return;
    lock(true);
    const written = session.draft;
    try {
      await options.save(written);
      session.commit(written);
      status.textContent = "";
      close();
    } catch (error) {
      report(error);
    } finally {
      lock(false);
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
  reset.addEventListener("click", () => ask(true));
  confirmReset.addEventListener("click", () => {
    change(DEFAULT_SETTINGS);
    show(session.draft);
    ask(false, true);
  });
  keepSettings.addEventListener("click", () => ask(false, true));
  // Esc while asking cancels the question, not the dialogue, wherever focus is: caught on the way down, a
  // prevented keydown keeps the dialogue's cancel from firing, and the page's Esc handler skips it.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || confirm.hidden || !form.isConnected) return;
    // A closed dialogue stays in the document; Esc then belongs to the terminal.
    if (!(form.closest("dialog")?.open ?? true)) return;
    event.preventDefault();
    event.stopPropagation();
    ask(false, true);
  }, true);
  save.addEventListener("click", () => void commit());
  cancel.addEventListener("click", () => void revert());
  closeButton.addEventListener("click", () => void revert());

  return {
    form,
    reset() {
      status.textContent = "";
      ask(false);
      showTab(0);
      // The installed fonts are listed in the background; the list refills when they are known.
      void installedMonospaceFonts().then((names) => {
        osFonts = names;
        if (form.isConnected) renderFamilies(family.value());
      });
      // Shown once on screen, so the selected theme can scroll into view.
      show(session.saved);
      theme.list.focus();
    },
    adopt(settings) {
      session.commit(settings);
      session.edit(settings);
      if (form.isConnected) show(settings);
    },
    revert,
    discard: async () => void (await discard()),
  };
}

/**
 * Builds the settings dialogue into `document.body`, drawn inside the window: where the backend cannot open a
 * settings window of its own (the dev server). Esc goes back to the opening settings like Cancel.
 */
export function createSettingsDialog(options: SettingsDialogOptions): SettingsDialog {
  const settings = createSettingsForm(options, () => dialog.close());
  const dialog = element("dialog", { className: "settings" }, settings.form);
  dialog.setAttribute("aria-label", "Settings");
  document.body.append(dialog);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    void settings.revert();
  });
  dialog.addEventListener("close", () => options.onClose());
  return {
    open() {
      if (dialog.open) return;
      dialog.showModal();
      settings.reset();
    },
    adopt: (next) => settings.adopt(next),
  };
}

/**
 * Builds the settings form as the whole of `parent`, the page of a settings window: the window's own title bar
 * moves and closes it. Esc goes back to the opening settings like Cancel.
 */
export function mountSettingsPage(parent: HTMLElement, options: SettingsDialogOptions): SettingsPage {
  const settings = createSettingsForm(options, () => options.onClose());
  const page = element("main", { className: "settings settings-page" }, settings.form);
  page.setAttribute("aria-label", "Settings");
  parent.replaceChildren(page);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    void settings.revert();
  });
  settings.reset();
  return { adopt: (next) => settings.adopt(next), discard: () => settings.discard() };
}
