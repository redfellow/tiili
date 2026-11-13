## Why

tiili always opens at 900×600 in its default place: `src-tauri/tauri.conf.json` fixes the main window's size and nothing saves or restores window state. A user who resizes the window (say to 1280×720 for a recording) has to do it again on every launch.

## What Changes

- Add the official `tauri-plugin-window-state` (Rust side only) and register it in `src-tauri/src/lib.rs`, so the main window's size, position, maximised and fullscreen state are saved when tiili closes and restored on launch.
- Set `"center": true` on the main window in `tauri.conf.json`, so the default (first launch, or a saved position that is off every connected screen) is 900×600 centred on the main screen.
- New capability spec `window-state`.

## Outcome

- Relaunch after resizing to 1280×720
  - Now: `opens at 900×600 in the default place`
  - After: `opens at 1280×720 where it was last closed`
- Saved position on an unplugged monitor
  - After: `opens at 900×600 centred on the main screen`

## Assumptions

- Only the main window's geometry and maximised/fullscreen state are kept; visibility and decorations are not (the plugin's flags let us exclude them), rather than saving every flag.
- State is stored in the plugin's own file in the app config folder, not in tiili's settings file, and there is no setting to turn it off.
- No frontend JS bindings are added; the Rust plugin saves on exit by itself.
