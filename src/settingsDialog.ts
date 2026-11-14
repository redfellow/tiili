import { gridFor, TILING_MODES, type TilingMode } from "./layout";
import { MIN_RESPONSIVE_LINE_HEIGHT, MIN_RESPONSIVE_SIZE, RESPONSIVE_STRENGTH } from "./responsive";
import {
  APP_ICONS, type AppIcon, CURSOR_STYLES, type CursorStyle, DEFAULT_FONT_FAMILY, DEFAULT_SETTINGS, FONT_RANGES,
  fontFamilyList, INACTIVE_OPACITY, normalize, type PromptId, type Settings,
} from "./settings";
import { PROMPT_STYLES, type PromptSegment } from "./promptStyles";
import { REMOTE_SNIPPETS, type RemoteShell } from "./remoteSnippets";
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

/** The text the Ligatures example and the preview draw, rich in the pairs coding fonts join. */
const LIGATURE_SAMPLE = "-> => != === <= >= ::";

/** The preview's terminal is drawn no bigger than this, so a large font still fits the strip. */
const PREVIEW_MAX_SIZE = 18;

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
  /** Puts text on the clipboard, for the Remote shells snippet's Copy button. */
  copy: (text: string) => Promise<void>;
  /**
   * Checks for a new version now, ignoring the daily limit and a skipped version, and opens the update dialog when
   * there is one; resolves whether there was. Without it (the dev server) there is no Check now button.
   */
  checkForUpdates?: () => Promise<boolean>;
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
  /** Fills the form with the saved settings on its first tab, focuses the theme grid and lists installed fonts. */
  reset(): void;
  adopt(settings: Settings): void;
  /** Cancel and Esc: back to the opening settings, unsaved, then closes. */
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

function numberInput(name: string, range: { min: number; max: number; step: number }): HTMLInputElement {
  return element("input", {
    type: "number", name, min: String(range.min), max: String(range.max), step: String(range.step),
  });
}

