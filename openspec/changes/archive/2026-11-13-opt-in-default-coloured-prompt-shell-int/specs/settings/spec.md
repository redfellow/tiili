## ADDED Requirements

### Requirement: Prompt choice
The user SHALL be able to choose the shell prompt tiili gives new shells: Off (the shell's own prompt), Classic, Minimal or Tiili. Off SHALL be the default and SHALL be marked "(default)"; an unknown or wrong-typed saved value SHALL load as Off. The choice SHALL apply to shells opened after it, not to shells already open.

#### Scenario: Off by default
- **WHEN** tiili starts with no saved settings, or the saved prompt is unknown
- **THEN** the prompt setting is Off and shells start as they did before

#### Scenario: New panes use the choice
- **WHEN** the user chooses Classic and opens a new pane
- **THEN** the new pane's shell starts with the Classic prompt and open panes keep theirs

### Requirement: Prompt list
The prompt choices SHALL be shown on the Style tab under Theme as a list like the theme list, each row showing a preview of that prompt drawn in the selected theme's terminal background and ANSI colours, with a hint saying the choice applies to new panes and that a prompt set in the user's own shell config wins.

#### Scenario: Preview follows the theme
- **WHEN** the user moves the theme list from Nord to Dracula
- **THEN** the prompt previews redraw in Dracula's colours
