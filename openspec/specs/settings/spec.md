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
The dialogue SHALL have Cancel and Save buttons: Save SHALL save the previewed settings and close the dialogue; Cancel and Esc SHALL restore and apply the settings from when the dialogue was opened and close it without saving. A failed save SHALL keep the dialogue open and show the error.

#### Scenario: Save keeps the preview
- **WHEN** the user changes the font size to 16 and presses Save
- **THEN** the dialogue closes, the terminal keeps size 16 and the settings file holds size 16

#### Scenario: Cancel reverts the preview
- **WHEN** the user changes the theme from Nord to Dracula and then presses Cancel or Esc
- **THEN** the dialogue closes, the terminal shows Nord again and the settings file is unchanged

### Requirement: Theme choice
The user SHALL be able to choose System (brand light/dark following the OS), tiili Light, tiili Dark, the tiili variants Savi, Muratti, Koski and Laasti, or Solarized Light, Solarized Dark, Gruvbox Dark, Nord and Dracula. Each theme SHALL define the app colours and all 16 ANSI colours, and each fixed theme's text and muted colours SHALL reach a 4.5:1 contrast on its background and surface.

#### Scenario: Fixed theme ignores the system
- **WHEN** the user chooses Koski and the system switches to light
- **THEN** the terminal keeps the Koski colours

#### Scenario: Readable theme colours
- **WHEN** any fixed theme is applied
- **THEN** its text and muted colours have at least 4.5:1 contrast on its background and surface

### Requirement: Default theme
Koski SHALL be the default theme and its card in the theme grid SHALL show a "DEFAULT" tag.

#### Scenario: Koski by default
- **WHEN** tiili starts with no saved settings, or the user resets the settings
- **THEN** Koski is applied and its card shows the "DEFAULT" tag

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
The dialogue SHALL have a Cursor row with a segmented control of Brick, Underline and Bar and a Blink checkbox, defaulting to Brick with blinking on. Changes SHALL apply live to the focused cursor of every terminal and be saved with the other settings. A missing or invalid saved cursor style or blink value SHALL fall back to Brick or blinking on respectively.

#### Scenario: Change the cursor
- **WHEN** the user chooses Bar, unticks Blink and presses Save
- **THEN** every pane shows a steady bar cursor and the settings file holds that cursor

#### Scenario: Invalid saved cursor
- **WHEN** the settings file has a cursor style of `"beam"`
- **THEN** the cursor is a Brick and the other settings load

### Requirement: Inactive pane settings
The Style tab's Terminal section SHALL have an "Inactive panes" row with an Opacity slider from 0.3 to 1 (default 0.82) and a Desaturate checkbox (default off). The Behaviour tab's Panes section SHALL have a "Highlight the terminal under the mouse" checkbox (default on). Changes SHALL apply live to every pane and SHALL be saved with the other settings. A missing or invalid saved value SHALL fall back to its default, and an out-of-range opacity SHALL be clamped into range.

#### Scenario: Change inactive looks
- **WHEN** the user sets Opacity to 0.5, ticks Desaturate and presses Save
- **THEN** panes without focus show grey content at half opacity and the settings file holds those values

#### Scenario: Invalid saved inactive settings
- **WHEN** the settings file has an inactive opacity of `"dim"` and a hover highlight of `3`
- **THEN** the opacity is 0.82, the highlight is on and the other settings load

### Requirement: Settings tabs
The settings dialogue SHALL show three tabs, Style, Typography and Behaviour in that order, as a tablist. Left and Right arrow keys SHALL move between the tabs, wrapping at either end, and the dialogue SHALL open on Style.

#### Scenario: Arrow to the Typography tab
- **WHEN** the Style tab has focus and the user presses the Right arrow
- **THEN** the Typography tab is selected and the Font section is shown

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Typography tab has focus and the user presses the Right arrow
- **THEN** the Behaviour tab is selected and its panel is shown

### Requirement: Settings tab contents
Style SHALL hold Theme, Prompt and Terminal (Cursor, Inactive panes and, on macOS, Dock icon). Typography SHALL hold Font, with the family list beside Size, Weight, Bold weight, Line height, Letter spacing and Ligatures. Behaviour SHALL hold Tiling, Panes (Responsive text, Hover), App (Startup, Updates) and Remote shells.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Tiling, Panes, App and Remote shells sections

