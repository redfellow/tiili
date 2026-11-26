## 1. Fix launch.rs checks

- [x] 1.1 Format `src-tauri/src/launch.rs` with rustfmt and replace `args.iter().any(|arg| *arg == NEW_WINDOW_ARG)` with `args.contains(&NEW_WINDOW_ARG)`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib launch::`
