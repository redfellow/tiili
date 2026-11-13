# Design reference

Prototype diffs from Design view, made on hv/main at 0a4aa541, in the order they were accepted. A reference, not a patch: later changes build on earlier ones.

## Settings is now better but I don't like the selected left border visual.  Mak…

```diff
diff --git a/src/layout.ts b/src/layout.ts
index 9a8ca89..24fc5de 100644
--- a/src/layout.ts
+++ b/src/layout.ts
@@ -13,12 +13,35 @@ export interface Grid {
 }
 
 /**
- * The grid for `n` panes: columns = ceil(sqrt(n)), rows = ceil(n / columns), filled left to right,
- * top to bottom. The panes of an unfilled last row share the full width between them.
+ * How panes are tiled: `grid` is as square as it gets, `wide` and `tall` lean towards more columns or more rows,
+ * `columns` puts the panes side by side and `rows` stacks them.
  */
-export function gridFor(n: number): Grid {
+export const TILING_MODES = ["grid", "wide", "tall", "columns", "rows"] as const;
+export type TilingMode = (typeof TILING_MODES)[number];
+
+/** How many grid columns `n` panes get in `mode`. */
+function columnsFor(n: number, mode: TilingMode): number {
+  switch (mode) {
+    case "columns":
+      return n;
+    case "rows":
+      return 1;
+    case "wide":
+      return Math.ceil(n / Math.max(1, Math.floor(Math.sqrt(n))));
+    case "tall":
+      return Math.max(1, Math.floor(Math.sqrt(n)));
+    default:
+      return Math.ceil(Math.sqrt(n));
+  }
+}
+
+/**
+ * The grid for `n` panes in `mode` (default `grid`: columns = ceil(sqrt(n))), rows = ceil(n / columns), filled
+ * left to right, top to bottom. The panes of an unfilled last row share the full width between them.
+ */
+export function gridFor(n: number, mode: TilingMode = "grid"): Grid {
   if (n <= 0) return { cols: 0, rows: 0, cells: [] };
-  const cols = Math.ceil(Math.sqrt(n));
+  const cols = columnsFor(n, mode);
   const rows = Math.ceil(n / cols);
   const cells: Cell[] = [];
   for (let i = 0; i < n; i++) {
diff --git a/src/layout/model.ts b/src/layout/model.ts
index 1ed88a8..d75dd77 100644
--- a/src/layout/model.ts
+++ b/src/layout/model.ts
@@ -1,4 +1,4 @@
-import { gridFor } from "../layout";
+import { gridFor, type TilingMode } from "../layout";
 
 export type PaneId = number;
 export type Axis = "col" | "row";
@@ -9,6 +9,8 @@ export type Direction = "left" | "right" | "up" | "down";
  * row as fractions that sum to 1. The panes of a short last row share its full width equally.
  */
 export interface LayoutState {
+  /** How the panes are tiled; the automatic grid when absent. */
+  mode?: TilingMode;
   order: PaneId[];
   cols: number;
   rows: number;
@@ -31,14 +33,20 @@ function equal(count: number): number[] {
 }
 
 /** An empty layout. */
-export function emptyLayout(): LayoutState {
-  return { order: [], cols: 0, rows: 0, colSizes: [], rowSizes: [] };
+export function emptyLayout(mode: TilingMode = "grid"): LayoutState {
+  return { mode, order: [], cols: 0, rows: 0, colSizes: [], rowSizes: [] };
+}
+
+/** The same panes tiled in `mode`; tracks whose count stays the same keep their sizes. */
+export function setMode(state: LayoutState, mode: TilingMode): LayoutState {
+  return reflow({ ...state, mode }, state.order);
 }
 
 /** `order` laid out on the automatic grid, keeping `prev`'s sizes for each axis whose track count is unchanged. */
 function reflow(prev: LayoutState, order: PaneId[]): LayoutState {
-  const { cols, rows } = gridFor(order.length);
+  const { cols, rows } = gridFor(order.length, prev.mode);
   return {
+    mode: prev.mode,
     order,
     cols,
     rows,
diff --git a/src/layout/view.ts b/src/layout/view.ts
index 622eb85..8ba8d70 100644
--- a/src/layout/view.ts
+++ b/src/layout/view.ts
@@ -152,10 +152,14 @@ export class TileView {
     divider.addEventListener("pointercancel", onEnd);
   }
 
-  /** Highlights the pane under the pointer while a grab strip is dragged, and swaps with it on drop. */
+  /**
+   * While a grab strip is dragged, shows a ghost label following the pointer with the source pane dimmed, so the
+   * drag is visible from the first pixels; highlights the pane under the pointer and swaps with it on drop.
+   */
   private dragPane(grab: HTMLElement, source: HTMLElement, down: PointerEvent): void {
     const from = Number(source.dataset[PANE_ID]);
     let target: HTMLElement | undefined;
+    let ghost: HTMLElement | undefined;
     grab.setPointerCapture(down.pointerId);
 
     const mark = (pane: HTMLElement | undefined) => {
@@ -164,7 +168,18 @@ export class TileView {
       target = pane;
       target?.toggleAttribute("data-drop-target", true);
     };
+    /** The drag has begun once the pointer has moved a few pixels: until then a click is just a click. */
+    const begin = () => {
+      ghost = document.createElement("div");
+      ghost.className = "pane-drag-ghost";
+      ghost.textContent = source.querySelector(".pane-chip")?.textContent?.trim() || "Terminal";
+      document.body.append(ghost);
+      source.toggleAttribute("data-drag-source", true);
+      document.documentElement.toggleAttribute("data-pane-dragging", true);
+    };
     const onMove = (event: PointerEvent) => {
+      if (!ghost && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > 3) begin();
+      if (ghost) ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
       const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".pane");
       mark(under && under !== source && this.root.contains(under) ? under : undefined);
     };
@@ -174,6 +189,9 @@ export class TileView {
       grab.removeEventListener("pointercancel", onCancel);
       const to = target ? Number(target.dataset[PANE_ID]) : undefined;
       mark(undefined);
+      ghost?.remove();
+      source.toggleAttribute("data-drag-source", false);
+      document.documentElement.toggleAttribute("data-pane-dragging", false);
       if (drop && to !== undefined) this.hooks.swap(from, to);
     };
     const onUp = () => finish(true);
diff --git a/src/panes.ts b/src/panes.ts
index 2af62f3..a6c2caf 100644
--- a/src/panes.ts
+++ b/src/panes.ts
@@ -8,6 +8,7 @@ import {
   move,
   removePane,
   reset,
+  setMode,
   swap,
   type LayoutState,
   type PaneId,
@@ -72,6 +73,15 @@ export class Panes {
       },
       swap: (from, to) => this.relayout(swap(this.layout, from, to)),
     });
+    this.layout = emptyLayout(settings().tiling.layout);
+    this.styleRoot(settings());
+  }
+
+  /** Sets the pane-wide looks the stylesheet reads from `root`: hover highlight and inactive panes. */
+  private styleRoot(settings: Settings): void {
+    this.root.toggleAttribute("data-hover-highlight", settings.behaviour.hoverHighlight);
+    this.root.toggleAttribute("data-desaturate", settings.inactive.desaturate);
+    this.root.style.setProperty("--inactive-opacity", String(settings.inactive.opacity));
   }
 
   /**
@@ -228,6 +238,10 @@ export class Panes {
 
   /** Restyles every open pane after the settings changed; `themeChanged` re-reads the theme colours too. */
   async applySettings(settings: Settings, themeChanged: boolean): Promise<void> {
+    this.styleRoot(settings);
+    if ((this.layout.mode ?? "grid") !== settings.tiling.layout) {
+      this.relayout(setMode(this.layout, settings.tiling.layout));
+    }
     const terminals = await Promise.all(this.panes.map((pane) => pane.ready));
     await Promise.all(
       terminals.map(async (terminal) => {
diff --git a/src/responsive.ts b/src/responsive.ts
new file mode 100644
index 0000000..6f0c5f4
--- /dev/null
+++ b/src/responsive.ts
@@ -0,0 +1,53 @@
+/** Text never shrinks below this many pixels, however small the pane. */
+export const MIN_RESPONSIVE_SIZE = 7;
+
+/** Line height never shrinks below this: xterm refuses anything under 1 ("lineHeight cannot be less than 1"). */
+export const MIN_RESPONSIVE_LINE_HEIGHT = 1;
+
+/** How strongly text shrinks with pane size: 0 not at all, 1 in proportion to the pane's width, 2 twice as fast. */
+export const RESPONSIVE_STRENGTH = { min: 0, max: 2, step: 0.05 } as const;
+
+export interface ResponsiveSettings {
+  enabled: boolean;
+  strength: number;
+}
+
+interface Dimensions {
+  width: number;
+  height: number;
+}
+
+/** The line height shrinks this much faster than the size, and letter spacing tightens by this many px per unit. */
+const LINE_HEIGHT_BOOST = 1.3;
+const LETTER_TIGHTEN = 0.4;
+
+/**
+ * The font size, line height and letter spacing for a pane of `pane` pixels in a tiled area of `area` pixels. A
+ * pane that fills the area keeps the chosen values. A smaller pane has `drop = strength * (1 - r)`, where `r` is
+ * the pane's linear scale (the square root of its share of the area). The size scales by `1 - drop`, down to
+ * MIN_RESPONSIVE_SIZE px. The line height's excess over MIN_RESPONSIVE_LINE_HEIGHT (1) scales a little faster
+ * (`1 - 1.3 * drop`), down to that minimum, the tightest line height xterm allows. Letter spacing scales by `1 - drop` and tightens
+ * very slightly more (0.4 px per unit of drop), never below -2 px.
+ */
+export function responsiveFont(
+  font: { size: number; lineHeight: number; letterSpacing: number },
+  responsive: ResponsiveSettings,
+  pane: Dimensions,
+  area: Dimensions,
+): { size: number; lineHeight: number; letterSpacing: number } {
+  const fixed = { size: font.size, lineHeight: font.lineHeight, letterSpacing: font.letterSpacing };
+  if (!responsive.enabled || pane.width <= 0 || pane.height <= 0 || area.width <= 0 || area.height <= 0) return fixed;
+  const scale = Math.min(1, Math.sqrt((pane.width * pane.height) / (area.width * area.height)));
+  const drop = responsive.strength * (1 - scale);
+  const factor = Math.max(0, 1 - drop);
+  const lineFactor = Math.max(0, 1 - LINE_HEIGHT_BOOST * drop);
+  const floor = Math.min(font.size, MIN_RESPONSIVE_SIZE);
+  return {
+    size: Math.max(floor, Math.round(font.size * factor * 2) / 2),
+    lineHeight: Math.max(
+      Math.min(font.lineHeight, MIN_RESPONSIVE_LINE_HEIGHT),
+      Math.round((MIN_RESPONSIVE_LINE_HEIGHT + (font.lineHeight - MIN_RESPONSIVE_LINE_HEIGHT) * lineFactor) * 100) / 100,
+    ),
+    letterSpacing: drop === 0 ? font.letterSpacing : Math.max(-2, Math.round((font.letterSpacing * factor - LETTER_TIGHTEN * drop) * 100) / 100),
+  };
+}
diff --git a/src/settings.ts b/src/settings.ts
index 933de41..cb61429 100644
--- a/src/settings.ts
+++ b/src/settings.ts
@@ -1,3 +1,6 @@
+import { TILING_MODES, type TilingMode } from "./layout";
+import { RESPONSIVE_STRENGTH, type ResponsiveSettings } from "./responsive";
+
 /** Every theme a user can choose; `system` follows the OS between tiili Light and tiili Dark. */
 export const THEME_IDS = [
   "system",
@@ -41,10 +44,35 @@ export interface CursorSettings {
   blink: boolean;
 }
 
+export interface TilingSettings {
+  /** How panes are arranged: see `TILING_MODES`. */
+  layout: TilingMode;
+}
+
+export interface BehaviourSettings {
+  /** Whether the pane under the mouse pointer is highlighted. */
+  hoverHighlight: boolean;
+}
+
+export interface InactiveSettings {
+  /** How opaque panes without focus are, 0.3–1. */
+  opacity: number;
+  /** Whether panes without focus also lose colour. */
+  desaturate: boolean;
+}
+
+/** Allowed range of the inactive opacity. */
+export const INACTIVE_OPACITY = { min: 0.3, max: 1, step: 0.01 } as const;
+
 export interface Settings {
   theme: ThemeId;
   font: FontSettings;
   cursor: CursorSettings;
+  tiling: TilingSettings;
+  behaviour: BehaviourSettings;
+  inactive: InactiveSettings;
+  /** Text that shrinks in small panes. */
+  responsive: ResponsiveSettings;
 }
 
 export const DEFAULT_FONT_FAMILY = "Geist Mono";
@@ -68,6 +96,10 @@ export const DEFAULT_SETTINGS: Settings = {
     letterSpacing: 0,
   },
   cursor: { style: "block", blink: true },
+  tiling: { layout: "grid" },
+  responsive: { enabled: true, strength: 0.5 },
+  behaviour: { hoverHighlight: true },
+  inactive: { opacity: 0.82, desaturate: false },
 };
 
 /** Allowed range of each numeric font setting and the step values snap to. */
@@ -109,6 +141,10 @@ export function normalize(value: unknown): Settings {
   const font = isRecord(raw.font) ? raw.font : {};
   const defaults = DEFAULT_SETTINGS.font;
   const cursor = isRecord(raw.cursor) ? raw.cursor : {};
+  const tiling = isRecord(raw.tiling) ? raw.tiling : {};
+  const responsive = isRecord(raw.responsive) ? raw.responsive : {};
+  const behaviour = isRecord(raw.behaviour) ? raw.behaviour : {};
+  const inactive = isRecord(raw.inactive) ? raw.inactive : {};
   return {
     theme: THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : DEFAULT_SETTINGS.theme,
     font: {
@@ -126,5 +162,25 @@ export function normalize(value: unknown): Settings {
         : DEFAULT_SETTINGS.cursor.style,
       blink: typeof cursor.blink === "boolean" ? cursor.blink : DEFAULT_SETTINGS.cursor.blink,
     },
+    tiling: {
+      layout: TILING_MODES.includes(tiling.layout as TilingMode)
+        ? (tiling.layout as TilingMode)
+        : DEFAULT_SETTINGS.tiling.layout,
+    },
+    behaviour: {
+      hoverHighlight:
+        typeof behaviour.hoverHighlight === "boolean"
+          ? behaviour.hoverHighlight
+          : DEFAULT_SETTINGS.behaviour.hoverHighlight,
+    },
+    inactive: {
+      opacity: number(inactive.opacity, DEFAULT_SETTINGS.inactive.opacity, INACTIVE_OPACITY),
+      desaturate:
+        typeof inactive.desaturate === "boolean" ? inactive.desaturate : DEFAULT_SETTINGS.inactive.desaturate,
+    },
+    responsive: {
+      enabled: typeof responsive.enabled === "boolean" ? responsive.enabled : DEFAULT_SETTINGS.responsive.enabled,
+      strength: number(responsive.strength, DEFAULT_SETTINGS.responsive.strength, RESPONSIVE_STRENGTH),
+    },
   };
 }
diff --git a/src/settingsDialog.ts b/src/settingsDialog.ts
index 2ac614c..8a09f53 100644
--- a/src/settingsDialog.ts
+++ b/src/settingsDialog.ts
@@ -1,4 +1,8 @@
-import { CURSOR_STYLES, DEFAULT_FONT_FAMILY, DEFAULT_SETTINGS, FONT_RANGES, normalize, type Settings } from "./settings";
+import { gridFor, TILING_MODES, type TilingMode } from "./layout";
+import {
+  CURSOR_STYLES, DEFAULT_FONT_FAMILY, DEFAULT_SETTINGS, FONT_RANGES, INACTIVE_OPACITY, normalize, type Settings,
+} from "./settings";
+import { MIN_RESPONSIVE_LINE_HEIGHT, MIN_RESPONSIVE_SIZE, RESPONSIVE_STRENGTH } from "./responsive";
 import { createSettingsSession, same } from "./settingsSession";
 import { THEMES, type Theme } from "./themes";
 
@@ -39,8 +43,10 @@ function element<K extends keyof HTMLElementTagNameMap>(
   return el;
 }
 
-function field(label: string, control: HTMLElement): HTMLLabelElement {
-  return element("label", { className: "settings-field" }, element("span", {}, label), control);
+/** A label and its control side by side, or with the control under the label when `stacked`. */
+function field(label: string, control: HTMLElement, stacked = false): HTMLLabelElement {
+  const className = stacked ? "settings-field settings-field-stacked" : "settings-field";
+  return element("label", { className }, element("span", {}, label), control);
 }
 
 function numberInput(name: string, range: { min: number; max: number; step: number }): HTMLInputElement {
@@ -101,7 +107,38 @@ async function installedMonospaceFonts(): Promise<string[]> {
   return names.filter((n) => !BUNDLED_FONTS.includes(n)).sort((a, b) => a.localeCompare(b));
 }
 
-const CURSOR_LABELS = { block: "Brick (block)", underline: "Underline", bar: "Bar" } as const;
+/** Adds the muted "(default)" after a row's name. */
+function markDefault(row: HTMLElement): void {
+  row.append(element("span", { className: "settings-default" }, "(default)"));
+}
+
+const TILING_LABELS: Record<TilingMode, string> = {
+  grid: "Grid",
+  wide: "Wide grid",
+  tall: "Tall grid",
+  columns: "Side by side",
+  rows: "Stacked",
+};
+
+/** A tiny picture of how seven panes tile in `mode`, drawn as bricks. */
+function tilingIcon(mode: TilingMode): HTMLElement {
+  const { cols, rows, cells } = gridFor(7, mode);
+  const [width, height, gap] = [30, 18, 1];
+  const rects = cells.map((cell) => {
+    const w = (width - (cols - 1) * gap) / cols;
+    const x = cell.col * cell.colSpan * (w + gap);
+    const span = w * cell.colSpan + gap * (cell.colSpan - 1);
+    const h = (height - (rows - 1) * gap) / rows;
+    return `<rect x="${x.toFixed(2)}" y="${(cell.row * (h + gap)).toFixed(2)}" width="${span.toFixed(2)}" ` +
+      `height="${h.toFixed(2)}" rx="0.5"/>`;
+  });
+  const icon = element("span", { className: "settings-layout-icon" });
+  icon.setAttribute("aria-hidden", "true");
+  icon.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="currentColor">${rects.join("")}</svg>`;
+  return icon;
+}
+
+const CURSOR_LABELS = { block: "Brick", underline: "Underline", bar: "Bar" } as const;
 
 interface PickItem { id: string; name: string }
 interface PickGroup { label?: string; items: PickItem[] }
