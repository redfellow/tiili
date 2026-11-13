# Design reference

Prototype diffs from Design view, made on hv/main at 0a4aa541, in the order they were accepted. A reference, not a patch: later changes build on earlier ones.

## Add popover tooltips to the 4 buttons in the top bar

```diff
diff --git a/src/assets/fonts/CascadiaCode-Italic-Variable.woff2 b/src/assets/fonts/CascadiaCode-Italic-Variable.woff2
new file mode 100644
index 0000000..ed8477b
Binary files /dev/null and b/src/assets/fonts/CascadiaCode-Italic-Variable.woff2 differ
diff --git a/src/assets/fonts/CascadiaCode-Variable.woff2 b/src/assets/fonts/CascadiaCode-Variable.woff2
new file mode 100644
index 0000000..8e6778a
Binary files /dev/null and b/src/assets/fonts/CascadiaCode-Variable.woff2 differ
diff --git a/src/assets/fonts/CommitMono-400-Italic.woff2 b/src/assets/fonts/CommitMono-400-Italic.woff2
new file mode 100644
index 0000000..f750254
Binary files /dev/null and b/src/assets/fonts/CommitMono-400-Italic.woff2 differ
diff --git a/src/assets/fonts/CommitMono-400-Regular.woff2 b/src/assets/fonts/CommitMono-400-Regular.woff2
new file mode 100644
index 0000000..4020ffa
Binary files /dev/null and b/src/assets/fonts/CommitMono-400-Regular.woff2 differ
diff --git a/src/assets/fonts/CommitMono-700-Italic.woff2 b/src/assets/fonts/CommitMono-700-Italic.woff2
new file mode 100644
index 0000000..6119716
Binary files /dev/null and b/src/assets/fonts/CommitMono-700-Italic.woff2 differ
diff --git a/src/assets/fonts/CommitMono-700-Regular.woff2 b/src/assets/fonts/CommitMono-700-Regular.woff2
new file mode 100644
index 0000000..bbc137d
Binary files /dev/null and b/src/assets/fonts/CommitMono-700-Regular.woff2 differ
diff --git a/src/assets/fonts/GeistMono-Bold.woff2 b/src/assets/fonts/GeistMono-Bold.woff2
deleted file mode 100644
index 692ca7b..0000000
Binary files a/src/assets/fonts/GeistMono-Bold.woff2 and /dev/null differ
diff --git a/src/assets/fonts/GeistMono-BoldItalic.woff2 b/src/assets/fonts/GeistMono-BoldItalic.woff2
deleted file mode 100644
index 8dc1bb3..0000000
Binary files a/src/assets/fonts/GeistMono-BoldItalic.woff2 and /dev/null differ
diff --git a/src/assets/fonts/GeistMono-Italic-Variable.woff2 b/src/assets/fonts/GeistMono-Italic-Variable.woff2
new file mode 100644
index 0000000..208d63e
Binary files /dev/null and b/src/assets/fonts/GeistMono-Italic-Variable.woff2 differ
diff --git a/src/assets/fonts/GeistMono-Italic.woff2 b/src/assets/fonts/GeistMono-Italic.woff2
deleted file mode 100644
index 6d9c6e4..0000000
Binary files a/src/assets/fonts/GeistMono-Italic.woff2 and /dev/null differ
diff --git a/src/assets/fonts/GeistMono-Regular.woff2 b/src/assets/fonts/GeistMono-Regular.woff2
deleted file mode 100644
index bf407f5..0000000
Binary files a/src/assets/fonts/GeistMono-Regular.woff2 and /dev/null differ
diff --git a/src/assets/fonts/GeistMono-Variable.woff2 b/src/assets/fonts/GeistMono-Variable.woff2
new file mode 100644
index 0000000..50c5a55
Binary files /dev/null and b/src/assets/fonts/GeistMono-Variable.woff2 differ
diff --git a/src/assets/fonts/LICENSES.md b/src/assets/fonts/LICENSES.md
new file mode 100644
index 0000000..5a4de06
--- /dev/null
+++ b/src/assets/fonts/LICENSES.md
@@ -0,0 +1,13 @@
+# Bundled fonts
+
+All are under the SIL Open Font License 1.1 (see OFL.txt for the text; each family has its own copyright holder).
+
+| Family | Source | Notes |
+| --- | --- | --- |
+| Geist Mono | Vercel, npm `geist` | variable, 100-900 |
+| Victor Mono | Rune Bjørnerås, `rubjo/victor-mono` VictorMonoVariable | variable, axis remapped to 300-700 |
+| Commit Mono | Eigil Nikolajsen, `eigilnikolajsen/commit-mono` v1.143 | static 400 and 700 only |
+| Recursive Mono | Arrow Type, `arrowtype/recursive` v1.085 | variable, instanced with MONO=1, CASL=0, 300-1000 |
+| Cascadia Code | Microsoft, `microsoft/cascadia-code` v2407.24 | variable, 200-700 |
+
+Berkeley Mono and Cartograph CF are commercial and not bundled; they show under OS when installed.
diff --git a/src/assets/fonts/RecursiveMono-Italic-Variable.woff2 b/src/assets/fonts/RecursiveMono-Italic-Variable.woff2
new file mode 100644
index 0000000..8ce2b2b
Binary files /dev/null and b/src/assets/fonts/RecursiveMono-Italic-Variable.woff2 differ
diff --git a/src/assets/fonts/RecursiveMono-Variable.woff2 b/src/assets/fonts/RecursiveMono-Variable.woff2
new file mode 100644
index 0000000..6696ad7
Binary files /dev/null and b/src/assets/fonts/RecursiveMono-Variable.woff2 differ
diff --git a/src/assets/fonts/VictorMono-Italic-Variable.woff2 b/src/assets/fonts/VictorMono-Italic-Variable.woff2
new file mode 100644
index 0000000..56ed7aa
Binary files /dev/null and b/src/assets/fonts/VictorMono-Italic-Variable.woff2 differ
diff --git a/src/assets/fonts/VictorMono-Variable.woff2 b/src/assets/fonts/VictorMono-Variable.woff2
new file mode 100644
index 0000000..32a788e
Binary files /dev/null and b/src/assets/fonts/VictorMono-Variable.woff2 differ
diff --git a/src/settings.ts b/src/settings.ts
index cccb948..933de41 100644
--- a/src/settings.ts
+++ b/src/settings.ts
@@ -28,13 +28,23 @@ export interface FontSettings {
   ligatures: boolean;
   /** 1.0–2.0. */
   lineHeight: number;
-  /** Pixels, 0–5. */
+  /** Pixels, -2–5. */
   letterSpacing: number;
 }
 
+/** The cursor's shape: the brick block, an underline or a bar. */
+export const CURSOR_STYLES = ["block", "underline", "bar"] as const;
+export type CursorStyle = (typeof CURSOR_STYLES)[number];
+
+export interface CursorSettings {
+  style: CursorStyle;
+  blink: boolean;
+}
+
 export interface Settings {
   theme: ThemeId;
   font: FontSettings;
+  cursor: CursorSettings;
 }
 
 export const DEFAULT_FONT_FAMILY = "Geist Mono";
@@ -47,25 +57,26 @@ export function fontFamilyList(family: string): string {
 }
 
 export const DEFAULT_SETTINGS: Settings = {
-  theme: "system",
+  theme: "koski",
   font: {
     family: DEFAULT_FONT_FAMILY,
     size: 14,
-    weight: 400,
+    weight: 100,
     weightBold: 700,
     ligatures: false,
     lineHeight: 1.0,
     letterSpacing: 0,
   },
+  cursor: { style: "block", blink: true },
 };
 
 /** Allowed range of each numeric font setting and the step values snap to. */
 export const FONT_RANGES = {
   size: { min: 8, max: 32, step: 1 },
-  weight: { min: 100, max: 900, step: 100 },
-  weightBold: { min: 100, max: 900, step: 100 },
+  weight: { min: 100, max: 900, step: 10 },
+  weightBold: { min: 100, max: 900, step: 10 },
   lineHeight: { min: 1.0, max: 2.0, step: 0.05 },
-  letterSpacing: { min: 0, max: 5, step: 0.5 },
+  letterSpacing: { min: -2, max: 5, step: 0.1 },
 } as const;
 
 const MAX_FAMILY_LENGTH = 100;
@@ -97,6 +108,7 @@ export function normalize(value: unknown): Settings {
   const raw = isRecord(value) ? value : {};
   const font = isRecord(raw.font) ? raw.font : {};
   const defaults = DEFAULT_SETTINGS.font;
+  const cursor = isRecord(raw.cursor) ? raw.cursor : {};
   return {
     theme: THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : DEFAULT_SETTINGS.theme,
     font: {
@@ -108,5 +120,11 @@ export function normalize(value: unknown): Settings {
       lineHeight: number(font.lineHeight, defaults.lineHeight, FONT_RANGES.lineHeight),
       letterSpacing: number(font.letterSpacing, defaults.letterSpacing, FONT_RANGES.letterSpacing),
     },
+    cursor: {
+      style: CURSOR_STYLES.includes(cursor.style as CursorStyle)
+        ? (cursor.style as CursorStyle)
+        : DEFAULT_SETTINGS.cursor.style,
+      blink: typeof cursor.blink === "boolean" ? cursor.blink : DEFAULT_SETTINGS.cursor.blink,
+    },
   };
 }
diff --git a/src/settingsDialog.ts b/src/settingsDialog.ts
index dbec73e..2ac614c 100644
--- a/src/settingsDialog.ts
+++ b/src/settingsDialog.ts
@@ -1,9 +1,15 @@
-import { DEFAULT_SETTINGS, FONT_RANGES, normalize, type Settings } from "./settings";
+import { CURSOR_STYLES, DEFAULT_FONT_FAMILY, DEFAULT_SETTINGS, FONT_RANGES, normalize, type Settings } from "./settings";
 import { createSettingsSession, same } from "./settingsSession";
-import { THEMES } from "./themes";
+import { THEMES, type Theme } from "./themes";
 
-const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
-/** Suggestions for the font family field; any installed font can be typed. */
+/** Fonts shipped with the app, listed under "Bundled". */
+const BUNDLED_FONTS = [
+  DEFAULT_FONT_FAMILY, "Victor Mono", "Commit Mono", "Recursive Mono", "Cascadia Code",
+];
+/**
+ * Fonts to look for when the webview can't list the installed ones (`queryLocalFonts` is Chromium only); only the
+ * ones that are actually installed show under "OS".
+ */
 const COMMON_MONO_FONTS = [
   "Geist Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Iosevka", "Source Code Pro", "Hack",
   "IBM Plex Mono", "SF Mono", "Menlo", "Monaco", "Consolas", "DejaVu Sans Mono", "Ubuntu Mono",
@@ -43,58 +49,170 @@ function numberInput(name: string, range: { min: number; max: number; step: numb
   });
 }
 
-function weightSelect(name: string): HTMLSelectElement {
-  return element("select", { name }, ...WEIGHTS.map((w) => element("option", { value: String(w) }, String(w))));
+/** A slider with a filled track and a live readout; `input` is the range, `control` the row to put in a field. */
+function rangeInput(name: string, range: { min: number; max: number; step: number }) {
+  const input = numberInput(name, range);
+  input.type = "range";
+  const out = element("output", {}, "");
+  const sync = () => {
+    out.textContent = String(Number(input.value));
+    input.style.setProperty("--fill", `${((input.valueAsNumber - range.min) / (range.max - range.min)) * 100}%`);
+  };
+  input.addEventListener("input", sync);
+  const control = element("div", { className: "settings-range" }, input, out);
+  return { input, control, sync };
 }
 
-/** A focusable single-select list of the themes; Up/Down, Home/End and clicks select at once unless `locked`. */
-function themeList(onSelect: () => void, locked: () => boolean) {
-  let value: string = THEMES[0].id;
-  const items = THEMES.map((t) => {
-    const item = element("div", { className: "settings-theme", id: `settings-theme-${t.id}` }, t.name);
-    item.setAttribute("role", "option");
-    item.dataset.theme = t.id;
-    return item;
-  });
-  const list = element("div", { className: "settings-themes", tabIndex: 0 }, ...items);
+let measureContext: CanvasRenderingContext2D | null | undefined;
+function textWidth(font: string, text: string): number {
+  measureContext ??= document.createElement("canvas").getContext("2d");
+  if (!measureContext) return 0;
+  measureContext.font = font;
+  return measureContext.measureText(text).width;
+}
+
+/** True when `name` is a fixed-width font: its narrow and wide letters take the same width. */
+function isMonospace(name: string): boolean {
+  const font = `16px "${name}", sans-serif`;
+  return Math.abs(textWidth(font, "iiiiiiii") - textWidth(font, "WWWWWWWW")) < 0.01;
+}
+
+/** True when `name` is installed: it changes the width of text that would otherwise use a generic font. */
+function isInstalled(name: string): boolean {
+  return ["monospace", "serif"].some(
+    (base) => textWidth(`16px "${name}", ${base}`, "mmmmmmmmmmlli") !== textWidth(`16px ${base}`, "mmmmmmmmmmlli"),
+  );
+}
+
+type LocalFontsWindow = { queryLocalFonts?: () => Promise<{ family: string }[]> };
+
+/** The fixed-width font families installed on the machine, sorted: all of them where the webview can list fonts. */
+async function installedMonospaceFonts(): Promise<string[]> {
+  const query = (window as LocalFontsWindow).queryLocalFonts;
+  let names: string[];
+  try {
+    names = query
+      ? [...new Set((await query.call(window)).map((f) => f.family))].filter(isMonospace)
+      : COMMON_MONO_FONTS.filter((n) => isInstalled(n) && isMonospace(n));
+  } catch {
+    // Permission to list fonts was refused.
+    names = COMMON_MONO_FONTS.filter((n) => isInstalled(n) && isMonospace(n));
+  }
+  return names.filter((n) => !BUNDLED_FONTS.includes(n)).sort((a, b) => a.localeCompare(b));
+}
+
+const CURSOR_LABELS = { block: "Brick (block)", underline: "Underline", bar: "Bar" } as const;
+
+interface PickItem { id: string; name: string }
+interface PickGroup { label?: string; items: PickItem[] }
+
+/**
+ * A focusable single-select list in groups, for themes and fonts. Up/Down, Home/End and clicks select at once (the
+ * choice applies as focus moves) unless `locked`. `render` decorates each row; groups can be replaced later.
+ */
+function pickList(
+  label: string,
+  onSelect: () => void,
+  locked: () => boolean,
+  render: (row: HTMLElement, item: PickItem) => void = () => {},
+) {
+  let value = "";
+  let items: PickItem[] = [];
+  let rows: HTMLElement[] = [];
+  const list = element("div", { className: "settings-list", tabIndex: 0 });
   list.setAttribute("role", "listbox");
-  list.setAttribute("aria-label", "Theme");
+  list.setAttribute("aria-label", label);
 
   /** Marks `id` selected and scrolls it into view, without applying it. */
   const show = (id: string) => {
     value = id;
-    for (const item of items) {
-      const selected = item.dataset.theme === id;
-      item.setAttribute("aria-selected", String(selected));
+    rows.forEach((row, i) => {
+      const selected = items[i].id === id;
+      row.setAttribute("aria-selected", String(selected));
       if (selected) {
-        list.setAttribute("aria-activedescendant", item.id);
-        item.scrollIntoView({ block: "nearest" });
+        list.setAttribute("aria-activedescendant", row.id);
+        row.scrollIntoView({ block: "nearest" });
+      }
+    });
+  };
+  const setGroups = (groups: PickGroup[]) => {
+    items = groups.flatMap((g) => g.items);
+    rows = [];
+    const children: HTMLElement[] = [];
+    for (const group of groups) {
+      if (group.label) {
+        const heading = element("div", { className: "settings-list-heading" }, group.label);
+        heading.setAttribute("role", "presentation");
+        children.push(heading);
+      }
+      for (const item of group.items) {
+        const row = element("div", { className: "settings-option", id: `${label.replace(/\s+/g, "-")}-${rows.length}` });
+        row.setAttribute("role", "option");
+        row.dataset.id = item.id;
+        render(row, item);
+        rows.push(row);
+        children.push(row);
       }
     }
+    list.replaceChildren(...children);
+    show(value);
   };
   const select = (index: number) => {
-    const id = THEMES[Math.max(0, Math.min(THEMES.length - 1, index))].id;
-    if (id === value || locked()) return;
+    const id = items[Math.max(0, Math.min(items.length - 1, index))]?.id;
+    if (id === undefined || id === value || locked()) return;
     show(id);
     onSelect();
   };
 
   list.addEventListener("keydown", (event) => {
-    const index = THEMES.findIndex((t) => t.id === value);
-    const moves: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: THEMES.length - 1 };
+    const index = items.findIndex((i) => i.id === value);
+    const moves: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: items.length - 1 };
     const next = moves[event.key];
     if (next === undefined) return;
     event.preventDefault();
     select(next);
   });
   list.addEventListener("click", (event) => {
-    const item = (event.target as Element).closest<HTMLElement>("[role=option]");
-    if (!item) return;
+    const row = (event.target as Element).closest<HTMLElement>("[role=option]");
+    if (!row) return;
     list.focus();
-    select(THEMES.findIndex((t) => t.id === item.dataset.theme));
+    select(items.findIndex((i) => i.id === row.dataset.id));
   });
 
-  return { list, show, value: () => value };
+  return { list, show, setGroups, value: () => value };
+}
+
+/** A theme's colours for its swatch: terminal ground and text, and the accent. System shows light and dark halves. */
+function swatchColours(theme: Theme) {
+  const light = THEMES.find((t) => t.id === "tiili-light")!.tokens;
+  const dark = THEMES.find((t) => t.id === "tiili-dark")!.tokens;
+  const t = theme.kind === "system" ? light : theme.tokens;
+  return {
+    bg: theme.kind === "system"
+      ? `linear-gradient(115deg, ${light["--term-bg"]} 50%, ${dark["--term-bg"]} 50%)`
+      : t["--term-bg"]!,
+    fg: t["--term-fg"]!,
+    accent: t["--accent"]!,
+  };
+}
+
+/** The theme list: System first, then the dark themes, then the light ones, each row led by a colour swatch. */
+function themeList(onSelect: () => void, locked: () => boolean) {
+  const byId = new Map<string, Theme>(THEMES.map((t) => [t.id, t]));
+  const picker = pickList("Theme", onSelect, locked, (row, item) => {
+    const theme = byId.get(item.id)!;
+    const colours = swatchColours(theme);
+    const swatch = element("span", { className: "settings-swatch" }, theme.kind === "system" ? "" : "Aa");
+    swatch.setAttribute("aria-hidden", "true");
+    swatch.style.setProperty("--sw-bg", colours.bg);
+    swatch.style.setProperty("--sw-fg", colours.fg);
+    swatch.style.setProperty("--sw-accent", colours.accent);
+    row.append(swatch, element("span", {}, item.name));
+    if (item.id === DEFAULT_SETTINGS.theme) row.append(element("span", { className: "settings-default" }, "(default)"));
+  });
+  const of = (kind: Theme["kind"]) => THEMES.filter((t) => t.kind === kind).map(({ id, name }) => ({ id, name }));
+  picker.setGroups([{ items: of("system") }, { label: "Dark", items: of("dark") }, { label: "Light", items: of("light") }]);
+  return picker;
 }
 
 /**
@@ -105,16 +223,27 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   const session = createSettingsSession(options.initial);
 
   const theme = themeList(() => change(read()), () => saving);
-  const family = element("input", { type: "text", name: "family", spellcheck: false, autocomplete: "off" });
-  family.setAttribute("list", "settings-font-families");
-  const families = element("datalist", { id: "settings-font-families" },
-    ...COMMON_MONO_FONTS.map((name) => element("option", { value: name })));
+  let osFonts: string[] = [];
+  const family = pickList("Font family", () => change(read()), () => saving, (row, item) => {
+    row.style.fontFamily = `"${item.name}", monospace`;
+    row.textContent = item.name;
+  });
+  /** Fills the family list: a Bundled and an OS group, with `selected` kept even if it is in neither. */
+  const renderFamilies = (selected: string) => {
+    const listed = (names: string[]) => names.map((name) => ({ id: name, name }));
+    const os = osFonts.includes(selected) || BUNDLED_FONTS.includes(selected) ? osFonts : [...osFonts, selected];
+    family.setGroups([{ label: "Bundled", items: listed(BUNDLED_FONTS) }, { label: "OS", items: listed(os) }]);
+    family.show(selected);
+  };
   const size = numberInput("size", FONT_RANGES.size);
-  const weight = weightSelect("weight");
-  const weightBold = weightSelect("weightBold");
+  const weight = rangeInput("weight", FONT_RANGES.weight);
+  const weightBold = rangeInput("weightBold", FONT_RANGES.weightBold);
   const ligatures = element("input", { type: "checkbox", name: "ligatures" });
-  const lineHeight = numberInput("lineHeight", FONT_RANGES.lineHeight);
-  const letterSpacing = numberInput("letterSpacing", FONT_RANGES.letterSpacing);
+  const lineHeight = rangeInput("lineHeight", FONT_RANGES.lineHeight);
+  const letterSpacing = rangeInput("letterSpacing", FONT_RANGES.letterSpacing);
+  const cursorStyle = element("select", { name: "cursorStyle" },
+    ...CURSOR_STYLES.map((style) => element("option", { value: style }, CURSOR_LABELS[style])));
+  const cursorBlink = element("input", { type: "checkbox", name: "cursorBlink" });
   const status = element("p", { className: "settings-status" });
   status.setAttribute("role", "status");
 
@@ -126,19 +255,27 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
 
   const fontFields = element("fieldset", {},
     element("legend", {}, "Font"),
-    field("Family", family), families,
+    field("Family", family.list),
     field("Size (px)", size),
-    field("Weight", weight),
-    field("Bold weight", weightBold),
-    field("Line height", lineHeight),
-    field("Letter spacing (px)", letterSpacing),
+    field("Weight", weight.control),
+    field("Bold weight", weightBold.control),
+    field("Line height", lineHeight.control),
+    field("Letter spacing (px)", letterSpacing.control),
     element("label", { className: "settings-check" }, ligatures, element("span", {}, "Ligatures")),
   );
 
+  const cursorFields = element("fieldset", {},
+    element("legend", {}, "Cursor"),
+    field("Style", cursorStyle),
+    element("label", { className: "settings-check" }, cursorBlink, element("span", {}, "Blink")),
+  );
+
+  const header = element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close);
   const form = element("form", { method: "dialog" },
-    element("header", { className: "settings-header" }, element("h2", {}, "Settings"), close),
+    header,
     element("fieldset", {}, element("legend", {}, "Theme"), theme.list),
     fontFields,
+    cursorFields,
     status,
     element("footer", { className: "settings-footer" },
       reset, element("div", { className: "settings-actions" }, cancel, save)),
@@ -149,26 +286,33 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
 
   const show = (settings: Settings) => {
     theme.show(settings.theme);
-    family.value = settings.font.family;
+    renderFamilies(settings.font.family);
     size.value = String(settings.font.size);
-    weight.value = String(settings.font.weight);
-    weightBold.value = String(settings.font.weightBold);
+    weight.input.value = String(settings.font.weight);
+    weightBold.input.value = String(settings.font.weightBold);
+    weight.sync();
+    weightBold.sync();
     ligatures.checked = settings.font.ligatures;
-    lineHeight.value = String(settings.font.lineHeight);
-    letterSpacing.value = String(settings.font.letterSpacing);
+    lineHeight.input.value = String(settings.font.lineHeight);
+    letterSpacing.input.value = String(settings.font.letterSpacing);
+    lineHeight.sync();
+    letterSpacing.sync();
+    cursorStyle.value = settings.cursor.style;
+    cursorBlink.checked = settings.cursor.blink;
   };
 
   const read = (): Settings => normalize({
     theme: theme.value(),
     font: {
-      family: family.value,
+      family: family.value(),
       size: size.valueAsNumber,
-      weight: Number(weight.value),
-      weightBold: Number(weightBold.value),
+      weight: weight.input.valueAsNumber,
+      weightBold: weightBold.input.valueAsNumber,
       ligatures: ligatures.checked,
-      lineHeight: lineHeight.valueAsNumber,
-      letterSpacing: letterSpacing.valueAsNumber,
+      lineHeight: lineHeight.input.valueAsNumber,
+      letterSpacing: letterSpacing.input.valueAsNumber,
     },
+    cursor: { style: cursorStyle.value, blink: cursorBlink.checked },
   });
 
   const report = (error: unknown) => {
@@ -187,8 +331,9 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   /** While saving, nothing can be edited, so what is written is what stays applied. */
   const lock = (on: boolean) => {
     saving = on;
-    fontFields.disabled = reset.disabled = save.disabled = cancel.disabled = on;
+    fontFields.disabled = cursorFields.disabled = reset.disabled = save.disabled = cancel.disabled = on;
     theme.list.setAttribute("aria-disabled", String(on));
+    family.list.setAttribute("aria-disabled", String(on));
   };
 
   /** Cancel, Esc and ×: back to the settings from when the dialogue opened, unsaved. */
@@ -238,11 +383,44 @@ export function createSettingsDialog(options: SettingsDialogOptions): SettingsDi
   });
   dialog.addEventListener("close", () => options.onClose());
 
+  // Drag the dialogue by its header, kept inside the window, so the terminal behind can be seen.
+  let offset = { x: 0, y: 0 };
+  const place = () => { dialog.style.transform = `translate(${offset.x}px, ${offset.y}px)`; };
+  header.addEventListener("pointerdown", (event) => {
+    if (event.button !== 0 || (event.target as Element).closest("button")) return;
+    const start = { x: event.clientX, y: event.clientY, offset };
+    const rect = dialog.getBoundingClientRect();
+    header.setPointerCapture(event.pointerId);
+    header.setAttribute("data-dragging", "");
+    const move = (e: PointerEvent) => {
+      const dx = Math.min(Math.max(e.clientX - start.x, -rect.left), window.innerWidth - rect.right);
+      const dy = Math.min(Math.max(e.clientY - start.y, -rect.top), window.innerHeight - rect.bottom);
+      offset = { x: start.offset.x + dx, y: start.offset.y + dy };
+      place();
+    };
+    const stop = () => {
+      header.removeAttribute("data-dragging");
+      header.removeEventListener("pointermove", move);
+      header.removeEventListener("pointerup", stop);
+      header.removeEventListener("pointercancel", stop);
+    };
+    header.addEventListener("pointermove", move);
+    header.addEventListener("pointerup", stop);
+    header.addEventListener("pointercancel", stop);
+  });
+
   return {
     open() {
       if (dialog.open) return;
       status.textContent = "";
+      offset = { x: 0, y: 0 };
+      place();
       dialog.showModal();
+      // The installed fonts are listed in the background; the dropdown refills when they are known.
+      void installedMonospaceFonts().then((names) => {
+        osFonts = names;
+        if (dialog.open) renderFamilies(family.value());
+      });
       // Shown once open, so the selected theme can scroll into view.
       show(session.saved);
       theme.list.focus();
diff --git a/src/styles.css b/src/styles.css
index a81f0d4..4dc93f3 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -1,38 +1,103 @@
 @import "../docs/brand/tiili.css";
 @import "@xterm/xterm/css/xterm.css";
 
+/* Bundled monospace fonts (all SIL OFL). Variable ones take any weight in their range; Commit Mono is regular + bold only. */
 @font-face {
   font-family: "Geist Mono";
-  src: url("./assets/fonts/GeistMono-Regular.woff2") format("woff2");
-  font-weight: 400;
+  src: url("./assets/fonts/GeistMono-Variable.woff2") format("woff2");
+  font-weight: 100 900;
   font-style: normal;
   font-display: block;
 }
 
 @font-face {
   font-family: "Geist Mono";
-  src: url("./assets/fonts/GeistMono-Bold.woff2") format("woff2");
+  src: url("./assets/fonts/GeistMono-Italic-Variable.woff2") format("woff2");
+  font-weight: 100 900;
+  font-style: italic;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Victor Mono";
+  src: url("./assets/fonts/VictorMono-Variable.woff2") format("woff2");
+  font-weight: 300 700;
+  font-style: normal;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Victor Mono";
+  src: url("./assets/fonts/VictorMono-Italic-Variable.woff2") format("woff2");
+  font-weight: 300 700;
+  font-style: italic;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Commit Mono";
+  src: url("./assets/fonts/CommitMono-400-Regular.woff2") format("woff2");
+  font-weight: 400;
+  font-style: normal;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Commit Mono";
+  src: url("./assets/fonts/CommitMono-700-Regular.woff2") format("woff2");
   font-weight: 700;
   font-style: normal;
   font-display: block;
 }
 
 @font-face {
-  font-family: "Geist Mono";
-  src: url("./assets/fonts/GeistMono-Italic.woff2") format("woff2");
+  font-family: "Commit Mono";
+  src: url("./assets/fonts/CommitMono-400-Italic.woff2") format("woff2");
   font-weight: 400;
   font-style: italic;
   font-display: block;
 }
 
 @font-face {
-  font-family: "Geist Mono";
-  src: url("./assets/fonts/GeistMono-BoldItalic.woff2") format("woff2");
+  font-family: "Commit Mono";
+  src: url("./assets/fonts/CommitMono-700-Italic.woff2") format("woff2");
   font-weight: 700;
   font-style: italic;
   font-display: block;
 }
 
+@font-face {
+  font-family: "Recursive Mono";
+  src: url("./assets/fonts/RecursiveMono-Variable.woff2") format("woff2");
+  font-weight: 300 1000;
+  font-style: normal;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Recursive Mono";
+  src: url("./assets/fonts/RecursiveMono-Italic-Variable.woff2") format("woff2");
+  font-weight: 300 1000;
+  font-style: italic;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Cascadia Code";
+  src: url("./assets/fonts/CascadiaCode-Variable.woff2") format("woff2");
+  font-weight: 200 700;
+  font-style: normal;
+  font-display: block;
+}
+
+@font-face {
+  font-family: "Cascadia Code";
+  src: url("./assets/fonts/CascadiaCode-Italic-Variable.woff2") format("woff2");
+  font-weight: 200 700;
+  font-style: italic;
+  font-display: block;
+}
+
 html,
 body {
   margin: 0;
@@ -102,6 +167,43 @@ body {
   color: var(--fg);
 }
 
+/* Popover tooltip under each top bar button: name plus shortcut, right-aligned to the button. */
+.top-bar {
+  z-index: 20;
+}
+
+.top-bar-button {
+  position: relative;
+}
+
+.top-bar-tooltip {
+  position: absolute;
+  top: calc(100% + 6px);
+  right: 0;
+  display: flex;
+  align-items: center;
+  gap: var(--space-2);
+  padding: var(--space-1) var(--space-2);
+  border: 1px solid var(--line);
+  border-radius: var(--radius-control);
+  background: var(--surface);
+  color: var(--fg);
+  font: 500 11.5px/16px var(--font-sans);
+  white-space: nowrap;
+  box-shadow: 0 4px 12px color-mix(in srgb, #000 35%, transparent);
+  pointer-events: none;
+  opacity: 0;
+}
+
+.top-bar-tooltip kbd {
+  color: var(--muted);
+  font: 500 11px/16px var(--font-mono);
+}
+
+.top-bar-button:hover .top-bar-tooltip {
+  opacity: 1;
+}
+
 /* Panes sit on the mortar colour; the 3 px gaps between them read as mortar joints. */
 #panes {
   --pane-gap: 3px;
@@ -245,10 +347,12 @@ dialog.settings {
   background: var(--surface);
   color: var(--fg);
   font: 400 13.5px/1.5 var(--font-sans);
+  box-shadow: 0 8px 32px color-mix(in srgb, #000 45%, transparent), 0 2px 8px color-mix(in srgb, #000 30%, transparent);
 }
 
+/* No dimming, so the terminal behind shows the live effect of each setting; the dialogue's shadow lifts it instead. */
 dialog.settings::backdrop {
-  background: color-mix(in srgb, var(--term-gap) 60%, transparent);
+  background: transparent;
 }
 
 .settings form {
@@ -265,6 +369,21 @@ dialog.settings::backdrop {
   gap: var(--space-3);
 }
 
+.settings-header {
+  cursor: grab;
+  touch-action: none;
+  user-select: none;
+  -webkit-user-select: none;
+}
+
+.settings-header[data-dragging] {
+  cursor: grabbing;
+}
+
+.settings-header button {
+  cursor: pointer;
+}
+
 .settings h2 {
   margin: 0;
   font-size: 24px;
@@ -311,23 +430,99 @@ dialog.settings::backdrop {
   color: var(--fg);
 }
 
+/* Fields: 32 px tall, hairline border, 6 px radius; the same 2 px focus ring as every other control. */
 .settings input[type="text"],
 .settings input[type="number"],
 .settings select {
   box-sizing: border-box;
   width: 100%;
-  padding: var(--space-1) var(--space-2);
+  height: 32px;
+  padding: 0 var(--space-3);
   border: 1px solid var(--line);
   border-radius: var(--radius-control);
   background: var(--bg);
 }
 
+.settings input[type="text"]:hover,
+.settings input[type="number"]:hover,
+.settings select:hover,
+.settings-list:hover {
+  border-color: color-mix(in srgb, var(--fg) 35%, var(--line));
+}
+
+/* Sliders: a filled track like a progress bar, with the value beside it. */
+.settings-range {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+}
+
+.settings-range input {
+  --fill: 0%;
+  flex: 1;
+  min-width: 0;
+  height: 20px;
+  margin: 0;
+  background: none;
+  appearance: none;
+  -webkit-appearance: none;
+  cursor: pointer;
+}
+
+.settings-range input::-webkit-slider-runnable-track {
+  height: 6px;
+  border-radius: 3px;
+  background: linear-gradient(to right, var(--focus) var(--fill), var(--line) var(--fill));
+}
+
+.settings-range input::-webkit-slider-thumb {
+  -webkit-appearance: none;
+  width: 14px;
+  height: 14px;
+  margin-top: -4px;
+  border: 2px solid var(--surface);
+  border-radius: 50%;
+  background: var(--focus);
+  box-shadow: 0 0 0 1px var(--focus);
+}
+
+.settings-range input::-moz-range-track {
+  height: 6px;
+  border-radius: 3px;
+  background: var(--line);
+}
+
+.settings-range input::-moz-range-progress {
+  height: 6px;
+  border-radius: 3px;
+  background: var(--focus);
+}
+
+.settings-range input::-moz-range-thumb {
+  width: 10px;
+  height: 10px;
+  border: 2px solid var(--surface);
+  border-radius: 50%;
+  background: var(--focus);
+  box-shadow: 0 0 0 1px var(--focus);
+}
+
+.settings-range output {
+  min-width: 4ch;
+  text-align: right;
+  font: 500 12px var(--font-mono);
+  font-variant-numeric: tabular-nums;
+  color: var(--muted);
+}
+
 .settings input[type="checkbox"] {
-  accent-color: var(--accent);
+  accent-color: var(--focus);
 }
 
+/* Buttons: secondary (outlined) by default, the primary one in the accent with its own label colour. */
 .settings button {
-  padding: var(--space-1) var(--space-3);
+  height: 32px;
+  padding: 0 var(--space-3);
   border: 1px solid var(--line);
   border-radius: var(--radius-control);
   background: transparent;
@@ -335,18 +530,28 @@ dialog.settings::backdrop {
 }
 
 .settings button:hover {
-  background: var(--bg);
+  background: color-mix(in srgb, var(--fg) 8%, transparent);
 }
 
 .settings .settings-close {
+  height: auto;
   padding: 0 var(--space-2);
   border-color: transparent;
   font-size: 20px;
   line-height: 1.2;
 }
 
+.settings .settings-reset {
+  border-color: transparent;
+  color: var(--muted);
+}
+
+.settings .settings-reset:hover {
+  color: var(--fg);
+}
+
 .settings :focus-visible {
-  outline: 2px solid var(--accent);
+  outline: 2px solid var(--focus);
   outline-offset: 2px;
 }
 
@@ -359,8 +564,10 @@ dialog.settings::backdrop {
   display: none;
 }
 
-.settings-themes {
-  max-height: 180px;
+/* Pick lists (themes, font families): about five rows tall, scrolling beyond that. */
+.settings-list {
+  box-sizing: border-box;
+  max-height: calc(5 * 28px + 2 * var(--space-1) + 2px);
   overflow-y: auto;
   padding: var(--space-1);
   border: 1px solid var(--line);
@@ -368,19 +575,58 @@ dialog.settings::backdrop {
   background: var(--bg);
 }
 
-.settings-theme {
-  padding: var(--space-1) var(--space-2);
+.settings-list-heading {
+  padding: var(--space-2) var(--space-2) var(--space-1);
+  color: var(--muted);
+  font: 500 11px/16px var(--font-mono);
+  text-transform: uppercase;
+  letter-spacing: 0.06em;
+  cursor: default;
+}
+
+.settings-list-heading:first-child {
+  padding-top: var(--space-1);
+}
+
+.settings-option {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+  box-sizing: border-box;
+  height: 28px;
+  padding: 0 var(--space-2);
   border-radius: var(--radius-control);
+  white-space: nowrap;
   cursor: pointer;
 }
 
-.settings-theme:hover {
-  background: var(--surface);
+.settings-option:hover {
+  background: color-mix(in srgb, var(--fg) 7%, transparent);
 }
 
-.settings-theme[aria-selected="true"] {
-  background: var(--accent);
-  color: var(--bg);
+/* The selected row is marked by a bar in the focus colour and a light tint, not a full-width fill. */
+.settings-option[aria-selected="true"] {
+  background: color-mix(in srgb, var(--fg) 11%, transparent);
+  box-shadow: inset 3px 0 0 var(--focus);
+}
+
+.settings-default {
+  color: var(--muted);
+  font-size: 12px;
+}
+
+/* A theme's colours: its terminal ground with sample text, and an accent line along the bottom. */
+.settings-swatch {
+  flex: none;
+  box-sizing: border-box;
+  width: 30px;
+  height: 18px;
+  border-radius: var(--radius-brick);
+  background: var(--sw-bg);
+  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fg) 25%, transparent), inset 0 -3px 0 var(--sw-accent);
+  color: var(--sw-fg);
+  font: 600 10px/14px var(--font-mono);
+  text-align: center;
 }
 
 .settings-actions {
@@ -392,11 +638,11 @@ dialog.settings::backdrop {
 .settings .settings-save {
   border-color: var(--accent);
   background: var(--accent);
-  color: var(--bg);
+  color: var(--on-accent);
 }
 
 .settings .settings-save:hover {
-  background: var(--accent);
+  background: color-mix(in srgb, var(--accent) 88%, var(--fg));
 }
 
 .settings button:disabled {
diff --git a/src/terminal.ts b/src/terminal.ts
index f9378d7..84f2cea 100644
--- a/src/terminal.ts
+++ b/src/terminal.ts
@@ -59,6 +59,8 @@ export async function applyFont(term: Terminal, settings: Settings): Promise<voi
   term.options.fontWeightBold = String(font.weightBold) as FontWeight;
   term.options.lineHeight = font.lineHeight;
   term.options.letterSpacing = font.letterSpacing;
+  term.options.cursorStyle = settings.cursor.style;
+  term.options.cursorBlink = settings.cursor.blink;
 
   const own = addons.get(term);
   if (!own) return;
@@ -80,7 +82,7 @@ export function refreshTheme(term: Terminal): void {
 /**
  * Opens a terminal in `container` connected to a new default shell of its own, started in `cwd` (home folder
  * when absent), styled by `settings()`, which the terminal asks again whenever the system switches light and
- * dark. The cursor is a solid block while the terminal has focus and an outline otherwise. The shell runs on
+ * dark. The cursor has the chosen shape (the brick block by default) and blinks if chosen while the terminal has focus and an outline otherwise. The shell runs on
  * `backend`; `onSession` hears the id of each shell session the terminal starts, the first and any after the
  * shell exits.
  */
@@ -95,9 +97,11 @@ export async function openTerminal(
   await loadFont(settings().font);
 
   const term = new Terminal({
-    cursorStyle: "block",
+    cursorStyle: settings().cursor.style,
     cursorInactiveStyle: "outline",
-    cursorBlink: false,
+    cursorBlink: settings().cursor.blink,
+    // The ligatures addon uses xterm's proposed character joiner API.
+    allowProposedApi: true,
   });
   const fit = new FitAddon();
   term.loadAddon(fit);
diff --git a/src/themes.ts b/src/themes.ts
index af2f1b8..91c6032 100644
--- a/src/themes.ts
+++ b/src/themes.ts
@@ -3,7 +3,7 @@ import type { ThemeId } from "./settings";
 /** The tokens each fixed theme sets; anything else (spacing, type, tints) stays as tiili.css defines it. */
 export const THEME_TOKENS = [
   "--bg", "--surface", "--fg", "--muted", "--line", "--accent",
-  "--term-bg", "--term-fg", "--term-dim", "--term-gap",
+  "--term-bg", "--term-fg", "--term-dim", "--term-gap", "--on-accent", "--focus",
   ...Array.from({ length: 16 }, (_, i) => `--ansi-${i}`),
 ] as const;
 
@@ -30,8 +30,45 @@ interface Chrome {
   termBg: string; termFg: string; termDim: string; termGap: string;
 }
 
+function channels(colour: string): number[] {
+  return [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
+}
+
+function luminance(colour: string): number {
+  const [r, g, b] = channels(colour).map((c) => {
+    const v = c / 255;
+    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
+  });
+  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
+}
+
+/** WCAG contrast ratio between two #RRGGBB colours. */
+export function contrast(a: string, b: string): number {
+  const [x, y] = [luminance(a), luminance(b)];
+  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
+}
+
+/** The label colour for text on an accent fill: white, or near-black when that reads better. */
+function onAccent(accent: string): string {
+  return contrast("#FFFFFF", accent) >= contrast("#1B1614", accent) ? "#FFFFFF" : "#1B1614";
+}
+
+/** The accent, moved towards white (dark grounds) or black (light) until it is 3:1 against both grounds: for focus rings. */
+function focusRing(accent: string, grounds: string[]): string {
+  const target = luminance(grounds[0]) < 0.3 ? 255 : 0;
+  const base = channels(accent);
+  for (let t = 0; t <= 1; t += 0.01) {
+    const mixed =
+      "#" + base.map((c) => Math.round(c + (target - c) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
+    if (grounds.every((ground) => contrast(mixed, ground) >= 3)) return mixed;
+  }
+  return accent;
+}
+
 function tokens(chrome: Chrome, colours: string): Record<ThemeToken, string> {
   return {
+    "--on-accent": onAccent(chrome.accent),
+    "--focus": focusRing(chrome.accent, [chrome.bg, chrome.surface]),
     "--bg": chrome.bg,
     "--surface": chrome.surface,
     "--fg": chrome.fg,
@@ -50,11 +87,14 @@ function tokens(chrome: Chrome, colours: string): Record<ThemeToken, string> {
 const TIILI_LIGHT_ANSI =
   "#2A2321 #A4472B #4C7356 #8C5F0E #3C6680 #844B66 #3F6E6B #8D877D #5E5650 #C2512F #5E8A69 #A87414 #4D7C99 #9C5A7A #4F8481 #B9B1A6";
 const TIILI_DARK_ANSI =
-  "#222B2E #D05B3F #8DB596 #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC8BE #56615F #E57A57 #A9CBB0 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F6F1E9";
+  "#222B2E #D05B3F #8DB596 #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC8BE #626C6A #E57A57 #A9CBB0 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F6F1E9";
 
-// Solarized's published palette; light and dark share the accents and swap the base tones.
-const SOLARIZED_ANSI =
-  "#073642 #DC322F #859900 #B58900 #268BD2 #D33682 #2AA198 #EEE8D5 #002B36 #CB4B16 #586E75 #657B83 #839496 #6C71C4 #93A1A1 #FDF6E3";
+// Solarized's published palette; light and dark share the accents and swap the base tones. A few of the accents
+// and the bright black are nudged until they reach 3:1 on their ground.
+const SOLARIZED_LIGHT_ANSI =
+  "#073642 #DC322F #849700 #B38800 #268BD2 #D33682 #299E95 #EEE8D5 #002B36 #CB4B16 #586E75 #657B83 #809193 #6C71C4 #849191 #FDF6E3";
+const SOLARIZED_DARK_ANSI =
+  "#073642 #DC322F #859900 #B58900 #268BD2 #D33682 #2AA198 #EEE8D5 #59757C #CB4B16 #5F747B #657B83 #839496 #6C71C4 #93A1A1 #FDF6E3";
 
 export const THEMES: readonly Theme[] = [
   { id: "system", name: "System", kind: "system", tokens: {} },
@@ -78,7 +118,7 @@ export const THEMES: readonly Theme[] = [
     tokens: tokens({
       bg: "#F3EEE7", surface: "#FBF8F4", fg: "#2A2321", muted: "#6F6560", line: "#DDD3C8", accent: "#C9764F",
       termBg: "#F3EEE7", termFg: "#2A2321", termDim: "#8D877D", termGap: "#DDD3C8",
-    }, "#2A2321 #A4472B #5A7340 #8C5F0E #3C6680 #844B66 #3F6E6B #8D877D #5E5650 #C9764F #6E7F4E #A87414 #4D7C99 #9C5A7A #4F8481 #B9B1A6"),
+    }, "#2A2321 #A4472B #5A7340 #8C5F0E #3C6680 #844B66 #3F6E6B #8D877D #5E5650 #C5744D #6E7F4E #A87414 #4D7C99 #9C5A7A #4F8481 #B9B1A6"),
   },
   {
     // Warm dark grounds; muratti for the accent and red, koivu for yellow, the warm off-white for the text.
@@ -86,7 +126,7 @@ export const THEMES: readonly Theme[] = [
     tokens: tokens({
       bg: "#151112", surface: "#1E1919", fg: "#EFE7DE", muted: "#A0948C", line: "#342B29", accent: "#861B22",
       termBg: "#1E1919", termFg: "#F3E7DC", termDim: "#6F6560", termGap: "#0E0B0B",
-    }, "#2A2222 #C0444B #9AAE7A #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC4B8 #5A4E4C #D9625F #B5C792 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F3E7DC"),
+    }, "#2A2222 #C0444B #9AAE7A #D9A43A #7FA2B8 #B97C92 #8FB0AD #CFC4B8 #6F6563 #D9625F #B5C792 #EDC066 #9DBCD0 #D198AC #ADCBC8 #F3E7DC"),
   },
   {
     // Rapids at night: koski panes on a darker window, savi cursor, ikkuna for cyan.
@@ -94,7 +134,7 @@ export const THEMES: readonly Theme[] = [
     tokens: tokens({
       bg: "#0F1516", surface: "#182023", fg: "#C9CFCD", muted: "#8A9492", line: "#24302F", accent: "#C9764F",
       termBg: "#182023", termFg: "#C9CFCD", termDim: "#6E7876", termGap: "#0B0F10",
-    }, "#222B2E #D05B3F #8FB59A #D9A43A #7FA2B8 #B97C92 #8FA6A4 #C9CFCD #4A5654 #C9764F #A9CBB0 #EDC066 #9DBCD0 #D198AC #B3C7C5 #EEF1EF"),
+    }, "#222B2E #D05B3F #8FB59A #D9A43A #7FA2B8 #B97C92 #8FA6A4 #C9CFCD #626C6A #C9764F #A9CBB0 #EDC066 #9DBCD0 #D198AC #B3C7C5 #EEF1EF"),
   },
   {
     // The mortar grid: tiili, klinkkeri, savi and rauta on laasti.
@@ -107,35 +147,35 @@ export const THEMES: readonly Theme[] = [
   {
     id: "solarized-light", name: "Solarized Light", kind: "light",
     tokens: tokens({
-      bg: "#FDF6E3", surface: "#EEE8D5", fg: "#657B83", muted: "#93A1A1", line: "#DDD6C1", accent: "#268BD2",
-      termBg: "#FDF6E3", termFg: "#657B83", termDim: "#93A1A1", termGap: "#EEE8D5",
-    }, SOLARIZED_ANSI),
+      bg: "#FDF6E3", surface: "#EEE8D5", fg: "#586B72", muted: "#616A6A", line: "#DDD6C1", accent: "#268BD2",
+      termBg: "#FDF6E3", termFg: "#5F747B", termDim: "#849191", termGap: "#EEE8D5",
+    }, SOLARIZED_LIGHT_ANSI),
   },
   {
     id: "solarized-dark", name: "Solarized Dark", kind: "dark",
     tokens: tokens({
-      bg: "#002B36", surface: "#073642", fg: "#839496", muted: "#586E75", line: "#0B4050", accent: "#268BD2",
-      termBg: "#002B36", termFg: "#839496", termDim: "#586E75", termGap: "#00212B",
-    }, SOLARIZED_ANSI),
+      bg: "#002B36", surface: "#073642", fg: "#8C9B9D", muted: "#8C9BA0", line: "#0B4050", accent: "#268BD2",
+      termBg: "#002B36", termFg: "#839496", termDim: "#5F747B", termGap: "#00212B",
+    }, SOLARIZED_DARK_ANSI),
   },
   {
     id: "gruvbox-dark", name: "Gruvbox Dark", kind: "dark",
     tokens: tokens({
-      bg: "#282828", surface: "#3C3836", fg: "#EBDBB2", muted: "#A89984", line: "#504945", accent: "#FE8019",
+      bg: "#282828", surface: "#3C3836", fg: "#EBDBB2", muted: "#AEA08D", line: "#504945", accent: "#FE8019",
       termBg: "#282828", termFg: "#EBDBB2", termDim: "#928374", termGap: "#1D2021",
-    }, "#282828 #CC241D #98971A #D79921 #458588 #B16286 #689D6A #A89984 #928374 #FB4934 #B8BB26 #FABD2F #83A598 #D3869B #8EC07C #EBDBB2"),
+    }, "#282828 #D13831 #98971A #D79921 #458588 #B16286 #689D6A #A89984 #928374 #FB4934 #B8BB26 #FABD2F #83A598 #D3869B #8EC07C #EBDBB2"),
   },
   {
     id: "nord", name: "Nord", kind: "dark",
     tokens: tokens({
-      bg: "#2E3440", surface: "#3B4252", fg: "#D8DEE9", muted: "#A3ABB9", line: "#434C5E", accent: "#88C0D0",
-      termBg: "#2E3440", termFg: "#D8DEE9", termDim: "#4C566A", termGap: "#242933",
-    }, "#3B4252 #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #88C0D0 #E5E9F0 #4C566A #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #8FBCBB #ECEFF4"),
+      bg: "#2E3440", surface: "#3B4252", fg: "#D8DEE9", muted: "#A6AEBB", line: "#434C5E", accent: "#88C0D0",
+      termBg: "#2E3440", termFg: "#D8DEE9", termDim: "#757D8C", termGap: "#242933",
+    }, "#3B4252 #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #88C0D0 #E5E9F0 #757D8C #BF616A #A3BE8C #EBCB8B #81A1C1 #B48EAD #8FBCBB #ECEFF4"),
   },
   {
     id: "dracula", name: "Dracula", kind: "dark",
     tokens: tokens({
-      bg: "#282A36", surface: "#44475A", fg: "#F8F8F2", muted: "#6272A4", line: "#3A3C4E", accent: "#BD93F9",
+      bg: "#282A36", surface: "#44475A", fg: "#F8F8F2", muted: "#ADB6D0", line: "#3A3C4E", accent: "#BD93F9",
       termBg: "#282A36", termFg: "#F8F8F2", termDim: "#6272A4", termGap: "#21222C",
     }, "#21222C #FF5555 #50FA7B #F1FA8C #BD93F9 #FF79C6 #8BE9FD #F8F8F2 #6272A4 #FF6E6E #69FF94 #FFFFA5 #D6ACFF #FF92DF #A4FFFF #FFFFFF"),
   },
diff --git a/src/topBar.ts b/src/topBar.ts
index 1aeb4de..74dc773 100644
--- a/src/topBar.ts
+++ b/src/topBar.ts
@@ -36,7 +36,7 @@ const ICONS = {
 
 /**
  * Fills `bar`, the window's top bar, with the New pane, Close pane, Reset layout and Settings buttons on its
- * right. Each button's tooltip names it with the platform's shortcut. In the macOS overlay title bar the bar
+ * right. Each button's popover tooltip names it with the platform's shortcut. In the macOS overlay title bar the bar
  * leaves room for the native window buttons and shows the title; dragging the bar moves the window.
  */
 export function createTopBar(bar: HTMLElement, options: TopBarOptions): void {
@@ -72,13 +72,22 @@ export function createTopBar(bar: HTMLElement, options: TopBarOptions): void {
     const button = document.createElement("button");
     button.type = "button";
     button.className = "top-bar-button";
-    button.title = `${name} (${platform === "macos" ? shortcut[0] : shortcut[1]})`;
     button.setAttribute("aria-label", name);
     // Not a keyboard target: the terminal keeps the keyboard, and clicks leave its focus alone.
     button.tabIndex = -1;
     button.addEventListener("mousedown", (event) => event.preventDefault());
     button.addEventListener("click", action);
     button.innerHTML = icon;
+    // A styled popover instead of the native title tooltip: it shows at once on hover and names the shortcut.
+    const tip = document.createElement("span");
+    tip.className = "top-bar-tooltip";
+    tip.setAttribute("role", "tooltip");
+    const label = document.createElement("span");
+    label.textContent = name;
+    const keys = document.createElement("kbd");
+    keys.textContent = platform === "macos" ? shortcut[0] : shortcut[1];
+    tip.append(label, keys);
+    button.append(tip);
     group.append(button);
   }
   bar.append(group);
```