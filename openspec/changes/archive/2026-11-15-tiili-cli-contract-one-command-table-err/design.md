# Design

## Command table
`control.rs` gains `CommandSpec { name, summary, usage, options: &[OptSpec], positionals, rest, needs: &[&str], output_text, output_schema: Option<&str>, exit_codes, errors: &[ErrorCode] }` and `pub const COMMANDS`. `cli::is_cli(args)` returns true when the first argument is a table name, `help`, `--help`, `-h`, `--version`, or any bare word (not starting with `-`); everything else (none, or dash-prefixed like `-psn_0_123`) goes to `tiili_lib::run()`. `main.rs` dispatches only through `is_cli`; `install-claude-skill` is a table entry whose runner calls `claude_skill::run_install`. `parse_args` looks commands and options up in the table; help text is formatted from it.

## Errors
`pub enum CliError` in `control.rs` with `code() -> &'static str`, `exit() -> i32`, `message()`, `suggestion() -> &'static str`. `Refusal` folds into it (`BadToken`, `Malformed`), and the app's open/list failures map to `OpenFailed`/`ListFailed`. `error_reply(&CliError)` writes `{"ok":false,"protocol":1,"code","error","suggestion"}`; `parse_reply` reads code and suggestion back (tolerating replies without them, from an older app) so the CLI prints the app's suggestion. Every error variant is listed once in an `ERRORS` table that describe also reads.

## Describe
Built with `serde_json::json!` from the tables (BTreeMap/ordered keys; no env reads) so the output is byte-stable. `PROTOCOL: u32 = 1`, `DESCRIBE_SCHEMA = "tiili.describe/1"`. Golden file `src-tauri/tests/fixtures/describe.json` with `"version": "<version>"`; the unit test substitutes `env!("CARGO_PKG_VERSION")`.

## Platforms
help/version/describe write before any socket use, after `attach_console()` so Windows release builds print to the parent console; through the `.cmd` shim the args pass unchanged. Named pipe and Unix socket paths are untouched apart from the reply shape.
