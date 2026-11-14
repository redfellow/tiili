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

In every mode rows SHALL be ceil(n / columns), filled left-to-right, top-to-bottom, and an unfilled last row SHALL stretch its panes to share the full width.

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

### Requirement: Grid re-flow
Opening or closing a pane, or changing the tiling mode, SHALL re-flow the grid layout at once.

#### Scenario: Tiling mode change re-flows
- **WHEN** 5 panes are open in Grid mode and the tiling mode is changed to Stacked
- **THEN** the panes re-flow from 3×2 to 1×5

### Requirement: Pane zoom
The app SHALL zoom the focused terminal pane's font size with ⌘+ (or ⌘=) and ⌘− on macOS and Ctrl++ (or Ctrl+=) and Ctrl+− on Windows and Linux, one pixel per press within 6–48 px, and SHALL reset it to the Settings font size with ⌘0 / Ctrl+0. Zoom SHALL affect only the focused pane, SHALL NOT be saved or change the Settings font size, and the keys SHALL NOT reach the shell. The pane's PTY SHALL follow its new size.

#### Scenario: Zoom in one pane
- **WHEN** two panes are open at font size 14 and the user presses ⌘+ (Ctrl++ on Windows and Linux) twice in the first
- **THEN** the first pane draws at 16 px, the second stays at 14 px, and no key reaches either shell

#### Scenario: Reset zoom
- **WHEN** a pane is zoomed to 11 px and the user presses ⌘0 (Ctrl+0)
- **THEN** the pane returns to the Settings font size

#### Scenario: Zoom not saved
- **WHEN** a pane is zoomed and the app restarts
- **THEN** every pane starts at the Settings font size

### Requirement: New window
tiili SHALL open a new window with ⌘N on macOS (also from the Shell menu's New Window item) and Ctrl+Shift+N on Windows and Linux. The new window SHALL be a full tiili window with its own top bar, grid, panes and shortcuts, holding one pane that starts in the focused pane's folder, placed cascaded from the focused window. Every pane requirement applies to each window on its own; "the window" means the pane's own window.

#### Scenario: Open a second window
- **WHEN** the focused pane is in `~/work/tiili` and the user presses ⌘N on macOS
- **THEN** a new tiili window opens offset from the focused one with one pane whose shell starts in `~/work/tiili`

#### Scenario: Shortcuts act in their own window
- **WHEN** two windows are open and the user presses ⌘T in the focused one
- **THEN** a pane opens only in the focused window

### Requirement: Closing a window
Closing a window, by its close button or by closing its last pane, SHALL end that window's shells and close only that window. When the last window closes, tiili SHALL quit, on macOS too.

#### Scenario: Close one of two windows
- **WHEN** two windows are open and the user closes one
- **THEN** that window's shells end and the other window and its shells stay

#### Scenario: Last window closes
- **WHEN** the last open window closes
- **THEN** tiili quits

### Requirement: Move a pane to another window
The pane's right-click menu and the macOS Shell menu SHALL offer Move to New Window (⌃⌘N on macOS, Ctrl+Alt+Shift+N on Windows and Linux) and Move to Window, a submenu of the other open windows with no shortcut. Moving SHALL add the pane last in the target window's grid, bring that window to the front and focus the pane.

#### Scenario: Move to an existing window
- **WHEN** two windows are open, one whose focused pane is in repository `härvääjä`, and the user chooses Move to Window ▸ `härvääjä` for a pane
- **THEN** the pane appears last in that window's grid, the window comes to the front and the pane is focused

### Requirement: Window names in Move to Window
Each Move to Window entry SHALL name its window by that window's focused pane chip text, with ` (2)`, ` (3)` and so on added when entries would read the same.

#### Scenario: Duplicate window names
- **WHEN** two other windows both have a focused pane in repository `tiili`
- **THEN** the submenu lists `tiili` and `tiili (2)`

### Requirement: A moved pane keeps its session
A moved terminal pane SHALL keep its running shell, scrollback, folder, tint and chip, show output written during the move, and tell the shell its new size so full-screen programs redraw. The shell SHALL then belong to the target window. A moved Heynote pane SHALL save its notes and reopen in the target window.

#### Scenario: Move to a new window

- **WHEN** a window has two terminal panes and the user presses ⌃⌘N in one running `vim`
- **THEN** a new window opens holding that pane, `vim` keeps running and redraws there, and the source window keeps the other pane

#### Scenario: Scrollback and output during the move
- **WHEN** a pane whose shell is printing output is moved to another window
- **THEN** the target pane shows the earlier scrollback followed by everything the shell wrote, with nothing lost or repeated

#### Scenario: Heynote pane moves
- **WHEN** the user moves a Heynote pane to another window
- **THEN** its notes are saved and Heynote reopens in the target window showing them

#### Scenario: Moved shell follows its window
- **WHEN** a moved pane's shell changes folder, runs a program or exits, or the target window closes
- **THEN** the chip and tint update in the target window, the pane closes there on exit, and closing the target window ends the shell

### Requirement: Moving a window's last pane
Moving a window's last pane out SHALL close that window without ending the moved shell. Move to New Window on a window's only pane SHALL do nothing.

#### Scenario: Last pane moves out
- **WHEN** a window's only pane is moved to another window
- **THEN** the source window closes and the moved shell keeps running

#### Scenario: Only pane to a new window
- **WHEN** a window has one pane and the user chooses Move to New Window
- **THEN** nothing happens

### Requirement: Window title follows the focused pane
Each tiili window's title, as shown by the system's window switcher and taskbar, SHALL read the focused pane's title followed by ` — tiili >_`, where the pane's title is what its chip names as running in it (the title the program set, else the foreground process name). When the focused pane has no title, the window title SHALL read `tiili >_`. The title SHALL update when focus moves to another pane, when the focused pane's title changes and when the focused pane closes or moves away.

#### Scenario: Focused pane runs a program
- **WHEN** the focused pane's program has set the title `vim README.md`
- **THEN** the window title reads `vim README.md — tiili >_`

#### Scenario: No title
- **WHEN** the focused pane is a Heynote pane or its shell has not reported a title
- **THEN** the window title reads `tiili >_`

#### Scenario: Focus moves
- **WHEN** the user moves focus from a pane running `vim` to one running `htop`
- **THEN** the window title changes to `htop — tiili >_`
