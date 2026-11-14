## 1. Scrub AppImage environment

- [x] 1.1 Add `src-tauri/src/appimage_env.rs` with the pure `scrub` function from design.md and a table-driven unit test: LD_LIBRARY_PATH with only AppImage paths -> removed; PATH mixed -> AppImage entries removed, order kept; single value inside APPDIR -> removed; sibling `/tmp/.mount_ABCdef` path kept; APPIMAGE/APPDIR/ARGV0/OWD removed; GDK_BACKEND=x11 removed, =wayland kept; unrelated vars untouched; no edits when APPDIR is unset, empty or `/`.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib appimage_env`
- [x] 1.2 Apply the scrub in `set_colour_env` (src-tauri/src/pty.rs) via `iter_full_env_as_str`, `env_remove` and `env`, reading `APPDIR` from the process environment; update its doc comment.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib pty`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)

- In the built AppImage on Linux, `env | grep -i mount_` in a tiili shell shows nothing.
- `curl --version` and `zypper <TAB>` (openSUSE) work in a tiili shell of the AppImage.
- On Wayland, a GTK app started from a tiili shell runs natively (not XWayland).
