# Design

## Wire
`PaneInfo` grows to the full record (`id, self, window, cwd, host, repo: Option<RepoRecord>, title: Option<String>, label, running: Option<RunningRecord>, attention: Option<AttentionRecord>`), every field serialized (`null`, never skipped). Deserialising stays lenient (`#[serde(default)]`) so an older app's `{id,cwd,title}` reply still parses. `list_lines` prints `id\tcwd\t(title or label)` — byte-identical to today.

## App
`AppHandler::list` fills the record from `SessionReports` (cwd, host, repo), `PaneTitles` (title), `place_name` (label), `SessionRegistry::running` (running; null when neither field is known or the shell is at its prompt) and `attention::Attention` registry (`list()` by session). `PaneTitles` becomes `PaneOpens` holding `{title, argv}` per session (forgotten in `forget_session`); when `Running.command` is None and a recorded argv exists, `command` is the argv joined with shell quoting (`shlex`-style, a small local function).

## CLI
`parse_args` accepts `--json` on `open` and `list` (`CliCommand::Open{json}`, `List{json}`). `execute` returns the reply; `cli::run` prints `serde_json` of `{"ok":true,"protocol",..}` or, on error with json, `error_reply`-shaped envelope on stdout plus the usual stderr text. `COMMANDS` gets the `--json` option and `output_schema` JSON Schemas for list and open; golden `describe.json` regenerated.

## Tests
One table-driven test for the joined command and the record building (pure function taking reports, title/argv, running, mark); the control tests extend their parse/print tables with `--json` cases; `control_cli` integration test checks one `list --json` and one error envelope.
