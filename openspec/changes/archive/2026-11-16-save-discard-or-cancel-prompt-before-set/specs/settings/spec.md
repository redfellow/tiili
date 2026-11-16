## MODIFIED Requirements

### Requirement: Save and cancel
The dialogue SHALL have Cancel and Save buttons: Save SHALL save the previewed settings and close the dialogue; Cancel SHALL restore and apply the settings from when the dialogue was opened and close it without saving. Esc SHALL do the same as Cancel when nothing is unsaved, and otherwise SHALL first ask to confirm closing. A failed save SHALL keep the dialogue open and show the error.

#### Scenario: Save keeps the preview
- **WHEN** the user changes the font size to 16 and presses Save
- **THEN** the dialogue closes, the terminal keeps size 16 and the settings file holds size 16

#### Scenario: Cancel reverts the preview
- **WHEN** the user changes the theme from Nord to Dracula and then presses Cancel
- **THEN** the dialogue closes without asking, the terminal shows Nord again and the settings file is unchanged

#### Scenario: Esc with nothing unsaved
- **WHEN** the user opens settings and presses Esc without changing anything
- **THEN** the dialogue closes without asking

### Requirement: Closing the settings window cancels
Closing the settings window with the OS close control SHALL act as Cancel when nothing is unsaved: the owning tiili window SHALL return to the settings from when the window opened and nothing SHALL be saved. With unsaved changes it SHALL first ask to confirm closing.

#### Scenario: Close with the OS control
- **WHEN** the user previews Dracula, closes the settings window with its OS close button and picks Discard
- **THEN** the tiili window shows the previous theme again and the settings file is unchanged

## ADDED Requirements

### Requirement: Confirm closing with unsaved changes
When the previewed settings differ from the saved ones, Esc and the settings window's OS close control SHALL show a native OS message box with Save, Discard and Cancel. Save SHALL act as the Save button, Discard as the Cancel button, and Cancel or dismissing the box SHALL keep the settings open with the preview unchanged. Closing the owning tiili window SHALL still close settings without asking.

#### Scenario: Keep editing
- **WHEN** the user previews Dracula, presses Esc and picks Cancel in the message box
- **THEN** the settings stay open and the terminal still shows Dracula

#### Scenario: Save from the question
- **WHEN** the user previews Dracula, presses the OS close button and picks Save
- **THEN** the settings window closes and the settings file holds Dracula

#### Scenario: Owner window closes silently
- **WHEN** the user has unsaved changes and closes the tiili window that opened settings
- **THEN** the settings window closes without asking and nothing is saved
