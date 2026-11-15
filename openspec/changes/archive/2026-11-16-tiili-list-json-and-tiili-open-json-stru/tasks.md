# Tasks

## 1. Contract and CLI

- [x] 1.1 `control.rs`: grow `PaneInfo` to the full record (all fields serialized, lenient deserialize), keep `list_lines` output identical (title or label); parse `--json` for `open` and `list`; add the option and `output_schema`s to `COMMANDS`; regenerate `tests/fixtures/describe.json`. Extend the table-driven parse, list-lines and describe tests (including the `list` `output.json` no longer being null).
  Tests to update: src-tauri/src/control.rs, src-tauri/tests/fixtures/describe.json
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
- [x] 1.2 `cli.rs`: with `--json` print the success object or the error envelope on stdout (stderr and exit codes unchanged). Extend the cli table tests and `tests/control_cli.rs` (its fake handler builds the new `PaneInfo`) with one `list --json`, one `open --json` and one `not_in_pane` envelope case.
  Tests to update: src-tauri/src/cli.rs, src-tauri/tests/control_cli.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cli::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`

## 2. App side

- [x] 2.1 `control_app.rs`: `PaneTitles` also keeps each open's argv (forgotten in `forget_session`); `AppHandler::list` builds records from `SessionReports`, the title/argv record, `place_name`, `SessionRegistry::running` and the attention registry, with `self` from the caller and `window` the label. A pure record-building function with one table-driven test (prompt, shell command, opened argv joined with quoting, title override, attention mark, no report yet).
  Tests to update: src-tauri/tests/control_server.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control_app::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test control_server --test control_cli -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `openspec validate tiili-list-json-and-tiili-open-json-stru --strict`

## Manual checks after merge (The user)

- In a tiili window with a shell pane, a `tiili open -- npm run dev` pane and a marked pane, run `tiili list --json`: `self`, `running.command` and `attention` are right; `tiili list` prints as before.
