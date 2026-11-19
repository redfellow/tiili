## 1. Launch handling

- [x] 1.1 Add `src-tauri/src/launch.rs` with `launch_action(args)` (Focus / NewWindow) and a table-driven unit test; add `windows::open_from_launcher` and `focus_last`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib launch`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [x] 1.2 Add `tauri-plugin-single-instance` to `src-tauri/Cargo.toml`, register it first in `run()` and route its argv through `launch_action`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cli::tests::commands_flags_and_bare_words_run_the_cli`

## 2. Platform entry points

- [x] 2.1 macOS Dock menu in `src-tauri/src/dock_menu.rs` (`applicationDockMenu:` on tao's delegate, New Window item calling `open_from_launcher`), installed in `setup`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [x] 2.2 Windows jump-list task "New Window" (`--new-window`) written at setup, cfg windows, errors logged
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [x] 2.3 Linux `.desktop` template `src-tauri/linux/tiili.desktop` with the `new-window` action, wired via `bundle.linux.deb.desktopTemplate` in `src-tauri/tauri.conf.json`
  - proof: `grep -E '^Actions=new-window;$' src-tauri/linux/tiili.desktop`
  - proof: `grep -E 'desktopTemplate' src-tauri/tauri.conf.json`

## 3. Docs and spec

- [x] 3.1 Document New Window from the Dock/taskbar per platform and the middle-click limits in `docs/packaging.md` and README
  - proof: `npx vitest run src/docs-sync/links.test.ts`
  - proof: `openspec validate new-window-from-the-dock-taskbar-icon-ri --strict`

## Manual checks after merge (The user)

- macOS: right-click the Dock icon → New Window opens on the current Space and takes focus; no jump to another Space.
- Windows: jump list New Window opens a window in the running tiili; relaunching from Start focuses the last window; only one process runs.
- Linux (.deb and AppImage): launcher right-click shows New Window and it opens a window in the running tiili.
- A second launch does not restore the session again.
