## 1. Settings model and storage

- [x] 1.1 Merge `origin/main`. Add pure `src/settings.ts` (`Settings`, `DEFAULT_SETTINGS`, `normalize`) and table-driven `src/settings.test.ts` (first line `// @harvaaja-test-tier: fast`): defaults, clamping, wrong types per field, unknown theme id → System
  - proof: `npx vitest run src/settings.test.ts`
- [x] 1.2 Add `src-tauri/src/settings.rs` with `settings_load`/`settings_save` on the app config dir (atomic write; missing or broken file → null) and unit tests on a temp dir (round trip, missing, broken JSON)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml settings`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## 2. Themes and fonts

- [x] 2.1 Add `src/themes.ts` registry (System, tiili Light/Dark, Savi, Muratti, Koski, Laasti, Solarized Light/Dark, Gruvbox Dark, Nord, Dracula) and `applyTheme`; make `followSystemTheme` in `src/theme.ts` only follow the OS for System; record the variant palettes in `docs/brand/README.md`. Table-driven `src/themes.test.ts` (fast tier): every theme has all tokens as hex (no WCAG contrast check on this first pass, per Reijo; the palettes get revised once they can be seen)
  - Tests to update: src/theme.test.ts
  - proof: `npx vitest run src/themes.test.ts src/theme.test.ts`
- [x] 2.2 Add `@xterm/addon-ligatures`; `applyFont(term, settings)` in `src/terminal.ts` (family with Geist Mono fallback, size, weights, ligatures addon on/off, line height, letter spacing, refit)
  - proof: `npx eslint src/terminal.ts`

## 3. Dialogue and opening

- [x] 3.1 Add `settingsShortcut(event, platform)` to `src/keymap.ts` with rows in `src/keymap.test.ts` (⌘, macOS, Ctrl+, Windows/Linux, cross-platform → null; clipboard rows unchanged)
  - Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
- [x] 3.2 Add `src/settingsDialog.ts` (`<dialog>` with Theme and Font sections, Reset to defaults, live apply, debounced save), wire load at start in `src/main.ts`, shortcut handling, context-menu "Settings…" in `src/clipboard.ts`, macOS app-menu "Settings…" in `src-tauri/src/lib.rs`; styles in `src/styles.css` with brand tokens only
  - proof: `npx eslint src/settingsDialog.ts src/main.ts src/clipboard.ts`
  - proof: `npm run typecheck`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## Manual checks after merge (The user)

- On macOS, Windows and Linux: open settings by shortcut, context menu and (macOS) app menu; Esc closes it.
- Try every theme; check the variants look right against the brand and that System still follows the OS.
- Set a ligature font (e.g. JetBrains Mono), toggle ligatures, change size, weights, line height and spacing; the terminal refits and the shell gets the new size.
- Restart tiili and check settings stay; corrupt `settings.json` and check tiili still starts with defaults.
