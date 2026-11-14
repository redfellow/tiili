## ADDED Requirements

### Requirement: Confirm reset to defaults
The dialogue's "Reset to defaults" button SHALL first ask "Reset all settings?" in the footer, with Reset and Keep buttons in its place. Reset SHALL set every setting to its default as an unsaved preview. Keep, or Esc while the question is shown, SHALL put the button back without changing any setting or closing the dialogue.

#### Scenario: Confirm the reset
- **WHEN** the user has previewed Nord, presses "Reset to defaults" and then Reset
- **THEN** Koski and every other default are previewed, and nothing is saved until Save

#### Scenario: Keep the settings
- **WHEN** the user presses "Reset to defaults" and then Keep or Esc
- **THEN** the "Reset to defaults" button shows again, the settings are unchanged and the dialogue stays open
