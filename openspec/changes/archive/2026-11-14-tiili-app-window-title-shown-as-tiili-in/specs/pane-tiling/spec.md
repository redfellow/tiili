## ADDED Requirements

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
