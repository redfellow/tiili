## 1. Draft session

- [ ] 1.1 Add `src/settingsSession.ts` (saved/draft, `edit`, `cancel`, `commit`) and a table-driven
  `src/settingsSession.test.ts` (first line `// @harvaaja-test-tier: fast`) covering: edit marks change only when
  different; cancel returns the opening settings; commit makes the draft the new baseline; cancel after commit returns
  the committed settings.
  - proof: `npx vitest run src/settingsSession.test.ts`
  - proof: `npx eslint src/settingsSession.ts src/settingsSession.test.ts`

## 2. Dialogue

- [ ] 2.1 In `src/settingsDialog.ts` remove the autosave timer; add Cancel and Save buttons to the footer; Save awaits
  `options.save`, commits and closes (stays open with the error on failure); Cancel, × and Esc (dialog `cancel`
  event) revert via the session, re-apply and close. Update the `save` doc comment in `SettingsDialogOptions`.
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.2 Replace the theme `<select>` with a focusable `role="listbox"` of `role="option"` items: Up/Down/Home/End
  and click select and apply at once; keep `aria-selected` and scroll the selected item into view; focus it on open.
  Add the list and footer button styles to `src/styles.css`.
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Open Settings, focus the theme list and arrow through it: each theme applies immediately; click a theme name too.
- Change the font size, press Cancel: the old size returns; repeat with Esc and ×; relaunch: the old settings load.
- Change the theme and font, press Save: the dialogue closes and the settings survive a relaunch.
