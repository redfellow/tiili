## Approach
New module `src-tauri/src/appimage_env.rs` with a pure function
`scrub(appdir: Option<&str>, env: impl Iterator<Item=(String, String)>) -> Vec<EnvEdit>` where `EnvEdit` is `Set(key, value)` or `Remove(key)`. It returns no edits when `appdir` is None, empty or `/`.

Rules per variable: drop `APPIMAGE`, `APPDIR`, `ARGV0`, `OWD`; drop `GDK_BACKEND` when it is `x11`; for a value containing `:`, keep the entries that are not `$APPDIR` or under `$APPDIR/` (order kept), Remove when none remain, Set when some were dropped; a single value at or under `$APPDIR` is Removed. Empty entries in a list are kept as they were.

`set_colour_env` (pty.rs), which every PTY spawn path calls, first reads `CommandBuilder::iter_full_env_as_str`, calls `scrub` with `std::env::var("APPDIR").ok()` and applies the edits with `env_remove`/`env`. Pure function keeps it testable on macOS.

GDK_BACKEND: linuxdeploy-plugin-gtk exports `GDK_BACKEND=x11` unconditionally, so on Wayland it would push GTK apps from tiili shells to XWayland; we remove it (see proposal assumption).