### Requirement: Tiling setting
The Behaviour tab SHALL have Tiling cards, each with an icon above its label: Grid (default), Wide grid, Tall grid, Side by side and Stacked, with the hint "How panes are arranged as you open and close them." behind an info button. Choosing a mode SHALL re-lay out the open panes live, and the mode SHALL be saved with the settings. A missing or invalid saved mode SHALL fall back to Grid.

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
The user SHALL be able to choose the shell prompt tiili gives its shells: Off (the shell's own prompt), Classic, Minimal or Tiili. Off SHALL be the default and its card SHALL show a "DEFAULT" tag; an unknown or wrong-typed saved value SHALL load as Off. The choice SHALL apply to shells opened after it and to the local zsh, bash and PowerShell shells already open in the app, where those shells' own config left the default prompt.

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
The prompt choices SHALL be shown on the Style tab under Theme as one row of cards, each showing a preview of that prompt drawn in the selected theme's terminal background and ANSI colours, with an info button beside the Prompt heading whose hint says the choice applies to open and new panes and that a prompt set in the user's own shell config wins. Selecting a card SHALL preview that prompt in the open panes; Cancel and Esc SHALL put the saved prompt back.

#### Scenario: Preview follows the theme
- **WHEN** the user moves the theme grid from Nord to Dracula
- **THEN** the prompt previews redraw in Dracula's colours

#### Scenario: Live preview in open panes
- **WHEN** a zsh pane is idle at its prompt and the user moves the prompt cards from Off to Minimal, then cancels
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

### Requirement: Remote shells snippets
The Behaviour tab SHALL have a Remote shells section with an info button whose hint says that adding the snippet to a remote machine's shell startup file lets tiili show that machine's folder and repository. A bash / zsh / fish switch SHALL choose which one read-only snippet is shown, starting on bash each time the form resets, and a Copy button SHALL put the shown snippet on the clipboard. Each snippet SHALL report the folder with OSC 7 and the git root (empty outside a repository) as `tiili_repo` at every prompt. The section saves nothing.

#### Scenario: Copy the zsh snippet
- **WHEN** the user switches to zsh and clicks Copy
- **THEN** the clipboard holds the zsh snippet exactly as shown

#### Scenario: Snippet reports a repository
- **WHEN** the bash snippet is sourced on a remote machine and the user runs `cd /srv/api/src` inside repository `/srv/api`
- **THEN** the next prompt sends OSC 7 for `/srv/api/src` and `tiili_repo` set to the base64 of `/srv/api`

#### Scenario: Snippet outside a repository
- **WHEN** the user runs `cd /tmp` on the remote machine with the snippet sourced
- **THEN** the next prompt sends `tiili_repo` with an empty value

### Requirement: Update settings
The Updates row SHALL have a "Check automatically" checkbox, default on and saved with the settings, and a "Check now" button that checks immediately (ignoring the daily limit and a skipped version) and shows the result inline or opens the update dialog. A missing or invalid saved value SHALL fall back to on.

#### Scenario: Invalid saved update setting
- **WHEN** the settings file has an automatic update check of `"yes"`
- **THEN** automatic checks are on and the other settings load

### Requirement: Theme grid
The themes SHALL be shown in the dialogue as a grid of cards with System first, then the dark themes, then the light ones, without group headings. Left and Right SHALL move one card, Up and Down SHALL move one row, Home and End SHALL go to the first and last card, stopping at the ends, and clicking a card SHALL select it; each selection SHALL apply that theme at once.

#### Scenario: Right from Nord selects Dracula and the terminal shows it
- **WHEN** the theme grid has focus on Nord and the user presses the Right arrow
- **THEN** Dracula is selected and the terminal shows its colours without the dialogue closing

#### Scenario: Down moves to the card below
- **WHEN** the theme grid has focus on a card in its first row and the user presses the Down arrow
- **THEN** the card in the same column of the next row is selected and applied

### Requirement: Settings live preview
The Style and Typography tabs SHALL show a two-pane terminal preview above their contents, drawn with the previewed theme, prompt, cursor style and blink, font settings, and the inactive opacity and desaturation on its second pane. It SHALL redraw on every change, on Reset and when the settings are shown again. The Behaviour tab SHALL not show it.

#### Scenario: Preview follows the cursor
- **WHEN** the user chooses Bar on the Style tab
- **THEN** the preview's cursor becomes a bar at once

### Requirement: Compact settings window
With default settings, no tab's panel SHALL scroll in a 720×640 settings window, including the macOS Dock icon row. Cancel and Save SHALL stay visible at any window size, with only the panel body scrolling.

#### Scenario: Style tab fits
- **WHEN** the settings window is 720×640 on macOS with default settings and the Style tab is shown
- **THEN** its body does not scroll and Cancel and Save are visible
