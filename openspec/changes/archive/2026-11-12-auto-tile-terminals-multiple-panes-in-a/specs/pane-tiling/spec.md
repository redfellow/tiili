## ADDED Requirements

### Requirement: Multiple terminal panes
The window SHALL hold several terminal panes, each connected to its own shell session.

#### Scenario: Independent sessions
- **WHEN** two panes are open and the user types `echo a` in one
- **THEN** only that pane's shell receives the input and shows `a`

### Requirement: Automatic grid layout
Panes SHALL be laid out in a grid with columns = ceil(sqrt(n)) and rows = ceil(n / columns), filled left-to-right, top-to-bottom; an unfilled last row SHALL stretch its panes to share the full width. Opening or closing a pane SHALL re-flow the layout.

#### Scenario: Grid sizes
- **WHEN** 1, 2, 3, 4, 5 or 9 panes are open
- **THEN** the grid is 1×1, 2×1, 2×2, 2×2, 3×2 and 3×3 (columns × rows) respectively

#### Scenario: Short last row stretches
- **WHEN** 3 panes are open
- **THEN** two panes sit side by side on the top row and the third fills the full width of the bottom row

#### Scenario: Close re-flows
- **WHEN** 4 panes are open and one is closed
- **THEN** the remaining 3 panes re-flow into the 3-pane layout

### Requirement: Pane shortcuts
The app SHALL open a new pane with ⌘T on macOS and Ctrl+Shift+T on Windows and Linux, close the focused pane with ⌘W / Ctrl+Shift+W, and focus pane N (1–9) with ⌘N on macOS and Alt+N on Windows and Linux. Clicking a pane SHALL focus it. Closing the last pane SHALL close the window.

#### Scenario: Open and close
- **WHEN** the user presses the platform's new-terminal shortcut, then the close shortcut
- **THEN** a new focused pane appears, and then it closes and the layout re-flows

#### Scenario: Focus by number
- **WHEN** three panes are open and the user presses ⌘2 (Alt+2 on Windows and Linux)
- **THEN** the second pane gets focus and the key is not sent to any shell

#### Scenario: Last pane closed
- **WHEN** one pane is open and the user presses the close shortcut
- **THEN** the window closes

### Requirement: PTY size follows the pane
Each pane SHALL send its own rows and columns to its pseudo-terminal when the layout or window size changes, sending at most one resize per pane after resizing settles and none when the size is unchanged.

#### Scenario: Each session its own size
- **WHEN** a pane is added beside an existing one
- **THEN** each session receives the rows and columns of its own pane

### Requirement: Focus appearance
Panes SHALL sit on `--term-gap` with 3 px gaps. The focused pane SHALL show a 2 px accent line on its top edge and a solid block cursor; other panes SHALL show an outlined cursor at 82% opacity and keep showing output.

#### Scenario: Inactive pane keeps streaming
- **WHEN** a command prints output in a pane that does not have focus
- **THEN** the output appears in that pane while it stays dimmed

### Requirement: New pane working directory
A new pane SHALL start in the focused pane's working directory on macOS and Linux, and in the home folder on Windows or when that directory cannot be read.

#### Scenario: Inherit directory
- **WHEN** on macOS or Linux the focused shell is in `/tmp` and the user opens a new pane
- **THEN** the new shell starts in `/tmp`
