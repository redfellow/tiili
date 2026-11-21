## MODIFIED Requirements

### Requirement: Settings tabs
The settings dialogue SHALL show four tabs, Style, Typography, Behaviour and Integrations in that order, as a tablist. Left and Right arrow keys SHALL move between the tabs, wrapping at either end, and the dialogue SHALL open on Style.

#### Scenario: Arrow to the Typography tab
- **WHEN** the Style tab has focus and the user presses the Right arrow
- **THEN** the Typography tab is selected and the Font section is shown

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Typography tab has focus and the user presses the Right arrow
- **THEN** the Behaviour tab is selected and its panel is shown

#### Scenario: Arrow to the Integrations tab
- **WHEN** the Behaviour tab has focus and the user presses the Right arrow
- **THEN** the Integrations tab is selected and lists each integration with a checkbox, a description and where it installs