@@ -208,7 +245,7 @@ function themeList(onSelect: () => void, locked: () => boolean) {
     swatch.style.setProperty("--sw-fg", colours.fg);
     swatch.style.setProperty("--sw-accent", colours.accent);
     row.append(swatch, element("span", {}, item.name));
-    if (item.id === DEFAULT_SETTINGS.theme) row.append(element("span", { className: "settings-default" }, "(default)"));
+    if (item.id === DEFAULT_SETTINGS.theme) markDefault(row);
   });
   const of = (kind: Theme["kind"]) => THEMES.filter((t) => t.kind === kind).map(({ id, name }) => ({ id, name }));
   picker.setGroups([{ items: of("system") }, { label: "Dark", items: of("dark") }, { label: "Light", items: of("light") }]);
@@ -227,6 +264,7 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   const family = pickList("Font family", () => change(read()), () => saving, (row, item) => {
     row.style.fontFamily = `"${item.name}", monospace`;
     row.textContent = item.name;
+    if (item.id === DEFAULT_FONT_FAMILY) markDefault(row);
   });
   /** Fills the family list: a Bundled and an OS group, with `selected` kept even if it is in neither. */
   const renderFamilies = (selected: string) => {
@@ -235,7 +273,17 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
     family.setGroups([{ label: "Bundled", items: listed(BUNDLED_FONTS) }, { label: "OS", items: listed(os) }]);
     family.show(selected);
   };
