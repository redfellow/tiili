## Why

The settings dialogue is drawn inside the tiili window (`dialog.settings`, `max-height: calc(100vh - …)`), so in a
small tiili window it is cramped and scrolls, and it can never be bigger than the window or be moved beside it.
Reijo asked for the settings popup to be allowed to be larger than the tiili window, and chose a separate OS window.

## What Changes

- Settings opens in its own native window (label `settings-<owner window label>`), with its own size, which the user
  can move anywhere on screen and resize, including larger than the tiili window and outside it.
- The settings window belongs to the tiili window that opened it: its edits preview live in that window, Save saves
  and applies everywhere as today, Cancel/Esc/× (and closing the OS window) restore that window's saved settings.
- Opening settings again from the same tiili window focuses the existing settings window instead of opening another.
- Closing the owning tiili window closes its settings window (as Cancel).
- The in-page `<dialog>` and its header drag inside the window go away.

## Outcome

- Small tiili window
  - Now: the settings dialogue fills the window and scrolls, and stops at the window's edges when dragged
  - After: a separate `Settings` window opens at its own full size and can be dragged anywhere on screen
- Settings opened twice
  - After: the existing `Settings` window comes to the front

## Assumptions

- The settings window opens centred over the owning tiili window at the dialogue's natural size (about 720×640),
  clamped to the screen; ruled out remembering its last size and position.
- The settings window is not modal: the tiili window stays usable while it is open; ruled out blocking input to it.
- Each tiili window has its own settings window; ruled out one app-wide settings window previewing every window.
- The settings window's title is `Settings`; it is not listed in Move to Window menus or counted as a pane window.
