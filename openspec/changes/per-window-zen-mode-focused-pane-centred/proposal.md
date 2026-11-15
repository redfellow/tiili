# Zen mode

## Why
With several panes open, the user sometimes wants to work in one terminal at a comfortable reading width without closing the others (like tmux `prefix z`, iTerm2/Ghostty ⇧⌘↩, VS Code's centred Zen layout).

## What Changes
- New per-window Zen mode: only the focused pane shows, centred, full height of the pane area, at the Zen width (default 140 columns of its font, min 80, never wider than 90% of the window's pane area). Other panes stay alive and hidden; toggling off restores the grid exactly.
- Toggle: a Zen icon at the right end of every pane's title row (not with one pane), ⇧⌘↩ / Ctrl+Shift+Enter, Shell ▸ Zen Mode on macOS, double-click on the title row.
- Zen follows focus (focus by number, ⌘J, new pane, closing the Zen pane); `tiili open` does not move it; layout actions leave Zen first; moving the Zen pane away ends Zen in this window.
- Dragging either side edge resizes the Zen pane symmetrically and saves the width to a new app-wide "Zen width" setting.
- A dot on the lit Zen icon while a hidden pane in the window has an attention mark.

## Outcome
- Pane title row
  - After: a dim maximise-style icon at the right end, tooltip `Zen mode ⇧⌘↩` (`Zen mode Ctrl+Shift+Enter` on Windows/Linux)
- macOS Shell menu
  - After: `Zen Mode ⇧⌘↩`
- Settings, Behaviour tab
  - After: `Zen width` number field in columns, default `140`

## Assumptions
- The Zen width setting sits in the Behaviour tab under Tiling, range 80–400 columns; ruled out a separate tab.
- An invalid or missing saved Zen width falls back to 140 (out-of-range values clamp); ruled out rejecting the settings file.
- Zen state is not persisted across restarts (session restore has not landed); ruled out building persistence now.
- Hidden panes keep their PTY size and refit once on leaving Zen; ruled out resizing them while hidden.
