## MODIFIED Requirements

### Requirement: Focus appearance
Panes SHALL sit on `--term-gap` with 3 px gaps. The focused pane SHALL show a 2 px accent line on its top edge and the cursor style chosen in settings (a blinking block by default); other panes SHALL show an outlined cursor at 82% opacity and keep showing output.

#### Scenario: Inactive pane keeps streaming
- **WHEN** a command prints output in a pane that does not have focus
- **THEN** the output appears in that pane while it stays dimmed
