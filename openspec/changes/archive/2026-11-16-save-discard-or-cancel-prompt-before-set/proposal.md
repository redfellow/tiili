## Why

Reijo: "Settings should confirm closing them if there are unsaved changes". Today Esc and the settings window's OS close button silently throw away every previewed change, so one stray key loses a careful theme and font setup.

## What Changes

- When the draft differs from the saved settings, Esc and the settings window's OS close control ask first in a native OS message box with Save, Discard and Cancel buttons.
  - Save saves and closes, just like the Save button (a failed save keeps the window open and shows the error).
  - Discard reverts the preview and closes, as Esc does today.
  - Cancel (or dismissing the box) keeps the settings window open with the preview untouched.
- With no unsaved changes, Esc and the OS close control close at once, as today.
- The Cancel button still discards at once without asking, since pressing it is an explicit choice.
- Closing the tiili window that owns Settings still closes Settings silently without saving.
- Adds Tauri's dialog plugin (`tauri-plugin-dialog`, `@tauri-apps/plugin-dialog`) for the native message box.

## Outcome

- Esc after changing the theme
  - Now: the settings window closes and the theme reverts
  - After: a system message box reads `You have unsaved settings changes.` with `Save`, `Discard` and `Cancel` buttons
- Closing the settings window with its close button after a change
  - Now: the window closes and the theme reverts
  - After: the same message box; the window stays open until Save or Discard

## Assumptions

- The message box's text is `You have unsaved settings changes.` with title `Settings`; ruled out wording that names the changed settings.
- In the dev-server build (no Tauri), the question is the browser's `window.confirm` (OK discards, Cancel keeps editing) with no Save option; ruled out building an in-page three-button dialog only for development.
- Unsaved means the draft differs from the saved settings by value (`same`); a change undone by hand counts as no change. Ruled out tracking "touched" fields.
- A scrollback number still being typed counts as a change once Esc is pressed (the form is read first), as Save does today.
- Esc while the "Reset all settings?" question shows still only dismisses that question.
