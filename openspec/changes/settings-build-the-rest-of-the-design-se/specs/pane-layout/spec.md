## ADDED Requirements

### Requirement: Pane drag feedback
Once a pane's grab strip has been dragged more than 3 px, a label with the pane's chip name (or "Terminal") SHALL follow the pointer. The source pane SHALL dim and the pointer SHALL show grabbing everywhere until the drop or cancel, which SHALL remove all of these.

#### Scenario: Drag shows a ghost
- **WHEN** the user drags a pane's grab strip 10 px
- **THEN** a label naming the pane follows the pointer and the source pane is dimmed

### Requirement: Terminal scrollbar
Each terminal's scrollbar SHALL be 8 px wide and SHALL NOT show an overview-ruler border.

#### Scenario: Slim scrollbar
- **WHEN** a terminal has scrollback
- **THEN** its scrollbar is 8 px wide with no hairline beside it