/** A slider with a filled track and a live readout; `input` is the range, `control` the pair to put in a row. */
function rangeInput(name: string, label: string, range: { min: number; max: number; step: number }) {
  const input = numberInput(name, range);
  input.type = "range";
  input.setAttribute("aria-label", label);
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

const CURSOR_LABELS: Record<CursorStyle, string> = { block: "Brick", underline: "Underline", bar: "Bar" };
const APP_ICON_LABELS: Record<AppIcon, string> = { system: "System", light: "Light", dark: "Dark" };

/** The "DEFAULT" tag on the default choice's card or row. */
function defaultTag(): HTMLElement {
  return element("span", { className: "settings-tag" }, "DEFAULT");
}

let tooltipCount = 0;

/** An ⓘ button whose tooltip, shown on hover and keyboard focus, holds `hint`; the tooltip also describes the button. */
function infoButton(about: string, hint: string): HTMLElement {
  const tip = element("span", { className: "settings-tooltip", id: `settings-tip-${tooltipCount++}` }, hint);
  tip.setAttribute("role", "tooltip");
  const button = element("button", { type: "button", className: "settings-info" }, "ⓘ");
  button.setAttribute("aria-label", `About ${about}`);
  button.setAttribute("aria-describedby", tip.id);
  return element("span", { className: "settings-info-wrap" }, button, tip);
}

/** A section: its heading, with an ⓘ hint beside it when given, then its contents. */
function section(title: string, hint: string | undefined, ...children: HTMLElement[]): HTMLFieldSetElement {
  const legend = element("legend", {}, element("span", {}, title));
  if (hint) legend.append(infoButton(title, hint));
  return element("fieldset", {}, legend, ...children);
}

/** A label on the left and its controls in a line on the right. */
function row(label: string, ...controls: (HTMLElement | string)[]): HTMLElement {
  return element("div", { className: "settings-row" },
    element("span", { className: "settings-row-label" }, label),
    element("div", { className: "settings-row-controls" }, ...controls));
}

/** A checkbox with its text after it. */
function check(input: HTMLInputElement, text: string): HTMLLabelElement {
  return element("label", { className: "settings-check" }, input, element("span", {}, text));
}

/**
 * A segmented control: a radio group of buttons, one checked. Left/Right (and Up/Down) move the choice round, Home
 * and End go to the ends, and Tab reaches the checked button. `onChange` runs when the user picks another one.
 */
function segmented<T extends string>(
  label: string,
  choices: readonly { value: T; label: string }[],
  onChange: () => void,
) {
  let value = choices[0].value;
  const buttons = choices.map((choice) => {
    const button = element("button", { type: "button", className: "settings-segment" }, choice.label);
    button.setAttribute("role", "radio");
    return button;
  });
  const el = element("div", { className: "settings-segmented" }, ...buttons);
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", label);

  /** Checks `next`, without telling `onChange`. */
  const set = (next: T) => {
    value = next;
    buttons.forEach((button, i) => {
      const on = choices[i].value === next;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    });
  };
  const pick = (index: number, focus: boolean) => {
    const i = (index + choices.length) % choices.length;
    if (choices[i].value !== value) {
      set(choices[i].value);
      onChange();
    }
    if (focus) buttons[i].focus();
  };
  buttons.forEach((button, i) => {
    button.addEventListener("click", () => pick(i, false));
    button.addEventListener("keydown", (event) => {
      const moves: Record<string, number> = {
        ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: choices.length - 1,
      };
      const next = moves[event.key];
      if (next === undefined) return;
      event.preventDefault();
      pick(next, true);
    });
  });
  set(value);
  return {
    el,
    value: () => value,
    set,
    setDisabled: (disabled: boolean) => buttons.forEach((button) => (button.disabled = disabled)),
  };
}

interface PickItem { id: string; name: string }
interface PickGroup { label?: string; items: PickItem[] }

/**
 * A focusable single-select list in groups, for font families. Up/Down, Home/End and clicks select at once (the
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

/**
 * A focusable single-select grid of cards, for themes, prompts and tiling. Left/Right move one card, Up/Down one row
 * (as many cards as the grid has columns), Home/End go to the first and last card, all stopping at the ends; clicks
 * select. Each selection applies at once unless `locked`. `render` fills each card.
 */
function cardGrid(
  label: string,
  className: string,
  items: PickItem[],
  onSelect: () => void,
  locked: () => boolean,
  render: (card: HTMLElement, item: PickItem) => void,
) {
  let value = "";
  const grid = element("div", { className: `settings-cards ${className}`, tabIndex: 0 });
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", label);
  const cards = items.map((item, i) => {
    const card = element("div", { className: "settings-card", id: `${label.replace(/\s+/g, "-")}-card-${i}` });
    card.setAttribute("role", "option");
    card.dataset.id = item.id;
    render(card, item);
    return card;
  });
  grid.append(...cards);

  /** Marks `id` selected, without applying it. */
  const show = (id: string) => {
    value = id;
    cards.forEach((card, i) => {
      const selected = items[i].id === id;
      card.setAttribute("aria-selected", String(selected));
      if (selected) grid.setAttribute("aria-activedescendant", card.id);
    });
  };
  const select = (index: number) => {
    const id = items[index]?.id;
    if (id === undefined || id === value || locked()) return;
    show(id);
    cards[index].scrollIntoView({ block: "nearest" });
    onSelect();
  };
  /** How many cards a row holds, counted from the grid's laid-out column tracks. */
  const columns = () => {
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(" ").filter((t) => t && t !== "none");
    return Math.max(1, tracks.length);
  };

  grid.addEventListener("keydown", (event) => {
    const index = items.findIndex((i) => i.id === value);
    const last = items.length - 1;
    const cols = columns();
    const rowOf = (i: number) => Math.floor(i / cols);
    // Down from a row above a short last row lands on the last card rather than nowhere.
    const down = index + cols <= last ? index + cols : rowOf(index) < rowOf(last) ? last : index;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, index - 1),
      ArrowRight: Math.min(last, index + 1),
      ArrowUp: index - cols >= 0 ? index - cols : index,
      ArrowDown: down,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  });
  grid.addEventListener("click", (event) => {
    const card = (event.target as Element).closest<HTMLElement>("[role=option]");
    if (!card) return;
    grid.focus();
    select(items.findIndex((i) => i.id === card.dataset.id));
  });

  /** The selected card, scrolled into view. */
  const reveal = () => cards[items.findIndex((i) => i.id === value)]?.scrollIntoView({ block: "nearest" });
  return { grid, show, reveal, value: () => value };
}

