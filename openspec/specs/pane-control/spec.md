# pane-control Specification

## Purpose
Let processes running inside tiili's panes, such as scripts and coding agents, open and list panes in their own window through a local, token-guarded control channel and the `tiili` command.

## Requirements

### Requirement: Local control endpoint

While running, tiili SHALL listen on a per-user local endpoint: a Unix domain socket with 0600 permissions on macOS and Linux, a named pipe limited to the current user and local clients on Windows. It SHALL generate a random token each run and refuse every request that does not carry it.

#### Scenario: Request with the right token
- **WHEN** a request carries this run's token
- **THEN** tiili carries it out

#### Scenario: Request without the token is refused
- **WHEN** a request carries no token or a different token
- **THEN** tiili refuses it with an error and changes nothing

#### Scenario: Malformed request
- **WHEN** a request is not a valid control message
- **THEN** tiili answers with an error and changes nothing

### Requirement: Pane environment

Every process tiili starts in a pane SHALL get `TIILI_SOCKET` (the endpoint's path), `TIILI_TOKEN` (the run's token) and `TIILI_PANE` (its pane's id), and a `PATH` on which `tiili` runs tiili's own binary in command-line mode.

#### Scenario: Shell sees the variables
- **WHEN** the user opens a pane
- **THEN** its shell has `TIILI_SOCKET`, `TIILI_TOKEN` and `TIILI_PANE` set and `tiili` on its `PATH`

### Requirement: Open a pane from the command line

`tiili open [--cwd DIR] [--title T] -- CMD ARGS...` SHALL add a pane to the window the caller's pane is in, placed in the grid as ⌘T places one, running CMD with ARGS directly in DIR (default: the caller's working directory), titled T when given. The caller's pane SHALL keep the focus. The command SHALL print the new pane's id and exit 0.

#### Scenario: Open a pane
- **WHEN** a process in a pane runs `tiili open -- npm run dev`
- **THEN** a new pane running `npm run dev` in the caller's working directory appears in that window, the focus stays in the caller's pane, and the new pane's id is printed

#### Scenario: Open in another folder with a title
- **WHEN** a process runs `tiili open --cwd /tmp --title logs -- tail -f x.log`
- **THEN** the new pane runs in `/tmp` and its title reads `logs`

#### Scenario: Command found on the caller's PATH
- **WHEN** a process whose `PATH` holds a folder the app's own `PATH` lacks runs `tiili open -- CMD` with CMD in that folder
- **THEN** CMD starts in the new pane, which gets the caller's `PATH` (with `tiili`'s folder first) and otherwise the app's environment plus its own `TIILI_SOCKET`, `TIILI_TOKEN` and `TIILI_PANE`

#### Scenario: Command exits
- **WHEN** the command started by `tiili open` exits
- **THEN** its pane closes as when a shell exits, with the last-pane rule unchanged

#### Scenario: Missing command
- **WHEN** `tiili open` is run without a command after `--`
- **THEN** it prints a usage message and exits non-zero without opening a pane

#### Scenario: Outside tiili
- **WHEN** `tiili open` or `tiili list` runs where `TIILI_SOCKET` is not set
- **THEN** it prints that it is not inside a tiili pane and exits non-zero

### Requirement: List the window's panes

`tiili list` SHALL print one line per pane of the caller's window, in grid order, with the pane's id, working directory and title separated by tabs.

#### Scenario: List panes
- **WHEN** a process in a window with two terminal panes runs `tiili list`
- **THEN** two lines are printed, each with that pane's id, working directory and title

### Requirement: Pane control with tabs
`tiili open` SHALL add its pane to the caller's tab, even when that tab is not shown, without showing it. `tiili list` SHALL list the window's panes tab by tab in strip order, in grid order inside each tab.

#### Scenario: Open from a hidden tab
- **WHEN** a process in a pane of a hidden tab runs `tiili open -- npm test`
- **THEN** the new pane joins that tab's grid and the shown tab does not change

#### Scenario: List across tabs
- **WHEN** tab 1 has panes A, B and tab 2 has pane C, and `tiili list` runs
- **THEN** it prints A, B, C in that order

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
