# settings Specification

## Purpose
Let the user choose how tiili looks (theme and terminal font) in one settings dialogue that applies changes live, keeps them across restarts and is where every later tiili setting lives.

## Requirements

### Requirement: Settings dialogue
The app SHALL open a settings dialogue with ⌘, on macOS (also from the app menu's Settings… item) and Ctrl+, on Windows and Linux, and from a Settings… item in the terminal's context menu. Changes SHALL apply immediately.

#### Scenario: Open by shortcut
- **WHEN** the user presses the platform's settings shortcut
- **THEN** the settings dialogue opens and the key is not sent to the shell

### Requirement: Theme choice
The user SHALL be able to choose System (brand light/dark following the OS), tiili Light, tiili Dark, the tiili variants Savi, Muratti, Koski and Laasti, or Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula. Each theme SHALL define the app colours and all 16 ANSI colours.

#### Scenario: Fixed theme ignores the system
- **WHEN** the user chooses Koski and the system switches to light
- **THEN** the terminal keeps the Koski colours

### Requirement: Font settings
The user SHALL be able to set font family (any installed font by name, falling back to Geist Mono), size, normal and bold weight, ligatures on or off, line height and letter spacing, and reset them to defaults.

#### Scenario: Unavailable font
- **WHEN** the user enters a font family that is not installed
- **THEN** the terminal uses Geist Mono

### Requirement: Settings persist
Settings SHALL be saved as JSON in the OS app config folder and restored at start; a missing file, unreadable file or invalid value SHALL fall back to the default for that value.

#### Scenario: Restart keeps settings
- **WHEN** the user changes the theme and restarts tiili
- **THEN** the chosen theme is applied at start

#### Scenario: Broken value
- **WHEN** the settings file has a font size of `"huge"`
- **THEN** the other settings load and the font size is the default
