## ADDED Requirements

### Requirement: Heynote pane
tiili SHALL open Heynote's web app in a pane of its own that tiles, resizes, swaps, focuses and closes like a terminal pane. At most one Heynote pane SHALL be open: opening another SHALL focus the open one. The pane's chip SHALL read Heynote.

#### Scenario: Open Heynote
- **WHEN** the user clicks the Heynote button
- **THEN** a Heynote pane opens after the others, is focused, and its editor has the keyboard

#### Scenario: Already open
- **WHEN** a Heynote pane is open and the user clicks the Heynote button
- **THEN** no new pane opens and the Heynote pane takes the focus

### Requirement: Notes are files
The Heynote pane SHALL keep its notes as files under `heynote/notes/` in tiili's app config folder, and its settings, open tabs and theme in `heynote/state.json`. Each change SHALL be written through as it happens, and all open notes SHALL be saved when the pane closes. A note path that is absolute or leaves the notes folder SHALL be refused.

#### Scenario: Notes survive a restart
- **WHEN** the user types in Heynote, quits tiili and opens Heynote again
- **THEN** the note shows the typed text

#### Scenario: Escaping path
- **WHEN** a note path such as `../x.txt` is written
- **THEN** the write is refused and nothing outside the notes folder changes

### Requirement: tiili keys in Heynote
While Heynote has the keyboard, tiili's pane, layout and settings shortcuts SHALL work as in a terminal and SHALL NOT reach Heynote. In the macOS app, the Edit menu's Copy, Paste and Select All, and ⌘X, SHALL act on Heynote's editor.

#### Scenario: Focus another pane
- **WHEN** Heynote has the keyboard and the user presses the focus-pane-1 shortcut
- **THEN** pane 1 takes the focus

#### Scenario: Paste on macOS
- **WHEN** Heynote has the keyboard in the macOS app and the user presses ⌘V
- **THEN** the clipboard text is inserted at Heynote's cursor

### Requirement: Heynote licence notice
The built Heynote SHALL ship with Heynote's LICENSE, including its Commons Clause condition, and a note naming the Heynote commit it was built from.

#### Scenario: Notice in the build
- **WHEN** `npm run heynote` finishes
- **THEN** `public/heynote/LICENSE` and `public/heynote/README.md` exist