-  const size = numberInput("size", FONT_RANGES.size);
+  const tiling = pickList("Tiling", () => change(read()), () => saving, (row, item) => {
+    row.append(tilingIcon(item.id as TilingMode), element("span", {}, item.name));
+    if (item.id === DEFAULT_SETTINGS.tiling.layout) markDefault(row);
+  });
+  tiling.setGroups([{ items: TILING_MODES.map((id) => ({ id, name: TILING_LABELS[id] })) }]);
+  const responsiveOn = element("input", { type: "checkbox", name: "responsiveEnabled" });
+  const responsiveStrength = rangeInput("responsiveStrength", RESPONSIVE_STRENGTH);
+  const hoverHighlight = element("input", { type: "checkbox", name: "hoverHighlight" });
+  const inactiveOpacity = rangeInput("inactiveOpacity", INACTIVE_OPACITY);
+  const inactiveDesaturate = element("input", { type: "checkbox", name: "inactiveDesaturate" });
+  const size = rangeInput("size", FONT_RANGES.size);
   const weight = rangeInput("weight", FONT_RANGES.weight);
   const weightBold = rangeInput("weightBold", FONT_RANGES.weightBold);
   const ligatures = element("input", { type: "checkbox", name: "ligatures" });
@@ -255,8 +303,8 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
 
   const fontFields = element("fieldset", {},
     element("legend", {}, "Font"),
-    field("Family", family.list),
-    field("Size (px)", size),
+    field("Family", family.list, true),
+    field("Size (px)", size.control),
     field("Weight", weight.control),
     field("Bold weight", weightBold.control),
     field("Line height", lineHeight.control),
@@ -270,12 +318,79 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
     element("label", { className: "settings-check" }, cursorBlink, element("span", {}, "Blink")),
   );
 
