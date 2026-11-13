## MODIFIED Requirements

### Requirement: Heynote pane
tiili SHALL open Heynote's web app in a pane of its own that tiles, resizes, swaps, focuses and closes like a terminal pane. At most one Heynote pane SHALL be open: opening another SHALL focus the open one. The pane's chip SHALL read Heynote. Until the user changes these in Heynote, Heynote SHALL start with its left panel closed and use Geist Mono as its editor font.

#### Scenario: Open Heynote
- **WHEN** the user clicks the Heynote button
- **THEN** a Heynote pane opens after the others, is focused, and its editor has the keyboard

#### Scenario: Already open
- **WHEN** a Heynote pane is open and the user clicks the Heynote button
- **THEN** no new pane opens and the Heynote pane takes the focus

#### Scenario: First open
- **WHEN** a user who has never changed Heynote's settings opens the Heynote pane
- **THEN** the editor fills the pane without the notes list, in Geist Mono

#### Scenario: Panel choice is kept
- **WHEN** the user opens the left panel with ⌘⇧S and later opens Heynote again
- **THEN** the left panel is shown
