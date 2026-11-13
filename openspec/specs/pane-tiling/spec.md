# pane-tiling Specification

## Purpose
Several terminal panes in the one tiili window, each with its own shell, laid out in an automatic grid that re-flows as terminals open and close, with shortcuts to open, close and move focus between panes; focus styling, PTY sizing and starting folders follow the pane.

## Requirements

### Requirement: Multiple terminal panes
The window SHALL hold several terminal panes, each connected to its own shell session.

#### Scenario: Independent sessions
- **WHEN** two panes are open and the user types `echo a` in one
- **THEN** only that pane's shell receives the input and shows `a`

### Requirement: Automatic grid layout
Panes SHALL be laid out in a grid whose column count depends on the tiling mode from settings. For n panes:
- Grid (default): ceil(sqrt(n)) columns.
- Wide grid: ceil(n / floor(sqrt(n))) columns.
- Tall grid: floor(sqrt(n)) columns.
- Side by side: n columns.
- Stacked: 1 column.

In every mode rows SHALL be ceil(n / columns), filled left-to-right, top-to-bottom, and an unfilled last row SHALL stretch its panes to share the full width. Opening or closing a pane, or changing the tiling mode, SHALL re-flow the layout.

#### Scenario: Grid sizes
- **WHEN** 1, 2, 3, 4, 5 or 9 panes are open in Grid mode
- **THEN** the grid is 1×1, 2×1, 2×2, 2×2, 3×2 and 3×3 (columns × rows) respectively

#### Scenario: Tiling mode sizes
- **WHEN** 5 panes are open in Wide grid, Tall grid, Side by side or Stacked mode
- **THEN** the grid is 3×2, 2×3, 5×1 or 1×5 respectively

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
Panes SHALL sit on `--term-gap` with 3 px gaps. The focused pane SHALL show a 2 px accent line on its top edge and the cursor style chosen in settings (a blinking block by default); other panes SHALL show an outlined cursor and keep showing output.

#### Scenario: Focused pane shows accent line
- **WHEN** a pane gains focus
- **THEN** it shows a 2 px accent line on its top edge and the cursor style chosen in settings

#### Scenario: Inactive pane keeps streaming
- **WHEN** a pane without focus receives output
- **THEN** the output appears in that pane while it stays dimmed

#### Scenario: Background stays solid
- **WHEN** a pane loses focus
- **THEN** its title chip and text fade to the inactive opacity and its background keeps the full terminal background colour

#### Scenario: Hovered pane undims
- **WHEN** mouseover highlight is on and the pointer is over a pane without focus
- **THEN** that pane's content shows at full opacity and colour

### Requirement: New pane working directory
A new pane SHALL start in the focused pane's working directory on macOS and Linux, and in the home folder on Windows or when that directory cannot be read.

#### Scenario: Inherit directory
- **WHEN** on macOS or Linux the focused shell is in `/tmp` and the user opens a new pane
- **THEN** the new shell starts in `/tmp`

### Requirement: Inactive pane dimming
In panes without focus only the content (title chip and terminal text) SHALL be faded to the inactive opacity from settings and, when Desaturate is on, lose most of its colour; the pane background SHALL stay solid. When mouseover highlight is on, the pane under the pointer SHALL show its content at full opacity and colour and a faint accent line on its top edge.

#### Scenario: Desaturate removes colour from inactive content
- **WHEN** Desaturate is on and a pane loses focus
- **THEN** its title chip and text lose most of their colour while its background keeps the terminal background colour

#### Scenario: Hovered pane shows faint accent line
- **WHEN** mouseover highlight is on and the pointer is over a pane without focus
- **THEN** that pane shows a faint accent line on its top edge
