## ADDED Requirements

### Requirement: Inactive pane settings
The dialogue SHALL have an Inactive panes section with an Opacity slider from 0.3 to 1 (default 0.82) and a Desaturate checkbox (default off), and a Highlight terminal on mouseover checkbox (default on). Changes SHALL apply live to every pane and be saved with the other settings. A missing or invalid saved value SHALL fall back to its default, and an out-of-range opacity SHALL be clamped into range.

#### Scenario: Change inactive looks
- **WHEN** the user sets Opacity to 0.5, ticks Desaturate and presses Save
- **THEN** panes without focus show grey content at half opacity and the settings file holds those values

#### Scenario: Invalid saved inactive settings
- **WHEN** the settings file has an inactive opacity of `"dim"` and a hover highlight of `3`
- **THEN** the opacity is 0.82, the highlight is on and the other settings load
