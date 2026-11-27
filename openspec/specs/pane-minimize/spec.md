# pane-minimize Specification

## Purpose

Let the user tuck long-running panes away as small brick badges in the window's top bar while their shells keep
running, and watch, peek at, restore and manage them from there.

## Requirements

### Requirement: Pane minimize icon
Each pane's title row SHALL have a Minimize icon left of the Zen icon, so the order is Minimize, Zen, Close. Like the close icon, it SHALL show only while the pointer is over the pane, be hidden when its tab's grid has one pane, and have the tooltip "Minimize pane" with the platform's shortcut. Clicking it SHALL minimize that pane, whichever pane has focus.

#### Scenario: Icon order on hover
- **WHEN** two panes are open and the pointer is over the first
- **THEN** its title row shows Minimize, Zen and Close icons in that order

#### Scenario: Minimizes the clicked pane
- **WHEN** pane 2 has focus and the user clicks pane 1's Minimize icon
- **THEN** pane 1 is minimized and pane 2 keeps the focus

#### Scenario: Last visible pane
- **WHEN** a tab's grid shows one pane
- **THEN** that pane shows no Minimize icon

### Requirement: Minimize shortcut
⇧⌘M on macOS and Ctrl+Shift+M on Windows and Linux SHALL minimize the focused pane unless it is its tab's only visible pane. The shortcut SHALL never reach the shell. ⌘M SHALL stay the system's window minimize.

#### Scenario: Shortcut minimizes
- **WHEN** two panes are open on Linux and the user presses Ctrl+Shift+M
- **THEN** the focused pane is minimized and its shell receives nothing

#### Scenario: Only pane
- **WHEN** one pane is visible and the user presses ⇧⌘M
- **THEN** nothing is minimized and the shell receives nothing

### Requirement: Minimized panes keep running
Minimizing a pane SHALL take it out of its tab's grid, which SHALL re-flow as if the pane had closed, and focus SHALL move as on close. The pane's shell and program SHALL keep running, and its PTY SHALL keep its last size until restore, when it refits once.

#### Scenario: Dev server keeps serving
- **WHEN** a pane running `npm run dev` is minimized
- **THEN** the grid re-flows without it and the server keeps running at the same PTY size

### Requirement: Brick badges in the window bar
Each window's top bar SHALL show one badge for each minimized pane of any of its tabs, after the native window buttons on macOS and after the tab strip when it shows. The badges SHALL fit the 38px macOS bar and the 24px Windows and Linux bar.

#### Scenario: Badges with one tab
- **WHEN** a window with one tab has a minimized pane
- **THEN** its badge sits right after the window buttons

#### Scenario: Badges across tabs
- **WHEN** tab 1 and tab 2 each have a minimized pane and tab 1 is shown
- **THEN** the bar shows both badges after the tab strip

### Requirement: Badge look
A badge SHALL be 18px tall, with a 1px outline in the pane's repository tint, a wash of about 16% of that tint, and a 7px tint swatch in the attention brick's shape. Its label SHALL be the pane's running command, else its chip text, in Geist Mono 11px. Colours SHALL come from the brand tokens.

#### Scenario: Running command label
- **WHEN** a pane in a repository with tint 3 runs `npm run dev` and is minimized
- **THEN** its badge reads `npm run dev` with a tint 3 outline, wash and swatch

### Requirement: Badge states
A badge's swatch SHALL pulse slowly while output arrives (not under prefers-reduced-motion) and SHALL become the attention brick while the pane is marked. When the pane's process exits while minimized, the badge SHALL fill with klinkkeri, show the exit code and stay until dismissed. A badge brought back by session restore SHALL read `was running: <command>`.

#### Scenario: Output pulses
- **WHEN** a minimized pane prints output
- **THEN** its swatch pulses and stops after output stops

#### Scenario: Needs you
- **WHEN** a minimized pane rings the bell
- **THEN** its swatch shows as the attention brick and the attention count rises by one

#### Scenario: Exited
- **WHEN** a minimized pane's process exits with code 1
- **THEN** its badge fills klinkkeri, shows `1` and stays

