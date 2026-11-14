## 1. Confirm reset

- [ ] 1.1 In `src/settingsDialog.ts`, replace the reset button's direct reset with the inline "Reset all settings?" Reset/Keep group in the footer: Esc while it is shown cancels the question and not the dialogue, the form's `reset()` hides it, and `lock()` hides and disables it. Add its styling in `src/styles.css`.
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Open settings, choose Nord, press "Reset to defaults": the footer asks "Reset all settings?" with Reset and Keep and the theme stays Nord. Press Keep: the button returns and the theme is still Nord.
- Press "Reset to defaults" and then Esc: the question goes away and the settings window stays open.
- Press "Reset to defaults" and then Reset: Koski and the other defaults are previewed. Cancel brings Nord back.
