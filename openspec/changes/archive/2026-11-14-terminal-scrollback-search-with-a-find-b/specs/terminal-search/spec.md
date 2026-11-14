## Purpose
Search a tiili terminal pane's scrollback from a find bar, with highlighted matches, a match count and platform find shortcuts.

## ADDED Requirements

### Requirement: Find bar overlay
Each terminal pane SHALL have its own find bar, query and open state. The bar SHALL overlay the top right of the pane's terminal area (full pane width when the pane is narrow), SHALL NOT be in the pane title row and SHALL NOT resize the terminal or its PTY. Opening it SHALL prefill the query from a single-line selection.

#### Scenario: Open with a selection
- **WHEN** the user selects `error` on one line and presses ⌘F (macOS) or Ctrl+Shift+F (Windows, Linux)
- **THEN** the focused pane's find bar opens over the output with `error` in the field and the terminal's rows and columns are unchanged

#### Scenario: Panes keep their own search
- **WHEN** pane A has the bar open with `foo` and the user focuses pane B
- **THEN** pane B shows no bar, and returning to pane A shows its bar with `foo`

### Requirement: Incremental search and count
Typing SHALL search incrementally and show the count as `<active>/<total>`, `1000+` past the search limit, and `0/0` with no match. Options case sensitivity (Aa), whole word (W) and regex (.*) SHALL apply. An invalid regex SHALL mark the field as an error and SHALL NOT throw.

#### Scenario: Count
- **WHEN** the scrollback holds 17 matches and the third is active
- **THEN** the bar shows `3/17`

#### Scenario: Invalid regex
- **WHEN** regex is on and the user types `(`
- **THEN** the field is marked as an error and no error is raised

### Requirement: Navigate and close
Enter and Shift+Enter in the field SHALL go to the next and previous match; Find Next and Find Previous SHALL do the same (⌘G / ⇧⌘G on macOS, F3 / Shift+F3 on Windows and Linux). Esc SHALL close the bar, clear the highlights and focus the terminal. Plain Ctrl+F SHALL stay with the shell on Windows and Linux.

#### Scenario: Esc
- **WHEN** the bar is open with highlights and the user presses Esc
- **THEN** the bar closes, no highlights remain and keystrokes go to the shell

#### Scenario: Ctrl+F on Linux
- **WHEN** the user presses Ctrl+F on Linux
- **THEN** the shell receives it and no find bar opens

### Requirement: Match highlights
The active match SHALL be drawn in `--accent`, other matches in brick blended into `--term-bg` as an opaque `#RRGGBB`, recomputed when the theme changes. The terminal selection colour SHALL differ from both.

#### Scenario: Theme change
- **WHEN** matches are highlighted and the user switches theme
- **THEN** the highlights use the new theme's colours

### Requirement: Heynote panes use Heynote's search
In a Heynote pane, ⌘F and Find… SHALL open Heynote's own search, not the terminal find bar.

#### Scenario: Find in Heynote
- **WHEN** a Heynote pane is focused and the user chooses Edit › Find…
- **THEN** Heynote's search opens