### Requirement: Restore from a badge
Clicking a badge SHALL restore its pane in its own tab, showing that tab first, at its old grid position when the tab's panes are unchanged since it was minimized, else at the grid's end. It SHALL take the focus. An exited pane SHALL come back read-only, showing its final output, and close from its close icon.

#### Scenario: Back in place
- **WHEN** pane 2 of three is minimized and its badge is clicked with nothing else changed
- **THEN** it returns as pane 2 and has the focus

#### Scenario: Layout changed
- **WHEN** a pane is minimized, another pane opens in its tab, and the badge is clicked
- **THEN** the pane returns at the end of the grid

#### Scenario: Other tab
- **WHEN** tab 2 is shown and the badge of a pane from tab 1 is clicked
- **THEN** tab 1 is shown with the pane restored in it

### Requirement: Badge peek
Hovering a badge or long-pressing it SHALL open a peek under the bar showing the command, the repository, the uptime and the pane's live terminal, scaled to fit without changing its PTY size, which the user can type into. Escape SHALL close the peek without reaching the shell. The grid SHALL not change.

#### Scenario: Peek and type
- **WHEN** the user hovers a minimized `npm run dev` badge, clicks into the peek and types `rs` Enter
- **THEN** the dev server receives `rs` and the grid stays as it was

#### Scenario: Escape closes
- **WHEN** a peek is open and the user presses Escape
- **THEN** the peek closes and the program receives nothing

### Requirement: Badge menu
Right-clicking a badge SHALL open a menu with Restore, Peek, Move to Tab, Move to Window and Close. A moved pane SHALL stay minimized in its new tab or window. Close SHALL close the pane as its close icon would, and is how an exited badge is dismissed.

#### Scenario: Move to another window
- **WHEN** the user chooses Move to Window ▸ the other window on a badge
- **THEN** the badge leaves this window's bar and shows in the other window's bar with the shell still running

#### Scenario: Dismiss an exited badge
- **WHEN** the user chooses Close on an exited badge
- **THEN** the badge goes away

### Requirement: Badge overflow
Badges that do not fit the bar's free space SHALL collapse into a `+N` badge, N being how many are hidden. Clicking it SHALL open a list of them that restores, and right-clicks, as the badges do.

#### Scenario: Too many badges
- **WHEN** only three of five badges fit
- **THEN** the bar shows three badges and `+2`

### Requirement: Title dodges the badges
On macOS the centred `tiili` title SHALL stay centred until the badges would reach it. Then it SHALL slide, animated except under prefers-reduced-motion, to the middle of the free space between the last badge and the right-hand buttons, and SHALL hide when that space is narrower than the title.

#### Scenario: Title slides
- **WHEN** badges reach the centred title
- **THEN** the title moves to the middle of the space between the last badge and the buttons

#### Scenario: No room
- **WHEN** the free space is narrower than the title
- **THEN** the title is hidden

### Requirement: Last visible pane brings a minimized one back
When the window's last visible pane closes, by the close shortcut, its close icon or its shell exiting, while the window has minimized panes, the most recently minimized pane SHALL be restored into the shown tab and take the focus, and the window SHALL stay open. A pane in the exited state SHALL come back read-only as on restore. The window SHALL close only when no visible or minimized pane is left.

#### Scenario: Closing the last visible pane
- **WHEN** a window shows one pane, has two minimized panes, and the user closes the visible one
- **THEN** the pane minimized last comes back in the shown tab with the focus, and the other stays minimized

#### Scenario: Nothing left
- **WHEN** a window has one pane, none minimized, and the user closes it
- **THEN** the window closes

### Requirement: Minimized panes and focus
Focus by number and Zen SHALL count only visible panes and never show a minimized one. When the attention shortcut's next pane is minimized, it SHALL be restored and focused.

#### Scenario: Focus by number skips
- **WHEN** pane 2 of three is minimized and the user presses ⌘2
- **THEN** the pane that was third is focused

#### Scenario: Next pane restores
- **WHEN** the oldest marked pane is minimized and the user presses ⌘J
- **THEN** it is restored in its tab and focused
