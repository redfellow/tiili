## ADDED Requirements

### Requirement: List and open as JSON
`tiili list --json` SHALL print one JSON object `{"ok":true,"protocol","panes"}` with, per pane in `tiili list` order, `id`, `self`, `window`, `cwd`, `host`, `repo`, `title`, `label`, `running` and `attention`, every field present and unknown values `null`. `tiili open --json` SHALL print `{"ok":true,"protocol","pane"}`. Without `--json` output SHALL be unchanged.

#### Scenario: Own pane and a dev server
- **WHEN** pane 3 opened pane 8 with `tiili open -- npm run dev` and runs `tiili list --json`
- **THEN** pane 3 has `self` true, and pane 8 has `self` false and `running.command` `npm run dev`

#### Scenario: Pane at a prompt
- **WHEN** a pane's shell is at its prompt
- **THEN** its `running` is `null` and its `title` is `null` unless `--title` set one

#### Scenario: Open as JSON
- **WHEN** a process runs `tiili open --json -- npm test` and pane 9 opens
- **THEN** it prints `{"ok":true,"protocol":1,"pane":9}`

### Requirement: JSON errors
With `--json`, a failing `tiili list` or `tiili open` SHALL also print the error envelope `{"ok":false,"code","error","suggestion"}` on stdout, with the same exit code as without `--json`.

#### Scenario: Outside a pane
- **WHEN** `tiili list --json` runs where `TIILI_SOCKET` is not set
- **THEN** stdout holds the envelope with code `not_in_pane` and it exits 3

### Requirement: Described JSON output
`tiili describe` SHALL list the `--json` option of `list` and `open` and give each a JSON Schema of its JSON output.

#### Scenario: Describe list
- **WHEN** `tiili describe list` runs
- **THEN** its `output.json` is a schema naming the pane fields
