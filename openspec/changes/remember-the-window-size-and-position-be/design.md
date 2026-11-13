## Approach

Use `tauri-plugin-window-state` 2.x, registered with `Builder::default().with_state_flags(SIZE | POSITION | MAXIMIZED | FULLSCREEN)`. It saves on app exit / window close and restores when the window is created. It ignores a saved position that lies on no connected monitor; then the window keeps its config defaults, so adding `"center": true` gives "default size, centred on the main screen". When the saved state is off-screen the size is also reset by the builder only restoring size together with position: if the plugin version restores size alone, the build applies a small check in setup (outside every monitor → `set_size(900×600)` + `center()`).

Why: the official plugin covers macOS, Windows and Linux and avoids hand-written persistence. No permission is needed in `capabilities/default.json` since the frontend never calls the plugin.
