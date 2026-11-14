## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Save and cancel
The dialogue SHALL have Cancel and Save buttons: Save SHALL save the previewed settings and close the dialogue; Cancel and Esc SHALL restore and apply the settings from when the dialogue was opened and close it without saving. A failed save SHALL keep the dialogue open and show the error.

#### Scenario: Save keeps the preview
- **WHEN** the user changes the font size to 16 and presses Save
- **THEN** the dialogue closes, the terminal keeps size 16 and the settings file holds size 16

#### Scenario: Cancel reverts the preview
- **WHEN** the user changes the theme from Nord to Dracula and then presses Cancel or Esc
- **THEN** the dialogue closes, the terminal shows Nord again and the settings file is unchanged

### Requirement: Default theme
Koski SHALL be the default theme and its card in the theme grid SHALL show a "DEFAULT" tag.

#### Scenario: Koski by default
- **WHEN** tiili starts with no saved settings, or the user resets the settings
- **THEN** Koski is applied and its card shows the "DEFAULT" tag

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

## REMOVED Requirements

### Requirement: Theme list
**Reason**: Replaced by the Theme grid requirement.
**Migration**: None; the same themes are chosen from cards.
