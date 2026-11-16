## 1. Fix

- [ ] 1.1 Add `is_local_file_uri` in `src-tauri/src/links.rs` (tauri::Url host exact match / none / "" / localhost, reject UNC, VerbatimUNC, DeviceNS prefixes), use it in `classify_url_on`, delete `file_host`; add Deny/Confirm cases from the card to `scheme_rules` in `src-tauri/tests/links.rs`
  - Tests to update: src-tauri/tests/links.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test links`
- [ ] 1.2 In `link_open`, route scheme `file` through `to_file_path` + `existing()`; error "{abs} would run a program, so tiili only reveals it" when reveal_only, else `open_path`; failed conversion errors "tiili can't open {uri}"
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [ ] 1.3 Extend `is_reveal_only` lists per the Launcher types requirement; add a table case in `src-tauri/tests/links.rs` that `notes.terminal` via `inspect(Os::MacOs, …)` is reveal_only
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test links`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib links`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test links -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `openspec validate terminal-links-file-osc-8-links-bypass-r --strict`

## Manual checks after merge (The user)

- In `npm run tauri dev`, with executable `/tmp/t.command`, run `printf '\e]8;;file:///tmp/t.command\e\\x\e]8;;\e\\\n'`, ⌘-click and confirm: tiili says it only reveals it and Terminal does not open.
