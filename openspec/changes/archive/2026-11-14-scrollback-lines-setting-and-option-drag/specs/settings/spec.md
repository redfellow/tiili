## MODIFIED Requirements

### Requirement: Settings tab contents
Style SHALL hold Theme, Prompt and Terminal (Cursor, Inactive panes and, on macOS, Dock icon). Typography SHALL hold Font, with the family list beside Size, Weight, Bold weight, Line height, Letter spacing and Ligatures. Behaviour SHALL hold Tiling, Panes (Responsive text, Hover, Scrollback lines), Attention, App (Startup, Updates) and Remote shells.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Tiling, Panes, Attention, App and Remote shells sections

## ADDED Requirements

### Requirement: Scrollback lines setting
The Behaviour tab's Panes section SHALL have a "Scrollback lines" number field, default 10 000, from 1 000 to 100 000. Changes SHALL apply live to every open terminal pane and SHALL be saved with the other settings. An out-of-range value SHALL be clamped into range and a missing or invalid value SHALL fall back to 10 000.

#### Scenario: Change scrollback
- **WHEN** the user sets Scrollback lines to 50 000 and presses Save
- **THEN** every open terminal keeps up to 50 000 lines and the setting is applied after a restart

#### Scenario: Out of range
- **WHEN** the settings file has a scrollback of 5 000 000
- **THEN** the scrollback is 100 000 and the other settings load

#### Scenario: Move a full scrollback
- **WHEN** a pane with 100 000 lines of scrollback is moved to another window
- **THEN** all its lines arrive in the new window
