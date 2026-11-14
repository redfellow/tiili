## Why

The settings dialogue's "Reset to defaults" button switches every setting on every tab back to its default with a single click, so a stray click wipes out a careful setup in the preview. Reijo asked for the button to confirm first.

## What Changes

- Pressing "Reset to defaults" no longer resets at once. The footer shows "Reset all settings?" with **Reset** and **Keep** buttons in place of the reset button.
- **Reset** sets every setting to its default as a preview, as the button does today: nothing is saved until Save, and Cancel still returns to the settings from when the dialogue opened.
- **Keep** or Esc while asking puts the "Reset to defaults" button back and changes nothing. Esc does not close the dialogue in that case.
- Reopening the dialogue, or locking it while it saves, never leaves the question showing.

## Outcome

- Footer after pressing the reset button
  - Now: every setting jumps to its default at once
  - After: `Reset all settings?` `Reset` `Keep`
- Footer at rest
  - Now: `Reset to defaults`
  - After: `Reset to defaults` (unchanged)

## Assumptions

- Focus moves to Keep when the question appears, so Enter does not reset by accident. The alternative was to focus Reset.
- Pressing Reset or Keep shows the "Reset to defaults" button again and gives it focus. The alternative was to leave focus where it falls.
- Opening the dialogue, or the dialogue's existing reset (the `reset()` it runs on open), closes the question. The alternative was to keep the question showing across a reopen.
