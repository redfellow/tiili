## Approach

- **Settings model (`src/settings.ts`, pure)**: `Settings` type, `DEFAULT_SETTINGS`, `normalize(unknown): Settings` (clamp/replace per field). Unit tested.
- **Persistence (Rust, `src-tauri/src/settings.rs`)**: commands `settings_load() -> serde_json::Value` and `settings_save(value)` on `app_config_dir()/settings.json`; write to a temp file then rename. Missing/unparseable file → `null` (frontend normalizes to defaults). Path logic in a function taking a dir so `cargo test` covers it with a temp dir.
- **Themes (`src/themes.ts`)**: registry `{ id, name, kind: 'light'|'dark', tokens: Record<string,string> }` holding chrome tokens (`--bg`, `--surface`, `--fg`, `--muted`, `--line`, `--accent`, `--term-bg`, `--term-fg`, `--term-dim`, `--term-gap`, `--ansi-0..15`). `system` sets no inline tokens (tiili.css media query applies). Applying a theme sets the tokens as inline custom properties on `:root` and re-runs `terminalTheme(documentTokens())`; `followSystemTheme` only re-applies when theme is `system`. Test checks every theme has all required tokens as valid hex and that ANSI foregrounds reach WCAG 3:1 against `--term-bg` (table-driven).
- **Variant palettes** (from Reijo's brand artifact): core colours tiili `#A4472B`, klinkkeri `#6B2A1E`, savi `#C9764F`, laasti `#E8DECD`, kalkki `#F6F1E9`, graniitti `#8D877D`, koski `#182023`, rauta `#3A3F45`, ikkuna `#8FA6A4`, muratti `#861B22`, koivu `#D9A43A`, sammal `#6E7F4E`, taivas `#6F97B3`.
  - Savi (light): warm grounds bg `#F3EEE7`, surface `#FBF8F4`, fg `#2A2321`, muted `#6F6560`, line `#DDD3C8`; accent savi/tiili.
  - Muratti (dark): bg `#151112`, surface `#1E1919`, fg `#EFE7DE`, muted `#A0948C`, line `#342B29`; accents muratti, koivu, `#F3E7DC`.
  - Koski (dark): window `#0F1516`, pane `#182023`, gap `#0B0F10`, fg `#C9CFCD`, dim `#6E7876`, ok `#8FB59A`; accents savi, tiili, ikkuna.
  - Laasti (light): mortar-grid tiili, klinkkeri, savi, rauta on laasti `#E8DECD`.
  - Each derives its ANSI 0–15 from the brand light/dark sets, shifted to the ground and its accents, meeting the contrast test.
- **Fonts**: `applyFont(term, settings)` sets `fontFamily` (`"<name>", "Geist Mono", monospace`), `fontSize`, `fontWeight`, `fontWeightBold`, `lineHeight`, `letterSpacing`, loads/disposes the ligatures addon, then `fit()`.
- **Dialogue (`src/settingsDialog.ts`)**: `<dialog>` element styled with brand tokens and Geist sans; theme `<select>`, font fields; each change → normalize → apply → debounced save (300 ms).
- **Opening**: `settingsShortcut(event, platform)` in `src/keymap.ts` (⌘, / Ctrl+,), handled in `attachCustomKeyEventHandler`; macOS app-menu item "Settings…" emitting `open-settings`; context menu gains "Settings…".

## Platform differences

- macOS: ⌘, and app menu; config in `~/Library/Application Support/<id>/`.
- Windows: Ctrl+, ; `%APPDATA%\<id>\`. Linux: Ctrl+, ; `~/.config/<id>/`.
- Ligature rendering depends on the webview's font support; checked by hand on each.

## Risks

- Ligatures addon needs a font with ligatures and may cost rendering speed; off by default.
