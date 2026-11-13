## ADDED Requirements

### Requirement: Settings tabs
The settings dialogue SHALL show two tabs, Appearance and Behaviour, as a tablist. Left and Right arrow keys SHALL move between the tabs, and the dialogue SHALL open on Appearance. Appearance SHALL hold Theme, Font (with Family on its own row above its list, then Size as a slider, Weight, Bold weight, Line height, Letter spacing and Ligatures), Cursor and Inactive terminals. Behaviour SHALL hold Tiling, Responsive text and Panes.

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Appearance tab has focus and the user presses the Right arrow
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

## MODIFIED Requirements

### Requirement: Inactive pane settings
The Appearance tab SHALL have an Inactive terminals section with an Opacity slider from 0.3 to 1 (default 0.82) and a Desaturate checkbox (default off). The Behaviour tab's Panes section SHALL have a "Highlight the terminal under the mouse" checkbox (default on). Changes SHALL apply live to every pane and SHALL be saved with the other settings. A missing or invalid saved value SHALL fall back to its default, and an out-of-range opacity SHALL be clamped into range.

#### Scenario: Change inactive looks
- **WHEN** the user sets Opacity to 0.5, ticks Desaturate and presses Save
- **THEN** panes without focus show grey content at half opacity and the settings file holds those values

#### Scenario: Invalid saved inactive settings
- **WHEN** the settings file has an inactive opacity of `"dim"` and a hover highlight of `3`
- **THEN** the opacity is 0.82, the highlight is on and the other settings load
