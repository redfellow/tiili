## MODIFIED Requirements

### Requirement: Settings dialogue
The app SHALL open a settings dialogue with ⌘, on macOS (also from the app menu's Settings… item) and Ctrl+, on Windows and Linux, and from a Settings… item in the terminal's context menu. Each change in the dialogue SHALL apply to tiili immediately as a preview, and nothing SHALL be saved while the dialogue is open. The dialogue SHALL have Cancel and Save buttons: Save SHALL save the previewed settings and close the dialogue; Cancel, Esc and the × button SHALL restore and apply the settings from when the dialogue was opened and close it without saving. A failed save SHALL keep the dialogue open and show the error.

#### Scenario: Open by shortcut
- **WHEN** the user presses the platform's settings shortcut
- **THEN** the settings dialogue opens and the key is not sent to the shell

#### Scenario: Save keeps the preview
- **WHEN** the user changes the font size to 16 and presses Save
- **THEN** the dialogue closes, the terminal keeps size 16 and the settings file holds size 16

#### Scenario: Cancel reverts the preview
- **WHEN** the user changes the theme from Nord to Dracula and then presses Cancel, Esc or ×
- **THEN** the dialogue closes, the terminal shows Nord again and the settings file is unchanged

### Requirement: Theme choice
The user SHALL be able to choose System (brand light/dark following the OS), tiili Light, tiili Dark, the tiili variants Savi, Muratti, Koski and Laasti, or Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula. Each theme SHALL define the app colours and all 16 ANSI colours. The themes SHALL be shown in the dialogue as a visible list, and moving through it with the arrow keys or clicking a theme name SHALL apply that theme at once.

#### Scenario: Fixed theme ignores the system
- **WHEN** the user chooses Koski and the system switches to light
- **THEN** the terminal keeps the Koski colours

#### Scenario: Arrowing previews themes
- **WHEN** the theme list has focus on Nord and the user presses the Down arrow
- **THEN** Dracula is selected and the terminal shows the Dracula colours without the dialogue closing
