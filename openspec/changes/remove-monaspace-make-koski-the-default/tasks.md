## 1. Settings model

- [x] 1.1 In `src/settings.ts`, add cursor settings (`CURSOR_STYLES`, `cursor: { style, blink }`, default block/blink, per-field fallback in `normalize`), make `koski` the default and fallback theme, set the default weight to 100 with steps of 10, and set letter spacing to −2…5 in steps of 0.1. Update the table-driven cases in `src/settings.test.ts`: System→Koski fallbacks, weight snapping, the letter-spacing clamp, and the valid-settings case with a cursor. Add these cases: missing cursor, invalid style (`"beam"`), wrong-type blink, a saved old file (Nord, no cursor) keeping Nord, and negative letter spacing.
  Tests to update: src/settings.test.ts
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settings.test.ts`

## 2. Themes

- [x] 2.1 In `src/themes.ts`, export `contrast()`, add the `--on-accent` and `--focus` tokens, and apply the tuned palettes from the reference. In `src/themes.test.ts`, add a table-driven test over the fixed themes: `--fg` and `--muted` reach at least 4.5:1 on `--bg` and `--surface`, and `--focus` reaches at least 3:1 on both. Tune any colour that still fails.
  Tests to update: src/themes.test.ts
  - proof: `npx vitest run src/themes.test.ts`
  - proof: `npx eslint src/themes.ts src/themes.test.ts`

## 3. Terminal, fonts and UI

- [x] 3.1 In `src/terminal.ts`, apply `cursorStyle` and `cursorBlink` in `applyFont` and at open, and set `allowProposedApi: true` for ligatures.
  - proof: `npx eslint src/terminal.ts`
- [x] 3.2 Replace the static Geist Mono files with `GeistMono-Variable`/`-Italic-Variable.woff2`. Add the Victor Mono, Commit Mono, Recursive Mono and Cascadia Code woff2 files from the upstream releases named in the reference `LICENSES.md`, add `src/assets/fonts/LICENSES.md` with no Monaspace, and add the `@font-face` rules in `src/styles.css`.
  - proof: `ls src/assets/fonts`
  - proof: `grep -c "@font-face" src/styles.css`
- [x] 3.3 In `src/settingsDialog.ts` and `src/styles.css`:
  - Add the grouped `pickList` for themes (System, Dark, Light, swatch on the left, muted "(default)" on Koski, 4–5 rows high) and for families (Bundled and OS).
  - Make weight, bold weight, line height and letter spacing sliders with a fill and a readout.
  - Add the Cursor section: Style dropdown labelled `Brick`, `Underline`, `Bar` and a Blink checkbox.
  - Remove the backdrop dimming and add a shadow; make the dialog draggable by its header.
  - Use the design-system input styles.
  - proof: `npx eslint src/settingsDialog.ts`
- [x] 3.4 In `src/topBar.ts` and `src/styles.css`, replace each button's `title` with a `role=tooltip` popover showing the name and a `kbd` shortcut, visible at once on hover.
  - proof: `npx eslint src/topBar.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Restart the preview so the removed static Geist files drop out, then open Settings.
- **Theme list:** Koski shows a muted "(default)". The list is grouped into System, Dark and Light, with swatches on the left.
- **Font family:** the Bundled and OS groups work with the arrow keys, and each name is drawn in its own font.
- **Sliders and ligatures:** the sliders change the terminal live, letter spacing can go negative, and turning on Ligatures gives no error.
- **Cursor:** Brick, Underline and Bar and Blink apply live to every pane and survive a restart.
- **Saved settings:** a settings file saved before this change keeps its theme.
- **Dialog:** it does not dim the window, it drags inside the window, and it opens centred again.
- **Tooltips:** they appear immediately on all four top-bar buttons.