/** The theme grid: System first, then the dark themes, then the light ones, each card in its terminal colours. */
function themeGrid(onSelect: () => void, locked: () => boolean) {
  const byId = new Map<string, Theme>(THEMES.map((t) => [t.id, t]));
  const light = byId.get("tiili-light")!.tokens;
  const dark = byId.get("tiili-dark")!.tokens;
  const of = (kind: Theme["kind"]) => THEMES.filter((t) => t.kind === kind).map(({ id, name }) => ({ id, name }));
  const items = [...of("system"), ...of("dark"), ...of("light")];
  return cardGrid("Theme", "settings-theme-cards", items, onSelect, locked, (card, item) => {
    const theme = byId.get(item.id)!;
    // System shows the brand light and dark grounds side by side. Its name sits on the light (left) half, so it takes
    // the light theme's text colour; the stripe uses the dark theme's ANSI colours.
    const tokens = theme.kind === "system" ? dark : theme.tokens;
    card.style.setProperty("--card-bg", theme.kind === "system"
      ? `linear-gradient(115deg, ${light["--term-bg"]} 50%, ${dark["--term-bg"]} 50%)`
      : tokens["--term-bg"]!);
    card.style.setProperty("--card-fg", (theme.kind === "system" ? light : tokens)["--term-fg"]!);
    const stripe = element("span", { className: "settings-theme-stripe" },
      ...[1, 2, 3, 4, 5, 6].map((i) => {
        const dot = element("span");
        dot.style.background = tokens[`--ansi-${i}` as "--ansi-1"]!;
        return dot;
      }));
    stripe.setAttribute("aria-hidden", "true");
    card.append(element("span", { className: "settings-card-name" }, item.name), stripe);
    if (item.id === DEFAULT_SETTINGS.theme) card.append(defaultTag());
  });
}

/** Runs of prompt text in the current theme's terminal colours, so they follow theme changes. */
function promptRuns(line: PromptSegment[]): HTMLElement[] {
  return line.map(({ text, ansi }) => {
    const run = element("span", {}, text);
    run.style.color = ansi === "fg" ? "var(--term-fg)" : `var(--ansi-${ansi})`;
    return run;
  });
}

/** A prompt drawn line by line in the current theme's terminal ground and ANSI colours. */
function promptPreview(lines: PromptSegment[][]): HTMLElement {
  const preview = element("span", { className: "settings-prompt-preview" },
    ...lines.map((line) => element("span", {}, ...promptRuns(line))));
  preview.setAttribute("aria-hidden", "true");
  return preview;
}

/** The prompt grid: one row of cards, Off first, each showing what its prompt looks like. */
function promptGrid(onSelect: () => void, locked: () => boolean) {
  const byId = new Map(PROMPT_STYLES.map((style) => [style.id as string, style]));
  const items = PROMPT_STYLES.map(({ id, label }) => ({ id, name: label }));
  return cardGrid("Prompt", "settings-prompt-cards", items, onSelect, locked, (card, item) => {
    const style = byId.get(item.id)!;
    const preview = style.preview.length > 0
      ? promptPreview(style.preview)
      : element("span", { className: "settings-prompt-preview settings-prompt-own" }, "your shell's own");
    card.append(element("span", { className: "settings-card-name" }, item.name), preview);
    if (item.id === DEFAULT_SETTINGS.prompt) card.append(defaultTag());
  });
}

