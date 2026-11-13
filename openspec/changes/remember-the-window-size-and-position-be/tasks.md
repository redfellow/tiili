## 1. Window state

- [ ] 1.1 Add `tauri-plugin-window-state = "2"` to `src-tauri/Cargo.toml`, register it in `src-tauri/src/lib.rs` with flags SIZE | POSITION | MAXIMIZED | FULLSCREEN, and add the off-screen fallback (900×600, centred) if the plugin leaves the saved size in place
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [ ] 1.2 Set `"center": true` on the main window in `src-tauri/tauri.conf.json`
  - proof: `grep -E '"center": true' src-tauri/tauri.conf.json`
  - proof: `openspec validate remember-the-window-size-and-position-be --strict`

## Manual checks after merge (The user)

- Resize to 1280×720, move, quit, relaunch: same size and place (macOS, Windows, Linux).
- Quit while maximised and while fullscreen: reopens the same way.
- Close on an external monitor, unplug it, relaunch: 900×600 centred on the main screen.
