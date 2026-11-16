## 1. Inset the running macOS icon

- [x] 1.1 Add `dock_inset` to `src-tauri/src/app_icon.rs` with a unit test. The test is table-driven over canvas sizes 512 and 1024 (the 1024 case gives 824 px at offset 100), named after the "Inset geometry" scenario.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib app_icon`
- [x] 1.2 In the macOS `set_icon`, draw the decoded icon into a transparent `NSImage` of the same size at the `dock_inset` rectangle, and set that image as the application icon. Leave the non-macOS `set_icon` unchanged. Enable any `objc2-app-kit`/`objc2-foundation` features this needs in `src-tauri/Cargo.toml`.
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)

- Install with `npm run install-app` and launch tiili. Its Dock icon is the same size as the neighbouring apps, in light and dark mode.
- Start a command that prints continuously, so the working animation plays. The animated frames are also the same size and do not jump in size.
