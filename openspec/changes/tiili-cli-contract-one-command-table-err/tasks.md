# Tasks

## 1. Contract core (control.rs)

- [x] 1.1 Add `CommandSpec`/`COMMANDS` (open, list, install-claude-skill, describe, help), table-driven `parse_args` and help text; replace `USAGE`. Table-driven unit test: every command parses, unknown command/option errors, help for each command.
  Tests to update: src-tauri/src/control.rs (parse_args tests), src-tauri/src/cli.rs (`only_open_and_list_run_the_cli`)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
- [x] 1.2 Add `CliError` (code, exit, message, suggestion) and `ERRORS`, folding `Refusal` in; `error_reply` writes `{"ok":false,"protocol":1,"code","error","suggestion"}`, requests and ok replies carry `protocol`, `parse_reply` reads code/suggestion and tolerates their absence. Extend the reply round-trip test.
  Tests to update: src-tauri/src/control.rs (refusal and reply tests), src-tauri/tests/control_server.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
- [x] 1.3 Add `describe(cmd)` building deterministic JSON from the tables (`schema`, `version`, `protocol`, `env`, commands with args, needs, output with hand-written schemas, `null` json for list, exit codes, errors); golden file `src-tauri/tests/fixtures/describe.json` with a `<version>` placeholder and a unit test comparing it.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`

## 2. CLI and entry point

- [x] 2.1 `cli.rs`: `is_cli` per design (table names, help flags, `--version`, bare words; dash-prefixed otherwise to the app); `run` handles help/version/describe offline and prints `tiili: <message>` + `hint: <suggestion>` with the `CliError` exit code; `main.rs` dispatches only through `is_cli` (install-claude-skill via the table), calling `attach_console` first. Extend the table-driven `is_cli` and `run` tests (help, `-h`, `--version`, describe offline, unknown word exits 2, `-psn_…` not CLI, outside pane exits 3).
  Tests to update: src-tauri/src/cli.rs, src-tauri/tests/control_cli.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cli::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test control_cli -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Docs

- [x] 3.1 Update `integrations/claude/skills/tiili-tiles/SKILL.md`: point at `tiili describe` / `tiili help` for the command reference and the `hint:` line on failure; keep the `TIILI_SOCKET` preflight.
  - proof: `grep -n "tiili describe" integrations/claude/skills/tiili-tiles/SKILL.md`
  - proof: `openspec validate tiili-cli-contract-one-command-table-err --strict`

## Manual checks after merge (The user)

- On macOS, Windows and Linux run `tiili --help`, `tiili --version` and `tiili describe` from a pane and from a plain terminal: output appears (Windows console attach included) and no second tiili window opens.
- Launch tiili from Finder/Dock on macOS: the app still starts.