/** The lines a prompt draws before a command: its preview, or a plain `$` for the shell's own. */
function promptLines(id: PromptId): PromptSegment[][] {
  const style = PROMPT_STYLES.find((s) => s.id === id);
  return style && style.preview.length > 0 ? style.preview : [[{ text: "$", ansi: "fg" }]];
}

type TermColour = number | "fg" | "dim";

/** One terminal line from runs of text, each in an ANSI slot, the terminal text colour or its dim colour. */
function termLine(...runs: [string, TermColour, boolean?][]): HTMLElement {
  return element("div", { className: "settings-preview-line" }, ...runs.map(([text, colour, bold]) => {
    const span = element("span", { className: bold ? "settings-preview-bold" : "" }, text);
    span.style.color = colour === "fg" ? "var(--term-fg)" : colour === "dim" ? "var(--term-dim)" : `var(--ansi-${colour})`;
    return span;
  }));
}

/** The prompt with `command` typed after it, its output, then the prompt again, ending in `cursor` when given. */
function terminalRun(prompt: PromptSegment[][], command: string, output: HTMLElement[], cursor?: HTMLElement) {
  const promptWith = (text: string, end?: HTMLElement) => prompt.map((line, i) => {
    const el = element("div", { className: "settings-preview-line" }, ...promptRuns(line));
    if (i === prompt.length - 1) {
      el.append(element("span", {}, ` ${text}`));
      if (end) el.append(end);
    }
    return el;
  });
  return [...promptWith(command), ...output, ...promptWith("", cursor)];
}

/**
 * Builds the settings form: tabs for Style (Theme, Prompt, Terminal), Typography (Font) and Behaviour (Tiling, Panes,
 * App, Remote shells) at the top, a live preview under them on Style and Typography, the selected tab's body, which
 * alone scrolls, and a footer with Reset to defaults, Cancel and Save. Every change applies at once as a preview;
 * only Save writes it, and Cancel and Esc go back to the opening settings. Either one then calls `close`.
 */
