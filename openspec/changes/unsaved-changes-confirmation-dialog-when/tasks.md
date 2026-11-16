## 1. Unsaved detection

- [ ] 1.1 Add `dirty(session)` to `src/settingsSession.ts` (draft differs from saved by value) and rows for it in the table of `src/settingsSession.test.ts` (fresh, after edit, after edit back, after commit, after cancel)
  - proof: `npx vitest run src/settingsSession.test.ts`
  - proof: `npx eslint src/settingsSession.ts src/settingsSession.test.ts`

## 2. Native message box

- [ ] 2.1 Add `tauri-plugin-dialog` to `src-tauri/Cargo.toml`, register `tauri_plugin_dialog::init()` in the builder, add `@tauri-apps/plugin-dialog` to `package.json`, and grant `dialog:allow-message` in `src-tauri/capabilities/default.json`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [ ] 2.2 Add `confirmUnsaved(): Promise<"save" | "discard" | "keep">` to the backend's settings windows interface in `src/backend.ts`; implement it in `src/backend-tauri.ts` with the plugin's `message` (title `Settings`, text `You have unsaved settings changes.`, buttons Save / Discard / Cancel) and in `src/backend-ws.ts` with `window.confirm` (discard or keep)
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
  - proof: `npx vitest run src/backend-ws.test.ts src/backend.test.ts`

## 3. Ask before closing

- [ ] 3.1 In `src/settingsDialog.ts` add `requestClose()` to the form (read pending input, skip while saving, close at once if not dirty, else ask and Save / Discard / keep) and route both hosts' Esc paths to it; Cancel button keeps discarding at once; Esc on the reset question still only dismisses it. Pass the `confirmUnsaved` function in through `SettingsDialogOptions`
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 3.2 Make `onCloseRequested`'s handler return whether to close (`Promise<boolean>`): `src/backend.ts`, `src/backend-tauri.ts` (call `event.preventDefault()` on false), `src/main.ts` uses a new `SettingsPage.requestClose()`; the owning window's close path in Rust is unchanged
  - proof: `npx eslint src/main.ts src/backend.ts src/backend-tauri.ts src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Change the theme, press Esc: the message box appears; Cancel keeps Settings open with the new theme, Discard reverts and closes, Save saves and closes.
- Change the theme, click the settings window's close button: the same box appears and Cancel keeps the window open.
- Open Settings, change nothing, press Esc or close: it closes without asking.
- Change the theme and press the Cancel button: it closes without asking.
- With unsaved changes, close the tiili window that opened Settings: Settings closes without asking.
