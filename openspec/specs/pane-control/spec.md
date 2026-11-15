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
