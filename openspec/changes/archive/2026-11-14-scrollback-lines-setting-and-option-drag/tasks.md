## 1. Setting
- [x] 1.1 Add the scrollback setting, range and default to `src/settings.ts` with table-driven normalize cases (default, clamp, invalid) in `src/settings.test.ts`
  Tests to update: src/settings.test.ts
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settings.test.ts`
- [x] 1.2 Add the "Scrollback lines" field to Behaviour › Panes in `src/settingsDialog.ts`; apply `scrollback` live and set `macOptionClickForcesSelection: true` in `src/terminal.ts`
  - proof: `npx vitest run src/settingsSession.test.ts`
  - proof: `npx eslint src/settingsDialog.ts src/terminal.ts src/settingsSession.ts src/settingsSession.test.ts`
  - proof: `npm run typecheck`

## 2. Move payload at the cap
- [x] 2.1 Add a unit test in `src-tauri/src/windows.rs` round-tripping a `MovePayload::Terminal` with 100 000 lines of 200 columns through serde JSON intact
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib windows`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `openspec validate scrollback-lines-setting-and-option-drag --strict`

## Manual checks after merge (The user)
- Set Scrollback lines to 50 000; open panes keep more history; restart keeps the value.
- Fill a pane with ~100 000 lines and move it to another window; history arrives whole and promptly.
- macOS: Option-drag in vim/htop selects; plain Option-click moves the shell cursor; double/triple-click select word/line.
- Windows/Linux: Shift-drag still selects over mouse-reporting programs.
