## MODIFIED Requirements

### Requirement: Automatic grid layout
Panes SHALL be laid out in a grid whose column count for n panes depends on the tiling mode from settings (Grid by default), as the Column count per tiling mode scenario sets out. In every mode rows SHALL be ceil(n / columns), filled left-to-right, top-to-bottom, and an unfilled last row SHALL stretch its panes to share the full width.

#### Scenario: Column count per tiling mode
- **WHEN** n panes are open
- **THEN** the grid has ceil(sqrt(n)) columns in Grid mode, ceil(n / floor(sqrt(n))) in Wide grid, floor(sqrt(n)) in Tall grid, n in Side by side and 1 in Stacked

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

### Requirement: Pane zoom
The app SHALL zoom the focused terminal pane's font size one pixel per press within 6–48 px, and reset it to the Settings font size with the keys its scenarios name. Zoom SHALL affect only the focused pane, SHALL NOT be saved or change the Settings font size, and the keys SHALL NOT reach the shell. The pane's PTY SHALL follow its new size.

#### Scenario: Zoom keys
- **WHEN** the user presses ⌘+ or ⌘= / ⌘− / ⌘0 on macOS, or Ctrl++ or Ctrl+= / Ctrl+− / Ctrl+0 on Windows and Linux
- **THEN** the focused pane zooms in / zooms out / returns to the Settings font size

#### Scenario: Zoom limits
- **WHEN** a pane is at 48 px and the user zooms in, or at 6 px and the user zooms out
- **THEN** its font size stays where it is

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
tiili SHALL open a new window with ⌘N on macOS and Ctrl+Shift+N on Windows and Linux: a full tiili window with its own top bar, grid, panes and shortcuts, holding one pane that starts in the focused pane's folder, cascaded from the focused window. Every pane requirement applies to each window on its own; "the window" means the pane's own window.

#### Scenario: Shell menu opens a window
- **WHEN** the user chooses New Window from the Shell menu on macOS
- **THEN** a new tiili window opens just as with ⌘N

#### Scenario: Open a second window
- **WHEN** the focused pane is in `~/work/tiili` and the user presses ⌘N on macOS
- **THEN** a new tiili window opens offset from the focused one with one pane whose shell starts in `~/work/tiili`

#### Scenario: Shortcuts act in their own window
- **WHEN** two windows are open and the user presses ⌘T in the focused one
- **THEN** a pane opens only in the focused window

### Requirement: Window title follows the focused pane
Each tiili window's title, as shown by the system's window switcher and taskbar, SHALL read the focused pane's title followed by ` — tiili >_`, or `tiili >_` when the focused pane has no title. The title SHALL update when focus moves to another pane, when the focused pane's title changes and when the focused pane closes or moves away.

#### Scenario: Pane title is what its chip names
- **WHEN** the focused pane's program has set no title and its foreground process is `htop`
- **THEN** the window title uses the name its chip shows as running, the program's title if set, else the foreground process name, and reads `htop — tiili >_`

#### Scenario: Focused pane runs a program
- **WHEN** the focused pane's program has set the title `vim README.md`
- **THEN** the window title reads `vim README.md — tiili >_`

#### Scenario: No title
- **WHEN** the focused pane is a Heynote pane or its shell has not reported a title
- **THEN** the window title reads `tiili >_`

#### Scenario: Focus moves
- **WHEN** the user moves focus from a pane running `vim` to one running `htop`
- **THEN** the window title changes to `htop — tiili >_`

#### Scenario: Focused pane closes or moves away
- **WHEN** the focused pane closes or moves to another window and focus passes to a pane running `vim`
- **THEN** the window title changes to `vim — tiili >_`

### Requirement: Pane motion
When panes are opened, closed, re-flowed, reset or swapped, each pane SHALL animate from its old place and size to its new one, and a new or closing pane SHALL animate in or out, with the timings its scenarios set. When the OS asks for reduced motion, the change SHALL apply instantly. Dragging a divider SHALL stay instant.

#### Scenario: Panes glide to new places
- **WHEN** panes are opened, closed, re-flowed, reset or swapped
- **THEN** each pane glides from its old place and size to its new one with an ease-out motion in about 280 ms

#### Scenario: Opening a pane animates
- **WHEN** 2 panes are open and the user opens a third
- **THEN** the new pane rises, grows and fades into its place with a slight spring in about 380 ms, and the panes that move glide to their new places

#### Scenario: Closing a pane animates
- **WHEN** a pane is closed
- **THEN** it shrinks and fades out above the other panes in about 180 ms, its terminal staying visible until then, while the remaining panes glide to fill the grid

#### Scenario: Swap animates
- **WHEN** two panes swap
- **THEN** each slides from its old place to the other's

#### Scenario: Gliding text scales evenly
- **WHEN** a pane shrinks to half its width because another pane opens
- **THEN** its terminal re-wraps once and its text shrinks gradually over the glide without stretching, and its title keeps its size

#### Scenario: Reduced motion
- **WHEN** the OS asks for reduced motion and a pane opens, closes or swaps
- **THEN** the panes take their new places instantly
- **THEN** the column widths are kept and the rows are equal

#### Scenario: Divider drag stays instant
- **WHEN** the user drags a divider
- **THEN** the panes follow it instantly, without the glide
