## MODIFIED Requirements

### Requirement: Terminal scrollbar
Each terminal's scrollbar SHALL be 8 px wide and SHALL NOT show an overview-ruler border. While a search has matches, the scrollbar SHALL show a mark for each match in the match highlight colours.

#### Scenario: Slim scrollbar
- **WHEN** a terminal has scrollback
- **THEN** its scrollbar is 8 px wide with no hairline beside it

#### Scenario: Match marks
- **WHEN** a search finds matches in the scrollback
- **THEN** the scrollbar shows a mark at each match's position
