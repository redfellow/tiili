# Design

`design-reference.md` in the card plan folder is the reference for where each change goes; it is not a patch to apply. Follow it, with these adjustments:

- **Settings model (`src/settings.ts`).**
  - Add `CURSOR_STYLES = ["block","underline","bar"]` and a `cursor: { style, blink }` setting. `normalize` falls back to each field's default on its own.
  - `DEFAULT_SETTINGS.theme` becomes `koski`. An unknown theme also falls back to Koski.
  - The weight steps and the letter-spacing range change as in the prototype. Font weight defaults to 100.
  - Old settings files have no `cursor` key, so they load with the cursor defaults and keep their saved theme.
- **Cursor (`src/terminal.ts`).** `applyFont`, which every pane already runs on preview, sets `cursorStyle` and `cursorBlink`, so cursor changes apply live to all terminals. `openTerminal` starts from the settings and sets `allowProposedApi: true` for the ligatures addon. The inactive cursor stays an outline.
- **Dialog (`src/settingsDialog.ts`).**
  - One generic `pickList`, a grouped listbox, serves both themes and font families.
  - `rangeInput` provides the sliders.
  - The installed fonts come from `queryLocalFonts`, falling back to probing a list of common fonts. They are listed in the background after the dialog opens.
  - The header drag uses pointer capture.
  - The cursor style labels are `Brick`, `Underline` and `Bar`.
- **Themes (`src/themes.ts`).** Export `contrast()` and add the `--on-accent` and `--focus` tokens. Apply the tuned palettes.
- **CSS and assets.** Add `@font-face` rules for the variable fonts and remove the static Geist files. Add the styles for the tooltip, list, swatch, range, header drag and shadow.
- **Top bar (`src/topBar.ts`).** Each button gets a `role=tooltip` span instead of a `title`. The tooltip shows on hover with no transition delay.