function createSettingsForm(options: SettingsDialogOptions, close: () => void): SettingsForm {
  const session = createSettingsSession(options.initial);
  const changed = () => change(read());
  const locked = () => saving;

  const theme = themeGrid(changed, locked);
  const prompt = promptGrid(changed, locked);
  let osFonts: string[] = [];
  const family = pickList("Font family", changed, locked, (row, item) => {
    row.style.fontFamily = `"${item.name}", monospace`;
    row.append(element("span", {}, item.name));
    if (item.id === DEFAULT_FONT_FAMILY) row.append(defaultTag());
  });
  /** Fills the family list: a Bundled and an OS group, with `selected` kept even if it is in neither. */
  const renderFamilies = (selected: string) => {
    const listed = (names: string[]) => names.map((name) => ({ id: name, name }));
    const os = osFonts.includes(selected) || BUNDLED_FONTS.includes(selected) ? osFonts : [...osFonts, selected];
    family.setGroups([{ label: "Bundled", items: listed(BUNDLED_FONTS) }, { label: "OS", items: listed(os) }]);
    family.show(selected);
  };
  const tilingItems = TILING_MODES.map((id) => ({ id, name: TILING_LABELS[id] }));
  const tiling = cardGrid("Tiling", "settings-tiling-cards", tilingItems, changed, locked, (card, item) => {
    card.append(tilingIcon(item.id as TilingMode), element("span", { className: "settings-card-name" }, item.name));
    if (item.id === DEFAULT_SETTINGS.tiling.layout) card.append(defaultTag());
  });
  const responsiveOn = element("input", { type: "checkbox", name: "responsiveEnabled" });
  const responsiveStrength = rangeInput("responsiveStrength", "Strength", RESPONSIVE_STRENGTH);
  const size = rangeInput("size", "Size", FONT_RANGES.size);
  const weight = rangeInput("weight", "Weight", FONT_RANGES.weight);
  const weightBold = rangeInput("weightBold", "Bold weight", FONT_RANGES.weightBold);
  const ligatures = element("input", { type: "checkbox", name: "ligatures" });
  const ligatureExample = element("span", { className: "settings-ligature-example" }, LIGATURE_SAMPLE);
  ligatureExample.setAttribute("aria-hidden", "true");
  const lineHeight = rangeInput("lineHeight", "Line height", FONT_RANGES.lineHeight);
  const letterSpacing = rangeInput("letterSpacing", "Letter spacing", FONT_RANGES.letterSpacing);
  const cursorStyle = segmented("Cursor style",
    CURSOR_STYLES.map((value) => ({ value, label: CURSOR_LABELS[value] })), changed);
  const cursorBlink = element("input", { type: "checkbox", name: "cursorBlink" });
  const inactiveOpacity = rangeInput("inactiveOpacity", "Opacity", INACTIVE_OPACITY);
  const inactiveDesaturate = element("input", { type: "checkbox", name: "inactiveDesaturate" });
  const hoverHighlight = element("input", { type: "checkbox", name: "hoverHighlight" });
  const startupSplash = element("input", { type: "checkbox", name: "startupSplash" });
  const updatesAuto = element("input", { type: "checkbox", name: "updatesAutoCheck" });
  const appIcon = segmented("Dock icon", APP_ICONS.map((value) => ({ value, label: APP_ICON_LABELS[value] })), changed);
  const status = element("p", { className: "settings-status" });
  status.setAttribute("role", "status");

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

  // The live preview: an active pane that ran git log and an inactive one running the dev server.
  const preview = element("div", { className: "settings-preview" });
  preview.setAttribute("aria-hidden", "true");
  const renderPreview = (settings: Settings) => {
    const { font, cursor, inactive } = settings;
    preview.style.fontFamily = fontFamilyList(font.family);
    preview.style.fontSize = `${Math.min(font.size, PREVIEW_MAX_SIZE)}px`;
    preview.style.fontWeight = String(font.weight);
    preview.style.setProperty("--preview-bold", String(font.weightBold));
    preview.style.lineHeight = String(font.lineHeight);
    preview.style.letterSpacing = `${font.letterSpacing}px`;
    preview.style.fontVariantLigatures = font.ligatures ? "normal" : "none";
    ligatureExample.style.fontFamily = preview.style.fontFamily;
    ligatureExample.style.fontVariantLigatures = preview.style.fontVariantLigatures;
    const lines = promptLines(settings.prompt);
    const caret = element("span", { className: "settings-preview-cursor" });
    caret.dataset.style = cursor.style;
    caret.classList.toggle("settings-preview-blink", cursor.blink);
    const active = element("div", { className: "settings-preview-pane settings-preview-active" },
      ...terminalRun(lines, "git log --oneline -2", [
        termLine(["3f9c2a1", 3], [" (", "fg"], ["HEAD -> main", 6, true], [") ", "fg"], ["Tile panes as bricks", "fg"]),
        termLine(["a7d04e8", 3], [" Map keys => escape codes", "fg"]),
      ], caret));
    const idle = element("div", { className: "settings-preview-pane" },
      ...terminalRun(lines, "npm run dev", [
        termLine(["> tiili@", "dim"], [APP_VERSION, "dim"], [" dev", "dim"]),
        termLine(["  VITE ", 2, true], ["ready in ", "fg"], ["312 ms", "fg", true]),
        termLine(["  ➜  Local: ", "fg"], ["http://localhost:1420/", 4]),
      ]));
    idle.style.opacity = String(inactive.opacity);
    idle.style.filter = inactive.desaturate ? "grayscale(1)" : "none";
    preview.replaceChildren(active, idle);
  };

  const styleFields = [
    section("Theme", undefined, theme.grid),
    section("Prompt",
      "Applies to open panes and new ones. A prompt set in your own shell config (PROMPT, PS1 or a prompt " +
      "function) always wins.",
      prompt.grid),
    section("Terminal", undefined,
      row("Cursor", cursorStyle.el, check(cursorBlink, "Blink")),
      row("Inactive panes", element("span", { className: "settings-row-sub" }, "Opacity"), inactiveOpacity.control,
        check(inactiveDesaturate, "Desaturate")),
      ...(options.showAppIcon ? [row("Dock icon", appIcon.el)] : [])),
  ];

  const familyColumn = element("div", { className: "settings-font-family" }, family.list);
  const fontFields = section("Font", undefined,
    element("div", { className: "settings-font" },
      familyColumn,
      element("div", { className: "settings-font-rows" },
        row("Size (px)", size.control),
        row("Weight", weight.control),
        row("Bold weight", weightBold.control),
        row("Line height", lineHeight.control),
        row("Letter spacing (px)", letterSpacing.control),
        row("Ligatures", check(ligatures, "On"), ligatureExample))));

  const checkNow = element("button", { type: "button", className: "settings-check-updates" }, "Check now");
  const checkResult = element("span", { className: "settings-update-result" });
  checkResult.setAttribute("role", "status");
  checkNow.addEventListener("click", () => {
    const run = options.checkForUpdates;
    if (!run) return;
    checkNow.disabled = true;
    checkResult.textContent = "Checking…";
    run()
      .then((found) => {
        checkResult.textContent = found ? "" : "tiili is up to date.";
      })
      .catch(() => {
        checkResult.textContent = "Couldn't check for updates.";
      })
      .finally(() => {
        checkNow.disabled = false;
      });
  });

  // Nothing here is saved: the snippet is only shown and copied.
  const snippet = element("pre", { className: "settings-snippet", tabIndex: 0 });
  const shell = segmented<RemoteShell>("Shell",
    REMOTE_SNIPPETS.map(({ shell: value }) => ({ value, label: value })), () => showSnippet());
  const showSnippet = () => {
    snippet.textContent = REMOTE_SNIPPETS.find((s) => s.shell === shell.value())?.text ?? "";
  };
  const copy = element("button", { type: "button", className: "settings-copy" }, "Copy");
  copy.setAttribute("aria-label", "Copy the snippet");
  copy.addEventListener("click", () => void options.copy(snippet.textContent ?? "").catch(() => {}));

  const behaviourFields = [
    section("Tiling", "How panes are arranged as you open and close them.", tiling.grid),
    section("Panes", undefined,
      row("Responsive text", check(responsiveOn, "Shrink text in small panes"),
        element("span", { className: "settings-row-sub" }, "Strength"), responsiveStrength.control,
        infoButton("Responsive text",
          `Font size, line height and (slightly) letter spacing shrink as a pane gets smaller than the window, down ` +
          `to ${MIN_RESPONSIVE_SIZE} px and a line height of ${MIN_RESPONSIVE_LINE_HEIGHT}. Higher strength shrinks ` +
          "faster.")),
      row("Hover", check(hoverHighlight, "Highlight the terminal under the mouse"))),
    section("App", undefined,
      row("Startup", check(startupSplash, "Play the tiili splash when tiili opens"),
        infoButton("Startup", "Any key or click skips it.")),
      row("Updates", check(updatesAuto, "Check automatically"),
        ...(options.checkForUpdates ? [checkNow, checkResult] : []),
        infoButton("Updates",
          "Once a day, when tiili opens, it asks GitHub for the latest version: one anonymous request."))),
    section("Remote shells",
      "Add the snippet for your shell to a remote machine's shell startup file, and a pane that connects there " +
      "shows that machine's folder and repository. tmux and screen on the remote machine hide it.",
      element("div", { className: "settings-snippet-head" }, shell.el, copy),
      snippet),
  ];

  const stylePanel = element("div", { className: "settings-panel", id: "settings-panel-style" }, ...styleFields);
  const typography = element("div", { className: "settings-panel", id: "settings-panel-typography" }, fontFields);
  const behaviour = element("div", { className: "settings-panel", id: "settings-panel-behaviour" },
    ...behaviourFields);
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
  const body = element("div", { className: "settings-body" }, stylePanel, typography, behaviour, status);
  /** Shows tab `index` and its panel, with the preview on all but Behaviour; `focus` moves the keyboard to the tab. */
  const showTab = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    preview.hidden = panels[index] === behaviour;
    body.scrollTop = 0;
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

  const form = element("form", { method: "dialog", className: "settings-form" },
    tabList,
    preview,
    body,
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
    cursorStyle.set(settings.cursor.style);
    cursorBlink.checked = settings.cursor.blink;
    inactiveOpacity.input.value = String(settings.inactive.opacity);
    inactiveOpacity.sync();
    inactiveDesaturate.checked = settings.inactive.desaturate;
    hoverHighlight.checked = settings.behaviour.hoverHighlight;
    startupSplash.checked = settings.behaviour.startupSplash;
    updatesAuto.checked = settings.updates.autoCheck;
    appIcon.set(settings.appIcon);
    tiling.show(settings.tiling.layout);
    responsiveOn.checked = settings.responsive.enabled;
    responsiveStrength.input.value = String(settings.responsive.strength);
    responsiveStrength.input.disabled = !settings.responsive.enabled;
    responsiveStrength.sync();
    renderPreview(settings);
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
    cursor: { style: cursorStyle.value(), blink: cursorBlink.checked },
    tiling: { layout: tiling.value() },
    responsive: { enabled: responsiveOn.checked, strength: responsiveStrength.input.valueAsNumber },
    behaviour: { hoverHighlight: hoverHighlight.checked, startupSplash: startupSplash.checked },
    inactive: { opacity: inactiveOpacity.input.valueAsNumber, desaturate: inactiveDesaturate.checked },
    appIcon: appIcon.value(),
    prompt: prompt.value(),
    updates: { autoCheck: updatesAuto.checked },
  });

  const report = (error: unknown) => {
    status.textContent = String(error);
  };

  /** Applies `settings` live and redraws the preview from them. */
  const apply = (settings: Settings) => {
    renderPreview(settings);
    return Promise.resolve(options.apply(settings)).catch(report);
  };

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
    // A disabled section disables its checkboxes, sliders, segment buttons, Copy and Check now.
    for (const fields of [...styleFields, fontFields, ...behaviourFields]) fields.disabled = on;
    for (const control of [cursorStyle, appIcon, shell]) control.setDisabled(on);
    if (on) ask(false);
    reset.disabled = save.disabled = cancel.disabled = on;
    confirmReset.disabled = keepSettings.disabled = on;
    for (const list of [theme.grid, prompt.grid, family.list, tiling.grid]) {
      list.setAttribute("aria-disabled", String(on));
    }
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

  /** Cancel and Esc: back to the opening settings, then close. */
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
  form.addEventListener("input", changed);
  form.addEventListener("change", () => {
    changed();
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

  return {
    form,
    reset() {
      status.textContent = "";
      checkResult.textContent = "";
      shell.set("bash");
      showSnippet();
      ask(false);
      showTab(0);
      // The installed fonts are listed in the background; the list refills when they are known.
      void installedMonospaceFonts().then((names) => {
        osFonts = names;
        if (form.isConnected) renderFamilies(family.value());
      });
      // Shown once on screen, so the selected theme card can scroll into view.
      show(session.saved);
      theme.grid.focus();
      theme.reveal();
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
  const dialog = element("dialog", { className: "settings settings-dialog" }, settings.form);
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
