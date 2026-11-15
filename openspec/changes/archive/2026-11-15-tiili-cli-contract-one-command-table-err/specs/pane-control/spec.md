## ADDED Requirements

### Requirement: Command-line help and version
`tiili help [CMD]`, `tiili --help` and `tiili -h` SHALL print usage generated from the one command table and exit 0; `tiili --version` SHALL print the app version and exit 0. None of them SHALL start the app or need a pane. An unknown bare-word first argument SHALL be a usage error; dash-prefixed arguments other than these flags SHALL still start the app.

#### Scenario: Help from a pane
- **WHEN** a process runs `tiili --help`
- **THEN** it prints every command with its usage, exits 0 and no tiili window opens

#### Scenario: Version
- **WHEN** a process runs `tiili --version`
- **THEN** it prints `tiili` and the app version and exits 0

#### Scenario: Unknown command
- **WHEN** a process runs `tiili frobnicate`
- **THEN** it prints an unknown-command error with a suggestion to run `tiili help`, exits 2 and no window opens

#### Scenario: Launch arguments still start the app
- **WHEN** the OS starts tiili with a dash-prefixed argument such as `-psn_0_12345`
- **THEN** the app starts as before

### Requirement: Coded errors with suggestions
Every `tiili` command-line failure SHALL carry a stable code, an exit code, a message and a suggestion naming the fix; the CLI SHALL print the message and the suggestion on stderr. A control error reply SHALL carry `ok: false`, `code`, `error` and `suggestion`, and every request and reply SHALL carry the control protocol version.

#### Scenario: Outside a pane with a hint
- **WHEN** `tiili list` runs where `TIILI_SOCKET` is not set
- **THEN** it prints that it is not inside a tiili pane and a suggestion to run it from a pane of the running app, and exits 3

#### Scenario: Refused request carries a code
- **WHEN** the app refuses a request for a wrong token
- **THEN** the reply has `ok` false, code `bad_token`, an error message and a suggestion, and the CLI prints that suggestion

### Requirement: Self-describing command line
`tiili describe [CMD]` SHALL print JSON on stdout without contacting the app, identical on every run of the same binary. It SHALL carry `schema` `tiili.describe/1`, `version`, `protocol`, an `env` section and, for each command (or only CMD), its name, summary, usage, arguments, needed variables, output, exit codes and errors with suggestions.

#### Scenario: Describe outside a pane
- **WHEN** `tiili describe` runs with no tiili variables set
- **THEN** it prints the JSON description and exits 0

#### Scenario: Describe one command
- **WHEN** `tiili describe open` runs
- **THEN** it prints the description holding only the `open` command

#### Scenario: Describe an unknown command
- **WHEN** `tiili describe frobnicate` runs
- **THEN** it prints an unknown-command error and exits 2
