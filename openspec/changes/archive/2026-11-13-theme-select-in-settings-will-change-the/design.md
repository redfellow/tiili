## Approach

- **Draft session, pure logic.** Add `src/settingsSession.ts`: `createSettingsSession(saved)` holding `saved` and
  `draft`, with `edit(next)` (returns whether the draft changed and so must be applied), `cancel()` (returns the saved
  settings to re-apply and resets the draft), and `commit()` (makes the draft the saved settings after a successful
  save). It has no DOM, so vitest (node environment, no jsdom in this repo) tests it directly.
- **Dialogue.** `src/settingsDialog.ts` drops `scheduleSave`/`SAVE_DELAY_MS`. Each `input`/`change` calls `edit` and
  `options.apply`. Save awaits `options.save(draft)`, then `commit()` and `dialog.close()`; on failure it reports in
  the status line and stays open. Cancel, × and the dialog's `cancel` event (Esc, prevented and routed) call
  `cancel()`, apply the returned settings if they differ from the draft, then close. Opening starts from the saved
  settings.
- **Theme list.** Replace the `<select>` with a `<div role="listbox" tabindex="0" aria-label="Theme">` of
  `role="option"` items with `aria-selected`; keydown Up/Down/Home/End moves selection, click selects; each move
  calls the same change path. A native `<select size=N>` was ruled out because WebKit does not reliably fire `input`
  while arrowing it on macOS and styles it poorly.
- **Styles.** `src/styles.css`: list box with a fixed max height and scroll, selected/focus styles from existing
  brand tokens, footer buttons laid out right.
