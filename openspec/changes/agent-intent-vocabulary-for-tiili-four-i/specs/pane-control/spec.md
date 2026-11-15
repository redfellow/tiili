## ADDED Requirements

### Requirement: Pane ownership
tiili SHALL record, for each pane opened by `tiili open`, the pane that ran it as its owner, and its key when given. Ownership SHALL last while both live in the app's memory and SHALL not be restored after a restart.

#### Scenario: Owner recorded
- **WHEN** a process in pane 3 runs `tiili open -- npm test` and gets pane 8
- **THEN** pane 8's owner is pane 3

### Requirement: Open by key
`tiili open --key K -- CMD` SHALL, atomically, print `reused ID` for the live pane with key K owned by the caller's pane, else open the pane as `tiili open` does, record K and print `opened ID`. A closed pane SHALL free its key.

#### Scenario: Second call reuses
- **WHEN** a process runs `tiili open --key dev -- npm run dev` twice
- **THEN** one pane opens, and the second call prints `reused` with its id

#### Scenario: Concurrent calls
- **WHEN** two processes in one pane run `tiili open --key dev -- X` at the same time
- **THEN** exactly one pane opens and both print its id

#### Scenario: Dead key reopens
- **WHEN** the keyed pane's command has exited and the call is made again
- **THEN** a new pane opens and `opened` is printed

#### Scenario: Keys are per owner
- **WHEN** panes 3 and 4 each run `tiili open --key dev -- X`
- **THEN** two panes open

### Requirement: Close an owned pane
`tiili close PANE` SHALL close the pane when the caller's pane owns it and exit 0; otherwise it SHALL fail with code `not_opened_by_you` and a suggestion to ask the user, closing nothing.

#### Scenario: Close own pane
- **WHEN** pane 3 opened pane 8 and runs `tiili close 8`
- **THEN** pane 8 closes

#### Scenario: Refuse another pane
- **WHEN** pane 3 runs `tiili close 5` for a pane it did not open
- **THEN** nothing closes and the error suggests asking the user

### Requirement: List as JSON
`tiili list --json` SHALL print a JSON array of the caller window's panes in `tiili list` order, each with `id`, `cwd`, `title`, `command`, `tab`, `key`, `self` and `opened_by_you`.

#### Scenario: Own and opened panes
- **WHEN** pane 3 opened pane 8 with key dev and runs `tiili list --json`
- **THEN** pane 3 has `self` true, and pane 8 has `opened_by_you` true and `key` `dev`

### Requirement: Agent intents
tiili SHALL hold one table of agent intents (fan-out, run-beside, need-you, find-reuse), each with one recipe. `tiili describe` SHALL include it as `intents`, and `tiili prompt` SHALL print it as text to paste into agent prompts.

#### Scenario: Prompt fragment
- **WHEN** a process runs `tiili prompt`
- **THEN** it prints the four intents with their recipes and exits 0 without contacting the app

#### Scenario: Describe intents
- **WHEN** a process runs `tiili describe`
- **THEN** the JSON has an `intents` array with the four intents
