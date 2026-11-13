## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Inactive pane dimming
In panes without focus only the content (title chip and terminal text) SHALL be faded to the inactive opacity from settings and, when Desaturate is on, lose most of its colour; the pane background SHALL stay solid. When mouseover highlight is on, the pane under the pointer SHALL show its content at full opacity and colour and a faint accent line on its top edge.

#### Scenario: Desaturate removes colour from inactive content
- **WHEN** Desaturate is on and a pane loses focus
- **THEN** its title chip and text lose most of their colour while its background keeps the terminal background colour

#### Scenario: Hovered pane shows faint accent line
- **WHEN** mouseover highlight is on and the pointer is over a pane without focus
- **THEN** that pane shows a faint accent line on its top edge
