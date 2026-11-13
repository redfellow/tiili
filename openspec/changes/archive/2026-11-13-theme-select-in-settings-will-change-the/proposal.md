## Why

Reijo wants to try settings out before keeping them: walking through the themes with the arrow keys or clicks should
recolour tiili at once, every other field should show its effect as it is edited, and he decides at the end whether to
keep the result (Save) or go back (Cancel). Today the theme is a native dropdown that only reports a pick once the
popup closes, and every change is saved automatically 300 ms later, so there is no way back.

## What Changes

- The Theme dropdown becomes an always-visible list of the themes in the dialogue (a single-select listbox). Moving
  through it with the arrow keys (Up/Down, Home/End) or clicking a theme name applies that theme immediately.
- Every other field keeps applying its value live, as today, but nothing is saved while the dialogue is open.
- The dialogue footer gets **Cancel** and **Save** buttons. Save writes the settings to the settings file and closes
  the dialogue. Cancel restores the settings from when the dialogue was opened, applies them and closes without saving.
- Esc and the × button act like Cancel.
- Reset to defaults stays: it previews the defaults like any other edit; Save or Cancel decides.
- If saving fails, the dialogue stays open with the error in its status line and the previewed settings stay applied.

## Outcome

- Theme control
  - Now: a drop-down `Theme` select
  - After: a visible list of theme names (`System`, `tiili Light`, `tiili Dark`, …) with the current one highlighted
- Dialogue footer
  - Now: `Reset to defaults`
  - After: `Reset to defaults` · `Cancel` · `Save`

## Assumptions

- The theme list shows every theme at once in a scrolling box inside the Theme section, rather than with colour
  swatches beside each name (swatches ruled out as extra scope).
- Typing in a text or number field still applies on each keystroke as today, rather than only when the field is left.
- Save is the default (Enter) button only when focus is not in the theme list or a text field; Enter is not given a
  new meaning, rather than making Enter submit everywhere.
- Opening the settings from the menu while the dialogue is open keeps doing nothing, rather than discarding the draft.
