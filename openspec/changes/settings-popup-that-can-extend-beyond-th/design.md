## Approach

- Rust: a `settings_open` command creates (or focuses) a `WebviewWindow` labelled `settings-<owner>` loading
  `index.html?settings=<owner>`; closing the owner closes it. Add `settings-*` to `capabilities/default.json`'s
  windows (src-tauri/capabilities is not a human-only path). Exclude `settings-*` labels from pane-window lists
  (Move to Window, `recipients` of settings-changed is fine to include since it adopts the saved value).
- Frontend: `main.ts` branches on the `settings` query parameter. In settings mode it renders the existing settings
  form (refactored out of `settingsDialog.ts` so it mounts in a page body instead of a `<dialog>`), applies the theme
  to its own page, and sends each draft to the owner with an app event `settings-preview` (payload: settings) targeted
  at the owner label; Cancel sends the saved settings the same way and closes the window; Save calls
  `backend.saveSettings` (which already broadcasts `settings-changed`) and closes.
- Owner window: `openSettings` calls `settings_open`; listens for `settings-preview` and runs its existing `apply`.
  Focus returns to the current pane when the settings window closes (`settings-closed` event).
- Browser dev backend (`backend-ws.ts`) cannot open OS windows: it keeps the in-page dialogue as a fallback so Design
  previews still work.
- `createSettingsSession` keeps the draft/saved logic unchanged; its tests still apply.

Why: an in-page element cannot exceed the webview; only a separate native window can.
