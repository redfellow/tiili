## MODIFIED Requirements

### Requirement: Focus appearance
Panes SHALL sit on `--term-gap` with 3 px gaps. The focused pane SHALL show a 2 px accent line on its top edge and the cursor style chosen in settings (a blinking block by default); other panes SHALL show a still, non-blinking outlined cursor whatever the Blink setting, and keep showing output.

#### Scenario: Focused pane shows accent line
- **WHEN** a pane gains focus
- **THEN** it shows a 2 px accent line on its top edge and the cursor style chosen in settings

#### Scenario: Inactive pane cursor does not blink
- **WHEN** Blink is on in settings and a pane loses focus
- **THEN** its cursor shows as a steady outline that does not blink, and it blinks again when the pane regains focus

#### Scenario: Inactive pane keeps streaming
- **WHEN** a pane without focus receives output
- **THEN** the output appears in that pane while it stays dimmed

#### Scenario: Background stays solid
- **WHEN** a pane loses focus
- **THEN** its title chip and text fade to the inactive opacity and its background keeps the full terminal background colour

#### Scenario: Hovered pane undims
- **WHEN** mouseover highlight is on and the pointer is over a pane without focus
- **THEN** that pane's content shows at full opacity and colour
