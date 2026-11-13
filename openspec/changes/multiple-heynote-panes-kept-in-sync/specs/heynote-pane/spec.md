## MODIFIED Requirements

### Requirement: Heynote pane
tiili SHALL open Heynote's web app in a pane of its own that tiles, resizes, swaps, focuses and closes like a terminal pane. The Heynote button SHALL always open a new Heynote pane, with no limit on how many are open. The pane's chip SHALL read Heynote. Until the user changes these in Heynote, Heynote SHALL start with its left panel closed and use Geist Mono as its editor font.

#### Scenario: Open Heynote
- **WHEN** the user clicks the Heynote button
- **THEN** a Heynote pane opens after the others, is focused, and its editor has the keyboard

#### Scenario: Already open
- **WHEN** a Heynote pane is open and the user clicks the Heynote button
- **THEN** a second Heynote pane opens after the others and takes the focus

#### Scenario: First open
- **WHEN** a user who has never changed Heynote's settings opens the Heynote pane
- **THEN** the editor fills the pane without the notes list, in Geist Mono

#### Scenario: Panel choice is kept
- **WHEN** the user opens the left panel with ⌘⇧S and later opens Heynote again
- **THEN** the left panel is shown

## ADDED Requirements

### Requirement: Heynote panes stay in sync
When a Heynote pane writes, creates, deletes or moves a note, or creates or removes a folder, every other Heynote pane, in any tiili window, SHALL pick up the change without being reopened. A pane SHALL NOT reload a change it made itself. Open tabs and settings in `heynote/state.json` SHALL be last-writer-wins.

#### Scenario: Typing shows in the other pane
- **WHEN** two Heynote panes show the same note and the user types in one
- **THEN** the other shows the typed text

#### Scenario: New note appears
- **WHEN** the user creates a note in one Heynote pane
- **THEN** the note is listed in the other Heynote pane

#### Scenario: Deleted or moved note
- **WHEN** the user deletes or moves a note in one Heynote pane
- **THEN** the other Heynote pane no longer lists it under its old path

#### Scenario: Heynote open in another window
- **WHEN** a Heynote pane is open in one tiili window and the user clicks the Heynote button in another
- **THEN** a Heynote pane opens in the clicked window and takes the focus, and the other window stays where it is

## REMOVED Requirements

### Requirement: One Heynote across windows
**Reason**: The rule existed only because two Heynote pages could not sync; with panes kept in sync, every window may hold Heynote panes.
**Migration**: None. The Heynote button opens a pane in the window where it is clicked.
