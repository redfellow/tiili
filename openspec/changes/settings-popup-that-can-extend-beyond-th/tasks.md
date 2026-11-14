## 1. Native settings window

- [x] 1.1 Add a `settings_open` Tauri command in `src-tauri/src/settings.rs` that creates or focuses the `settings-<owner>` window (centred over the owner, `index.html?settings=<owner>`, title `Settings`) and closes it when the owner closes; register it in `lib.rs`, add `settings-*` to `src-tauri/capabilities/default.json`, and keep `settings-*` windows out of pane-window lists (Move to Window, New Window numbering) through a `settings_window_label(owner)` / `is_settings_window(label)` pair with a table-driven unit test in `settings.rs`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib settings::`
- [x] 1.2 Add `openSettings(owner)`, a targeted `settings-preview` emit and `settings-closed` handling to the backend interface (`backend.ts`, `backend-tauri.ts`; `backend-ws.ts` reports no native settings window), and filter `settings-*` from the window list used by `windowMenu.ts`
  - Tests to update: src/backend.test.ts, src/windowMenu.test.ts
  - proof: `npx vitest run src/backend.test.ts src/windowMenu.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts src/windowMenu.ts`

## 2. Frontend

- [x] 2.1 Split the settings form out of the `<dialog>` in `src/settingsDialog.ts` so it mounts either as a page (settings window) or in the existing dialogue (browser dev fallback); drop the in-window header drag and its `dialog.settings` size limits in `src/styles.css` for the page mode
  - Tests to update: src/settingsSession.test.ts
  - proof: `npx vitest run src/settingsSession.test.ts`
  - proof: `npx eslint src/settingsDialog.ts`
- [x] 2.2 In `src/main.ts`, branch on the `settings` query parameter: settings mode renders the form, previews via `settings-preview` to the owner, Save saves and closes, Cancel/Esc/×/OS close send the saved settings and close; terminal mode's `openSettings` opens or focuses the native window (in-page dialogue on the browser backend), applies `settings-preview` events and refocuses the pane on `settings-closed`
  - proof: `npx eslint src/main.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Shrink the tiili window, open settings: the Settings window is larger than and can be dragged outside the tiili window.
- Change theme in the Settings window: the owning tiili window previews it; close with the OS close button and the old theme returns.
- Press ⌘, twice: one Settings window, brought to the front.
- With two tiili windows, Save in one window's Settings: both apply the saved settings.
- Close a tiili window with its Settings open: the Settings window closes too.