-  const header = element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close);
-  const form = element("form", { method: "dialog" },
-    header,
+  const tilingFields = element("fieldset", {},
+    element("legend", {}, "Tiling"),
+    tiling.list,
+    element("p", { className: "settings-hint" }, "How panes are arranged as you open and close them."),
+  );
+
+  const responsiveFields = element("fieldset", {},
+    element("legend", {}, "Responsive text"),
+    element("label", { className: "settings-check" }, responsiveOn, element("span", {}, "Shrink text in small panes")),
+    field("Strength", responsiveStrength.control),
+    element("p", { className: "settings-hint" },
+      `Font size, line height and (slightly) letter spacing shrink as a pane gets smaller than the window, down to ` +
+      `${MIN_RESPONSIVE_SIZE} px and a line height of ${MIN_RESPONSIVE_LINE_HEIGHT}. Higher strength shrinks faster.`),
+  );
+
+  const inactiveFields = element("fieldset", {},
+    element("legend", {}, "Inactive terminals"),
+    field("Opacity", inactiveOpacity.control),
+    element("label", { className: "settings-check" }, inactiveDesaturate, element("span", {}, "Desaturate")),
+  );
+
+  const paneFields = element("fieldset", {},
+    element("legend", {}, "Panes"),
+    element("label", { className: "settings-check" }, hoverHighlight,
+      element("span", {}, "Highlight the terminal under the mouse")),
+  );
+
+  const appearance = element("div", { className: "settings-panel", id: "settings-panel-appearance" },
     element("fieldset", {}, element("legend", {}, "Theme"), theme.list),
     fontFields,
     cursorFields,
+    inactiveFields,
+  );
+  const behaviour = element("div", { className: "settings-panel", id: "settings-panel-behaviour" }, tilingFields, responsiveFields, paneFields);
+  const panels = [appearance, behaviour];
+  const tabs = ["Appearance", "Behaviour"].map((name, i) => {
+    const tab = element("button", { type: "button", className: "settings-tab", id: `settings-tab-${i}` }, name);
+    tab.setAttribute("role", "tab");
+    tab.setAttribute("aria-controls", panels[i].id);
+    return tab;
+  });
+  const tabList = element("div", { className: "settings-tabs" }, ...tabs);
+  tabList.setAttribute("role", "tablist");
+  panels.forEach((panel, i) => {
+    panel.setAttribute("role", "tabpanel");
+    panel.setAttribute("aria-labelledby", tabs[i].id);
+  });
+  /** Shows tab `index` and its panel. */
+  const showTab = (index: number, focus = false) => {
+    tabs.forEach((tab, i) => {
+      tab.setAttribute("aria-selected", String(i === index));
+      tab.tabIndex = i === index ? 0 : -1;
+      panels[i].hidden = i !== index;
+    });
+    if (focus) tabs[index].focus();
+  };
+  tabs.forEach((tab, i) => {
+    tab.addEventListener("click", () => showTab(i));
+    tab.addEventListener("keydown", (event) => {
+      const next = event.key === "ArrowRight" ? i + 1 : event.key === "ArrowLeft" ? i - 1 : undefined;
+      if (next === undefined) return;
+      event.preventDefault();
+      showTab((next + tabs.length) % tabs.length, true);
+    });
+  });
+  showTab(0);
+
+  const header = element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close);
+  const form = element("form", { method: "dialog" },
+    header,
+    tabList,
+    appearance,
+    behaviour,
     status,
     element("footer", { className: "settings-footer" },
       reset, element("div", { className: "settings-actions" }, cancel, save)),
@@ -287,7 +402,8 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   const show = (settings: Settings) => {
     theme.show(settings.theme);
     renderFamilies(settings.font.family);
-    size.value = String(settings.font.size);
+    size.input.value = String(settings.font.size);
+    size.sync();
     weight.input.value = String(settings.font.weight);
     weightBold.input.value = String(settings.font.weightBold);
     weight.sync();
@@ -299,13 +415,22 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
     letterSpacing.sync();
     cursorStyle.value = settings.cursor.style;
     cursorBlink.checked = settings.cursor.blink;
+    tiling.show(settings.tiling.layout);
+    responsiveOn.checked = settings.responsive.enabled;
+    responsiveStrength.input.value = String(settings.responsive.strength);
+    responsiveStrength.input.disabled = !settings.responsive.enabled;
+    responsiveStrength.sync();
+    hoverHighlight.checked = settings.behaviour.hoverHighlight;
+    inactiveOpacity.input.value = String(settings.inactive.opacity);
+    inactiveOpacity.sync();
+    inactiveDesaturate.checked = settings.inactive.desaturate;
   };
 
   const read = (): Settings => normalize({
     theme: theme.value(),
     font: {
       family: family.value(),
-      size: size.valueAsNumber,
+      size: size.input.valueAsNumber,
       weight: weight.input.valueAsNumber,
       weightBold: weightBold.input.valueAsNumber,
       ligatures: ligatures.checked,
@@ -313,6 +438,10 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
       letterSpacing: letterSpacing.input.valueAsNumber,
     },
     cursor: { style: cursorStyle.value, blink: cursorBlink.checked },
+    tiling: { layout: tiling.value() },
+    behaviour: { hoverHighlight: hoverHighlight.checked },
+    inactive: { opacity: inactiveOpacity.input.valueAsNumber, desaturate: inactiveDesaturate.checked },
+    responsive: { enabled: responsiveOn.checked, strength: responsiveStrength.input.valueAsNumber },
   });
 
   const report = (error: unknown) => {
@@ -331,9 +460,10 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   /** While saving, nothing can be edited, so what is written is what stays applied. */
   const lock = (on: boolean) => {
     saving = on;
-    fontFields.disabled = cursorFields.disabled = reset.disabled = save.disabled = cancel.disabled = on;
+    fontFields.disabled = cursorFields.disabled = responsiveFields.disabled = paneFields.disabled = inactiveFields.disabled = reset.disabled = save.disabled = cancel.disabled = on;
     theme.list.setAttribute("aria-disabled", String(on));
     family.list.setAttribute("aria-disabled", String(on));
+    tiling.list.setAttribute("aria-disabled", String(on));
   };
 
   /** Cancel, Esc and ×: back to the settings from when the dialogue opened, unsaved. */
@@ -413,6 +543,7 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
     open() {
       if (dialog.open) return;
       status.textContent = "";
+      showTab(0);
       offset = { x: 0, y: 0 };
       place();
       dialog.showModal();
diff --git a/src/styles.css b/src/styles.css
index 4dc93f3..962725f 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -234,10 +234,21 @@ body {
   min-width: 0;
   padding: var(--space-2);
   background: var(--term-bg);
-  opacity: 0.82;
 }
 
-.pane[data-focused] {
+/* Panes without focus fade their content (title and terminal), never the pane's own background, and can also lose
+   their colour (a setting). */
+.pane > .pane-title,
+.pane > .pane-terminal {
+  opacity: var(--inactive-opacity, 0.82);
+}
+
+#panes[data-desaturate] .pane:not([data-focused]) > :is(.pane-title, .pane-terminal) {
+  filter: grayscale(0.8);
+}
+
+.pane[data-focused] > .pane-title,
+.pane[data-focused] > .pane-terminal {
   opacity: 1;
 }
 
@@ -252,6 +263,27 @@ body {
   background: var(--accent);
 }
 
+/* Highlight on mouseover (a setting): the pane under the pointer undims and gets a faint accent line on its top edge. */
+#panes[data-hover-highlight] .pane:hover > :is(.pane-title, .pane-terminal) {
+  opacity: 1;
+  filter: none;
+}
+
+#panes[data-hover-highlight] .pane:hover:not([data-focused])::before {
+  content: "";
+  position: absolute;
+  top: 0;
+  right: 0;
+  left: 0;
+  height: 2px;
+  background: color-mix(in srgb, var(--accent) 50%, transparent);
+}
+
+/* No overview ruler track beside the scrollbar: it only draws a hairline border, as we use no decorations. */
+.xterm-decoration-overview-ruler {
+  display: none;
+}
+
 .pane-terminal {
   flex: 1 1 0;
   min-height: 0;
@@ -306,11 +338,40 @@ body {
 }
 
 .pane[data-drop-target] {
-  outline: 2px solid var(--accent);
-  outline-offset: -2px;
+  outline: 3px solid var(--focus);
+  outline-offset: -3px;
   opacity: 1;
 }
 
+/* While a pane is dragged: the source dims, a label follows the pointer, and the cursor says "grabbing" everywhere. */
+.pane[data-drag-source] {
+  opacity: 0.45;
+}
+
+html[data-pane-dragging],
+html[data-pane-dragging] * {
+  cursor: grabbing !important;
+  user-select: none;
+}
+
+.pane-drag-ghost {
+  position: fixed;
+  top: 0;
+  left: 0;
+  z-index: 1000;
+  max-width: 220px;
+  padding: 0 var(--space-3);
+  overflow: hidden;
+  border-radius: var(--radius-brick);
+  background: var(--accent);
+  box-shadow: 0 6px 18px color-mix(in srgb, #000 40%, transparent);
+  color: var(--on-accent);
+  font: 500 12px/24px var(--font-sans);
+  text-overflow: ellipsis;
+  white-space: nowrap;
+  pointer-events: none;
+}
+
 /* Dividers are the mortar gaps between tracks; dragging one resizes the tracks on both sides. */
 .pane-divider {
   position: absolute;
@@ -417,6 +478,11 @@ dialog.settings::backdrop {
   gap: var(--space-3);
 }
 
+.settings-field-stacked {
+  grid-template-columns: 1fr;
+  gap: var(--space-2);
+}
+
 .settings-check {
   display: flex;
   align-items: center;
@@ -507,6 +573,11 @@ dialog.settings::backdrop {
   box-shadow: 0 0 0 1px var(--focus);
 }
 
+.settings-range input:disabled {
+  opacity: 0.45;
+  cursor: default;
+}
+
 .settings-range output {
   min-width: 4ch;
   text-align: right;
@@ -576,7 +647,7 @@ dialog.settings::backdrop {
 }
 
 .settings-list-heading {
-  padding: var(--space-2) var(--space-2) var(--space-1);
+  padding: var(--space-2) var(--space-2) var(--space-1) 20px;
   color: var(--muted);
   font: 500 11px/16px var(--font-mono);
   text-transform: uppercase;
@@ -589,12 +660,13 @@ dialog.settings::backdrop {
 }
 
 .settings-option {
+  position: relative;
   display: flex;
   align-items: center;
   gap: var(--space-3);
   box-sizing: border-box;
   height: 28px;
-  padding: 0 var(--space-2);
+  padding: 0 var(--space-2) 0 20px;
   border-radius: var(--radius-control);
   white-space: nowrap;
   cursor: pointer;
@@ -604,10 +676,76 @@ dialog.settings::backdrop {
   background: color-mix(in srgb, var(--fg) 7%, transparent);
 }
 
-/* The selected row is marked by a bar in the focus colour and a light tint, not a full-width fill. */
+/* The selected row is marked by a small upright brick in the focus colour, plus a light tint. */
 .settings-option[aria-selected="true"] {
   background: color-mix(in srgb, var(--fg) 11%, transparent);
-  box-shadow: inset 3px 0 0 var(--focus);
+}
+
+.settings-option[aria-selected="true"]::before {
+  content: "";
+  position: absolute;
+  top: 50%;
+  left: var(--space-2);
+  width: 7px;
+  height: 14px;
+  border-radius: 1px;
+  background: var(--focus);
+  transform: translateY(-50%);
+}
+
+/* Tabs: Appearance and Behaviour, the selected one underlined in the focus colour. */
+.settings-tabs {
+  display: flex;
+  gap: var(--space-4);
+  margin-top: calc(-1 * var(--space-2));
+  border-bottom: 1px solid var(--line);
+}
+
+.settings .settings-tab {
+  height: 34px;
+  margin-bottom: -1px;
+  padding: 0 var(--space-1);
+  border: 0;
+  border-bottom: 2px solid transparent;
+  border-radius: 0;
+  color: var(--muted);
+  font-weight: 500;
+}
+
+.settings .settings-tab:hover {
+  background: none;
+  color: var(--fg);
+}
+
+.settings .settings-tab[aria-selected="true"] {
+  border-bottom-color: var(--focus);
+  color: var(--fg);
+}
+
+.settings-panel {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+}
+
+.settings-panel[hidden] {
+  display: none;
+}
+
+.settings-hint {
+  margin: 0;
+  color: var(--muted);
+  font-size: 12px;
+}
+
+.settings-layout-icon {
+  display: flex;
+  flex: none;
+  color: var(--muted);
+}
+
+.settings-option[aria-selected="true"] .settings-layout-icon {
+  color: var(--fg);
 }
 
 .settings-default {
diff --git a/src/terminal.ts b/src/terminal.ts
index 84f2cea..0d30835 100644
--- a/src/terminal.ts
+++ b/src/terminal.ts
@@ -3,6 +3,7 @@ import { LigaturesAddon } from "@xterm/addon-ligatures";
 import { Terminal, type FontWeight } from "@xterm/xterm";
 import type { Backend, SessionId } from "./backend";
 import { sizeReporter } from "./resize";
+import { responsiveFont } from "./responsive";
 import { fontFamilyList, type FontSettings, type Settings } from "./settings";
 import { documentTokens, followSystemTheme, terminalTheme } from "./theme";
 
@@ -42,6 +43,23 @@ async function loadFont(font: FontSettings): Promise<void> {
   ]).catch(() => undefined);
 }
 
+/**
+ * Sets `term`'s font size, line height and letter spacing: the chosen ones, scaled down for a small pane when responsive text is
+ * on. The pane is measured against the tiled area, so a pane that fills it keeps the chosen size.
+ */
+function applySize(term: Terminal, settings: Settings): void {
+  const { font, responsive } = settings;
+  const pane = term.element?.closest<HTMLElement>(".pane");
+  const area = pane?.parentElement?.closest<HTMLElement>("#panes");
+  const fitted =
+    pane && area
+      ? responsiveFont(font, responsive, pane.getBoundingClientRect(), area.getBoundingClientRect())
+      : { size: font.size, lineHeight: font.lineHeight, letterSpacing: font.letterSpacing };
+  if (term.options.fontSize !== fitted.size) term.options.fontSize = fitted.size;
+  if (term.options.lineHeight !== fitted.lineHeight) term.options.lineHeight = fitted.lineHeight;
+  if (term.options.letterSpacing !== fitted.letterSpacing) term.options.letterSpacing = fitted.letterSpacing;
+}
+
 /**
  * Applies the font settings to `term`: family with Geist Mono as fallback, size, weights, line height, letter
  * spacing and the ligatures addon on or off, then refits so the shell gets the new size.
@@ -54,11 +72,9 @@ export async function applyFont(term: Terminal, settings: Settings): Promise<voi
   // A newer call started while this font loaded; its settings win.
   if (fontGenerations.get(term) !== generation) return;
   term.options.fontFamily = fontFamilyList(font.family);
-  term.options.fontSize = font.size;
   term.options.fontWeight = String(font.weight) as FontWeight;
   term.options.fontWeightBold = String(font.weightBold) as FontWeight;
-  term.options.lineHeight = font.lineHeight;
-  term.options.letterSpacing = font.letterSpacing;
+  applySize(term, settings);
   term.options.cursorStyle = settings.cursor.style;
   term.options.cursorBlink = settings.cursor.blink;
 
@@ -102,6 +118,8 @@ export async function openTerminal(
     cursorBlink: settings().cursor.blink,
     // The ligatures addon uses xterm's proposed character joiner API.
     allowProposedApi: true,
+    // xterm sizes its scrollbar by the overview ruler's width (14 px by default); the fit addon reserves the same.
+    overviewRuler: { width: 8 },
   });
   const fit = new FitAddon();
   term.loadAddon(fit);
@@ -149,6 +167,7 @@ export async function openTerminal(
   // the terminal without resizing its pane, so that schedules a report too.
   const reporter = sizeReporter(
     () => {
+      applySize(term, settings());
       fit.fit();
       return { rows: term.rows, cols: term.cols };
     },
```