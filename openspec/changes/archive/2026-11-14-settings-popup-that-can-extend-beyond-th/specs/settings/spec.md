## MODIFIED Requirements

### Requirement: Settings dialogue placement
The settings dialogue SHALL open in its own OS window, separate from the tiili window that opened it, so the user can move it anywhere on screen and resize it, including larger than the tiili window. It SHALL open centred over the tiili window that opened it and SHALL NOT dim or block that window. Opening settings again from a tiili window that already has its settings window open SHALL bring that settings window to the front instead of opening another. Closing a tiili window SHALL close its settings window without saving.

#### Scenario: Larger than the tiili window
- **WHEN** the tiili window is smaller than the settings dialogue and the user opens settings
- **THEN** the settings window opens at its own size, extending beyond the tiili window's bounds

#### Scenario: Drag the dialogue
- **WHEN** the user drags the settings window's title bar past the tiili window's edge
- **THEN** the settings window follows the pointer outside the tiili window

#### Scenario: Open settings twice
- **WHEN** the settings window is open and the user presses the settings shortcut in the same tiili window
- **THEN** the existing settings window comes to the front and no second one opens

#### Scenario: Previews show in the owning window
- **WHEN** the user changes the theme in the settings window
- **THEN** the tiili window that opened it shows the new theme immediately

## ADDED Requirements

### Requirement: Closing the settings window cancels
Closing the settings window with the OS close control SHALL act as Cancel: the owning tiili window SHALL return to the settings from when the window opened and nothing SHALL be saved.

#### Scenario: Close with the OS control
- **WHEN** the user previews Dracula and closes the settings window with its OS close button
- **THEN** the tiili window shows the previous theme again and the settings file is unchanged
