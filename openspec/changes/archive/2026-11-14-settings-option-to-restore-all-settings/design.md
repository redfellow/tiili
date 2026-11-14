## Approach

All of the change is in `createSettingsForm` in `src/settingsDialog.ts`. The footer keeps the existing reset button and gets a hidden confirmation group beside it: a "Reset all settings?" label with Reset and Keep buttons. Clicking the reset button hides the button, shows the group and focuses Keep. Reset runs the existing `change(DEFAULT_SETTINGS); show(session.draft)` and then hides the group. Keep hides the group. Either button gives focus back to the reset button.

Esc: the group handles `keydown` for Escape itself. While the question is showing it calls `preventDefault()` and `stopPropagation()` so that it cancels the question and not the dialogue. The page-mode handler on `document` already skips events whose default was prevented. In the `<dialog>` mode, preventing the keydown default stops the dialogue's `cancel` event.

The form's `reset()` (run on open) and `lock()` (run while saving) hide the group, and `lock` disables its buttons. The group reuses the muted `.settings-reset` look with a small CSS rule in `src/styles.css`.

An inline group is used, not a native dialog, because it was the user's choice: it stays inside the settings window and needs no new permission.
