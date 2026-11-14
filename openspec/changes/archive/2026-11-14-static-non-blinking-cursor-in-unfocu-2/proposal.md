## Why
Reijo: "inactive terminals shouldn't blink their cursors". With several panes open, the cursors in panes without focus still blink, which pulls the eye away from the pane being typed in.

## What Changes
- A pane without focus shows its outlined cursor steady, never blinking, whatever the Blink setting says.
- When a pane gets focus back, its cursor blinks again if Blink is on in settings.
- The pane-tiling "Focus appearance" requirement says so.

## Outcome

- Cursor in a pane without focus
  - Now: an outlined cursor that blinks
  - After: an outlined cursor that stays still
- Cursor in the focused pane
  - After: the style chosen in settings, blinking if Blink is on (unchanged)

## Assumptions
- Applies to terminal panes only. Heynote panes are left as they are, since their caret is the editor's own. This rules out also changing the editor caret.
- When the whole tiili window loses focus, the focused pane follows xterm's own focus state and its cursor stops blinking too. This rules out keeping the last-focused pane blinking.
