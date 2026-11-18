## Why

The Close pane button sits in the window's top bar, away from the pane it closes. It belongs on the pane itself, next to the Zen icon, and like Zen it should only show while the pointer is over the pane.

## What Changes

- Each pane's title row gets a close icon right of the Zen icon. It shows while the pointer is over the pane, is hidden when only one pane is open (like Zen), has the tooltip "Close pane" with ⌘W / Ctrl+Shift+W, and closes that pane (not necessarily the focused one).
- The Close pane button leaves the top bar. ⌘W / Ctrl+Shift+W are unchanged.

## Outcome

- Top bar buttons
  - Now: `New pane, Heynote, Close pane, Reset layout, Settings`
  - After: `New pane, Heynote, Reset layout, Settings`
- Hovering a pane with two panes open
  - Now: the Zen icon at the right of the title row
  - After: the Zen icon and a × close icon beside it, tooltip `Close pane ⌘W`

## Assumptions

- Clicking a pane's close icon closes that pane, even if another pane has focus. The alternative, closing the focused pane, would surprise the user who clicked a specific pane.
- The close icon does not show with the attention dot, unlike Zen; only hover shows it. The alternative was to mirror Zen's dot rule, which has no meaning for close.
- The icon reuses the top bar's × glyph.
