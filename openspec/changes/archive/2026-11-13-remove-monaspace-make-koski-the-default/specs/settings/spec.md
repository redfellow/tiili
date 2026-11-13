## MODIFIED Requirements

### Requirement: Settings dialogue
The app SHALL open a settings dialogue with ⌘, on macOS (also from the app menu's Settings… item) and Ctrl+, on Windows and Linux, from a Settings… item in the terminal's context menu, and from the gear at the right of the window's top bar. Each change in the dialogue SHALL apply to tiili immediately as a preview, and nothing SHALL be saved while the dialogue is open. The dialogue SHALL NOT dim the window behind it, so the terminal stays readable, and SHALL be movable by dragging its header within the window, opening centred each time.

#### Scenario: Open by shortcut
- **WHEN** the user presses the platform's settings shortcut
- **THEN** the settings dialogue opens and the key is not sent to the shell

#### Scenario: Open from the top bar
- **WHEN** the user clicks the gear in the window's top bar
- **THEN** the settings dialogue opens

#### Scenario: Drag the dialogue
- **WHEN** the user drags the dialogue's header towards the window's edge
- **THEN** the dialogue follows the pointer and stops at the window's edge

### Requirement: Theme choice
The user SHALL be able to choose System (brand light/dark following the OS), tiili Light, tiili Dark, the tiili variants Savi, Muratti, Koski and Laasti, or Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula. Each theme SHALL define the app colours and all 16 ANSI colours, and each fixed theme's text and muted colours SHALL reach a 4.5:1 contrast on its background and surface. The themes SHALL be shown in the dialogue as a visible list with System first, then a Dark group and a Light group, each row led by a swatch of that theme's colours. Koski SHALL be the default theme and its row SHALL show a muted "(default)" after its name. Moving through the list with the arrow keys or clicking a theme name SHALL apply that theme at once.

#### Scenario: Fixed theme ignores the system
- **WHEN** the user chooses Koski and the system switches to light
- **THEN** the terminal keeps the Koski colours

#### Scenario: Arrowing previews themes
- **WHEN** the theme list has focus on Nord and the user presses the Down arrow
- **THEN** the next theme in the Dark group is selected and the terminal shows its colours without the dialogue closing

#### Scenario: Koski by default
- **WHEN** tiili starts with no saved settings, or the user resets the settings
- **THEN** the Koski theme is applied

#### Scenario: Readable theme colours
- **WHEN** any fixed theme is applied
- **THEN** its text and muted colours have at least 4.5:1 contrast on its background and surface

### Requirement: Font settings
The user SHALL be able to set font family, size, normal and bold weight (100–900 in steps of 10), ligatures on or off, line height (1.0–2.0) and letter spacing (−2 to 5 px), and reset them to defaults. The default font SHALL be Geist Mono at weight 100. The family SHALL be chosen from a keyboard-navigable list with a Bundled group (Geist Mono, Victor Mono, Commit Mono, Recursive Mono, Cascadia Code) and an OS group (the fixed-width fonts installed on the machine), and moving through it SHALL apply the font at once; a missing font SHALL fall back to Geist Mono. Weight, bold weight, line height and letter spacing SHALL be sliders showing their value. Turning ligatures on SHALL work without an error.

#### Scenario: Unavailable font
- **WHEN** the saved font family is not installed
- **THEN** the terminal uses Geist Mono

#### Scenario: Arrowing previews fonts
- **WHEN** the family list has focus on Geist Mono and the user presses the Down arrow
- **THEN** Victor Mono is selected and the terminal uses it at once

#### Scenario: Negative letter spacing
- **WHEN** the user sets letter spacing to −1
- **THEN** the terminal draws its letters 1 px closer together

### Requirement: Settings persist
Settings SHALL be saved as JSON in the OS app config folder and restored at start; a missing file, unreadable file or invalid value SHALL fall back to the default for that value. A saved theme SHALL be kept even though the default theme changed.

#### Scenario: Restart keeps settings
- **WHEN** the user changes the theme and restarts tiili
- **THEN** the chosen theme is applied at start

#### Scenario: Broken value
- **WHEN** the settings file has a font size of `"huge"`
- **THEN** the other settings load and the font size is the default

#### Scenario: Saved theme survives the new default
- **WHEN** a settings file saved earlier holds the Nord theme and no cursor settings
- **THEN** Nord is applied and the cursor is a blinking Brick

## ADDED Requirements

### Requirement: Cursor settings
The dialogue SHALL have a Cursor section with a Style dropdown of Brick, Underline and Bar and a Blink checkbox, defaulting to Brick with blinking on. Changes SHALL apply live to the focused cursor of every terminal and be saved with the other settings. A missing or invalid saved cursor style or blink value SHALL fall back to Brick or blinking on respectively.

#### Scenario: Change the cursor
- **WHEN** the user chooses Bar, unticks Blink and presses Save
- **THEN** every pane shows a steady bar cursor and the settings file holds that cursor

#### Scenario: Invalid saved cursor
- **WHEN** the settings file has a cursor style of `"beam"`
- **THEN** the cursor is a Brick and the other settings load
