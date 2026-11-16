## Approach

- `settingsSession.ts` gains `dirty(session)` (draft differs from saved by `same`), unit-tested in its table.
- The backend gains `confirmUnsaved(): Promise<"save" | "discard" | "keep">`. The Tauri backend uses `@tauri-apps/plugin-dialog`'s `message` with `buttons: { yes: "Save", no: "Discard", cancel: "Cancel" }` and maps the result. The WebSocket (dev) backend uses `window.confirm` (discard or keep). Rust registers `tauri_plugin_dialog::init()` and the default capability grants `dialog:allow-message`.
- `createSettingsForm` gets `requestClose()`: reads the form (`changed()`), returns at once when saving; if not dirty it calls `revert()`; otherwise it asks, then calls `commit()`, `revert()` or does nothing. Both hosts' Esc paths (the `<dialog>` cancel event and the page keydown handler) call `requestClose()` instead of `revert()`. The Cancel button keeps calling `revert()`.
- OS close: `settingsWindows.onCloseRequested` handler becomes `() => Promise<boolean>` (true = let it close). The Tauri backend calls `event.preventDefault()` when it returns false. `SettingsPage` gains `requestClose(): Promise<boolean>` used by `main.ts`; Save in that path closes via `onClose` as usual and returns false to avoid a double close.
- Closing the owning tiili window is handled in Rust and is not touched.

Why a native box: Reijo chose it; it also works while the settings window is the OS-close target without in-page layout changes.
