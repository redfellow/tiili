## MODIFIED Requirements

### Requirement: Settings tab contents
Style SHALL hold Theme, Cursor and Inactive terminals. Typography SHALL hold Font (with Family on its own row above its list, then Size as a slider, Weight, Bold weight, Line height, Letter spacing and Ligatures). Behaviour SHALL hold Tiling, Responsive text, Panes, Remote shells and Updates.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Tiling, Responsive text, Panes, Remote shells and Updates sections

## ADDED Requirements

### Requirement: Update settings
The Updates section SHALL have a "Check for updates automatically" checkbox, default on and saved with the settings, and a "Check for updates" button that checks immediately (ignoring the daily limit and a skipped version) and shows the result inline or opens the update dialog. A missing or invalid saved value SHALL fall back to on.

#### Scenario: Invalid saved update setting
- **WHEN** the settings file has an automatic update check of `"yes"`
- **THEN** automatic checks are on and the other settings load
