## MODIFIED Requirements

### Requirement: Zen toggle
Each pane's title row SHALL have a Zen icon at its right end, shown while the pointer is over the pane or while it carries the attention dot, hidden with one pane, lit in the accent colour while that pane is in Zen, with tooltip "Zen mode" and the shortcut. Clicking it, double-clicking the title row, ⇧⌘↩ on macOS, Ctrl+Shift+Enter on Windows and Linux, and Shell ▸ Zen Mode on macOS SHALL toggle Zen for the focused pane. The shortcut SHALL not reach the shell.

#### Scenario: Shortcut toggles
- **WHEN** two panes are open and the user presses Ctrl+Shift+Enter on Linux
- **THEN** the focused pane enters Zen and the shell receives nothing

#### Scenario: Icon on hover
- **WHEN** two panes are open and the pointer is over the first
- **THEN** the first pane shows the Zen icon and the second keeps an empty space where it would be

#### Scenario: Dot keeps the icon shown
- **WHEN** Zen is on, a hidden pane rings the bell and the pointer is outside the Zen pane
- **THEN** the lit Zen icon shows with its dot
