# settings Specification

## Purpose
Let the user choose how tiili looks (theme and terminal font) in one settings dialogue that applies changes live, keeps them across restarts and is where every later tiili setting lives.

## Requirements

### Requirement: Settings dialogue
The app SHALL open a settings dialogue with ⌘, on macOS (also from the app menu's Settings… item) and Ctrl+, on Windows and Linux, from a Settings… item in the terminal's context menu, and from the gear at the right of the window's top bar. Each change in the dialogue SHALL apply to tiili immediately as a preview, and nothing SHALL be saved while the dialogue is open.

#### Scenario: Open by shortcut
- **WHEN** the user presses the platform's settings shortcut
- **THEN** the settings dialogue opens and the key is not sent to the shell

#### Scenario: Open from the top bar
- **WHEN** the user clicks the gear in the window's top bar
- **THEN** the settings dialogue opens

### Requirement: Settings dialogue placement
The settings dialogue SHALL open in its own OS window, separate from the tiili window that opened it, so the user can move it anywhere on screen and resize it, including larger than the tiili window. It SHALL open centred over the tiili window that opened it and SHALL NOT dim or block that window.

#### Scenario: Larger than the tiili window
- **WHEN** the tiili window is smaller than the settings dialogue and the user opens settings
- **THEN** the settings window opens at its own size, extending beyond the tiili window's bounds

#### Scenario: Drag the dialogue
- **WHEN** the user drags the settings window's title bar past the tiili window's edge
- **THEN** the settings window follows the pointer outside the tiili window

#### Scenario: Open settings twice
- **WHEN** the settings window is open and the user presses the settings shortcut in the same tiili window
- **THEN** the existing settings window comes to the front and no second one opens

#### Scenario: Closing the tiili window closes settings
- **WHEN** the settings window is open and the user closes the tiili window that opened it
- **THEN** the settings window closes without saving

#### Scenario: Previews show in the owning window
- **WHEN** the user changes the theme in the settings window
- **THEN** the tiili window that opened it shows the new theme immediately

### Requirement: Save and cancel
The dialogue SHALL have Cancel and Save buttons: Save SHALL save the previewed settings and close the dialogue; Cancel, Esc and the × button SHALL restore and apply the settings from when the dialogue was opened and close it without saving. A failed save SHALL keep the dialogue open and show the error.

#### Scenario: Save keeps the preview
- **WHEN** the user changes the font size to 16 and presses Save
- **THEN** the dialogue closes, the terminal keeps size 16 and the settings file holds size 16

#### Scenario: Cancel reverts the preview
- **WHEN** the user changes the theme from Nord to Dracula and then presses Cancel, Esc or ×
- **THEN** the dialogue closes, the terminal shows Nord again and the settings file is unchanged

### Requirement: Theme choice
The user SHALL be able to choose System (brand light/dark following the OS), tiili Light, tiili Dark, the tiili variants Savi, Muratti, Koski and Laasti, or Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula. Each theme SHALL define the app colours and all 16 ANSI colours, and each fixed theme's text and muted colours SHALL reach a 4.5:1 contrast on its background and surface.

#### Scenario: Fixed theme ignores the system
- **WHEN** the user chooses Koski and the system switches to light
- **THEN** the terminal keeps the Koski colours

#### Scenario: Readable theme colours
- **WHEN** any fixed theme is applied
- **THEN** its text and muted colours have at least 4.5:1 contrast on its background and surface

### Requirement: Theme list
The themes SHALL be shown in the dialogue as a visible list with System first, then a Dark group and a Light group, each row led by a swatch of that theme's colours. Moving through the list with the arrow keys or clicking a theme name SHALL apply that theme at once.

#### Scenario: Arrowing previews themes
- **WHEN** the theme list has focus on Nord and the user presses the Down arrow
- **THEN** the next theme in the Dark group is selected and the terminal shows its colours without the dialogue closing

### Requirement: Default theme
Koski SHALL be the default theme and its row in the theme list SHALL show a muted "(default)" after its name.

#### Scenario: Koski by default
- **WHEN** tiili starts with no saved settings, or the user resets the settings
- **THEN** the Koski theme is applied

### Requirement: Font settings
The user SHALL be able to set font family, size, normal and bold weight (100–900 in steps of 10), ligatures on or off, line height (1.0–2.0) and letter spacing (−2 to 5 px), and reset them to defaults. The default font SHALL be Geist Mono at weight 100. Weight, bold weight, line height and letter spacing SHALL be sliders showing their value. Turning ligatures on SHALL work without an error.

#### Scenario: Negative letter spacing
- **WHEN** the user sets letter spacing to −1
- **THEN** the terminal draws its letters 1 px closer together

### Requirement: Font family list
The family SHALL be chosen from a keyboard-navigable list with a Bundled group (Geist Mono, Victor Mono, Commit Mono, Recursive Mono, Cascadia Code) and an OS group (the fixed-width fonts installed on the machine), and moving through it SHALL apply the font at once; a missing font SHALL fall back to Geist Mono.

#### Scenario: Unavailable font
- **WHEN** the saved font family is not installed
- **THEN** the terminal uses Geist Mono

#### Scenario: Arrowing previews fonts
- **WHEN** the family list has focus on Geist Mono and the user presses the Down arrow
- **THEN** Victor Mono is selected and the terminal uses it at once

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

### Requirement: Cursor settings
The dialogue SHALL have a Cursor section with a Style dropdown of Brick, Underline and Bar and a Blink checkbox, defaulting to Brick with blinking on. Changes SHALL apply live to the focused cursor of every terminal and be saved with the other settings. A missing or invalid saved cursor style or blink value SHALL fall back to Brick or blinking on respectively.

#### Scenario: Change the cursor
- **WHEN** the user chooses Bar, unticks Blink and presses Save
- **THEN** every pane shows a steady bar cursor and the settings file holds that cursor

#### Scenario: Invalid saved cursor
- **WHEN** the settings file has a cursor style of `"beam"`
- **THEN** the cursor is a Brick and the other settings load

### Requirement: Inactive pane settings
The Style tab SHALL have an Inactive terminals section with an Opacity slider from 0.3 to 1 (default 0.82) and a Desaturate checkbox (default off). The Behaviour tab's Panes section SHALL have a "Highlight the terminal under the mouse" checkbox (default on). Changes SHALL apply live to every pane and SHALL be saved with the other settings. A missing or invalid saved value SHALL fall back to its default, and an out-of-range opacity SHALL be clamped into range.

#### Scenario: Change inactive looks
- **WHEN** the user sets Opacity to 0.5, ticks Desaturate and presses Save
- **THEN** panes without focus show grey content at half opacity and the settings file holds those values

#### Scenario: Invalid saved inactive settings
- **WHEN** the settings file has an inactive opacity of `"dim"` and a hover highlight of `3`
- **THEN** the opacity is 0.82, the highlight is on and the other settings load

### Requirement: Settings tabs
The settings dialogue SHALL show three tabs, Style, Typography and Behaviour in that order, as a tablist. Left and Right arrow keys SHALL move between the tabs, wrapping at either end, and the dialogue SHALL open on Style. Style SHALL hold Theme, Cursor and Inactive terminals. Typography SHALL hold Font (with Family on its own row above its list, then Size as a slider, Weight, Bold weight, Line height, Letter spacing and Ligatures). Behaviour SHALL hold Tiling, Responsive text and Panes.

#### Scenario: Arrow to the Typography tab
- **WHEN** the Style tab has focus and the user presses the Right arrow
- **THEN** the Typography tab is selected and the Font section is shown

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Typography tab has focus and the user presses the Right arrow
- **THEN** the Behaviour tab is selected and its panel is shown

### Requirement: Tiling setting
The Behaviour tab SHALL have a Tiling list. Each row SHALL have an icon, and the rows SHALL be Grid (default), Wide grid, Tall grid, Side by side and Stacked, with the hint "How panes are arranged as you open and close them." Choosing a mode SHALL re-lay out the open panes live, and the mode SHALL be saved with the settings. A missing or invalid saved mode SHALL fall back to Grid.

#### Scenario: Invalid saved tiling
- **WHEN** the settings file has a tiling layout of `"spiral"`
- **THEN** the tiling is Grid and the other settings load

### Requirement: Responsive text
The Behaviour tab SHALL have a "Shrink text in small panes" checkbox (default on) and a Strength slider from 0 to 2 (default 0.5). When the checkbox is on, a pane smaller than the tiled area SHALL draw its text with a smaller font size, line height and slightly tighter letter spacing, never below 7 px and a line height of 1. A pane that fills the area SHALL keep the chosen font values. Missing or invalid saved values SHALL fall back to their defaults.

#### Scenario: Small pane shrinks text
- **WHEN** responsive text is on at strength 0.5 and a pane has a quarter of the tiled area with font size 14
- **THEN** that pane's text is drawn at 10.5 px

#### Scenario: Responsive text off
- **WHEN** responsive text is off
- **THEN** every pane uses the chosen font size

### Requirement: Prompt choice
The user SHALL be able to choose the shell prompt tiili gives its shells: Off (the shell's own prompt), Classic, Minimal or Tiili. Off SHALL be the default and SHALL be marked "(default)"; an unknown or wrong-typed saved value SHALL load as Off. The choice SHALL apply to shells opened after it and to the local zsh, bash and PowerShell shells already open in the app, where those shells' own config left the default prompt.

#### Scenario: Off by default
- **WHEN** tiili starts with no saved settings, or the saved prompt is unknown
- **THEN** the prompt setting is Off and shells show their own prompt

#### Scenario: New panes use the choice
- **WHEN** the user chooses Classic and opens a new pane
- **THEN** the new pane's shell starts with the Classic prompt

#### Scenario: Open panes switch
- **WHEN** a zsh pane started with Off is idle at its prompt and the user saves Tiili
- **THEN** the pane's prompt redraws as the Tiili prompt without anything typed into the shell

#### Scenario: Other shells switch at next prompt
- **WHEN** a bash or PowerShell pane started with Off is running a command and the user saves Tiili
- **THEN** the pane switches to the Tiili prompt at its next prompt, and nothing is typed into the shell

#### Scenario: Own prompt wins
- **WHEN** a pane's shell config sets its own prompt and the user saves Classic
- **THEN** that pane keeps its own prompt

### Requirement: Prompt list
The prompt choices SHALL be shown on the Style tab under Theme as a list like the theme list, each row showing a preview of that prompt drawn in the selected theme's terminal background and ANSI colours, with a hint saying the choice applies to open and new panes and that a prompt set in the user's own shell config wins. Selecting a row SHALL preview that prompt in the open panes; Cancel, Esc and × SHALL put the saved prompt back.

#### Scenario: Preview follows the theme
- **WHEN** the user moves the theme list from Nord to Dracula
- **THEN** the prompt previews redraw in Dracula's colours

#### Scenario: Live preview in open panes
- **WHEN** a zsh pane is idle at its prompt and the user moves the prompt list from Off to Minimal, then cancels
- **THEN** the pane shows the Minimal prompt while Minimal is selected and its own prompt again after Cancel

### Requirement: Saved settings apply in every window
Saving settings in any window SHALL apply them in every open window.

#### Scenario: Theme saved in one window
- **WHEN** two windows are open and the user saves a new theme in one
- **THEN** both windows show the new theme

### Requirement: Closing the settings window cancels
Closing the settings window with the OS close control SHALL act as Cancel: the owning tiili window SHALL return to the settings from when the window opened and nothing SHALL be saved.

#### Scenario: Close with the OS control
- **WHEN** the user previews Dracula and closes the settings window with its OS close button
- **THEN** the tiili window shows the previous theme again and the settings file is unchanged

### Requirement: Confirm reset to defaults
The dialogue's "Reset to defaults" button SHALL first ask "Reset all settings?" in the footer, with Reset and Keep buttons in its place. Reset SHALL set every setting to its default as an unsaved preview. Keep, or Esc while the question is shown, SHALL put the button back without changing any setting or closing the dialogue.

#### Scenario: Confirm the reset
- **WHEN** the user has previewed Nord, presses "Reset to defaults" and then Reset
- **THEN** Koski and every other default are previewed, and nothing is saved until Save

#### Scenario: Keep the settings
- **WHEN** the user presses "Reset to defaults" and then Keep or Esc
- **THEN** the "Reset to defaults" button shows again, the settings are unchanged and the dialogue stays open
