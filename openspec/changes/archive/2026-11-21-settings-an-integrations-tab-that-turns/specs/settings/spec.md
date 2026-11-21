## MODIFIED Requirements

### Requirement: Settings tabs
The settings dialogue SHALL show four tabs, Style, Typography, Behaviour and Integrations in that order, as a tablist. Left and Right arrow keys SHALL move between the tabs, wrapping at either end, and the dialogue SHALL open on Style.

#### Scenario: Arrow to the Typography tab
- **WHEN** the Style tab has focus and the user presses the Right arrow
- **THEN** the Typography tab is selected and the Font section is shown

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Typography tab has focus and the user presses the Right arrow
- **THEN** the Behaviour tab is selected and its panel is shown

#### Scenario: Arrow to the Integrations tab
- **WHEN** the Behaviour tab has focus and the user presses the Right arrow
- **THEN** the Integrations tab is selected and lists each integration with a checkbox, a description and where it installs

### Requirement: Settings tab contents
Style SHALL hold Theme, Prompt and Terminal (Cursor, Inactive panes and, on macOS, Dock icon). Typography SHALL hold Font, with the family list beside Size, Weight, Bold weight, Line height, Letter spacing and Ligatures. Behaviour SHALL hold Tiling, Panes (Responsive text, Hover, Scrollback lines), Attention, App (Startup, Updates) and Remote shells. Integrations SHALL hold Coding agents.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Tiling, Panes, Attention, App and Remote shells sections

### Requirement: Settings live preview
The Style and Typography tabs SHALL show a two-pane terminal preview above their contents, drawn with the previewed theme, prompt, cursor style and blink, font settings, and the inactive opacity and desaturation on its second pane. It SHALL redraw on every change, on Reset and when the settings are shown again. The Behaviour and Integrations tabs SHALL not show it.

#### Scenario: Preview follows the cursor
- **WHEN** the user chooses Bar on the Style tab
- **THEN** the preview's cursor becomes a bar at once

### Requirement: Confirm closing with unsaved changes
When the previewed settings differ from the saved ones, or an Integrations checkbox differs from what is installed, Esc and the settings window's OS close control SHALL show a native OS message box with Save, Discard and Cancel. Save SHALL act as the Save button, Discard as the Cancel button, and Cancel or dismissing the box SHALL keep the settings open with the preview unchanged. Closing the owning tiili window SHALL still close settings without asking.

#### Scenario: Keep editing
- **WHEN** the user previews Dracula, presses Esc and picks Cancel in the message box
- **THEN** the settings stay open and the terminal still shows Dracula

#### Scenario: Save from the question
- **WHEN** the user previews Dracula, presses the OS close button and picks Save
- **THEN** the settings window closes and the settings file holds Dracula

#### Scenario: Owner window closes silently
- **WHEN** the user has unsaved changes and closes the tiili window that opened settings
- **THEN** the settings window closes without asking and nothing is saved
