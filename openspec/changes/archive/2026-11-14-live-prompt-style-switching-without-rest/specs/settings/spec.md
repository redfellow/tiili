## MODIFIED Requirements

### Requirement: Prompt choice
The user SHALL be able to choose the shell prompt tiili gives its shells: Off (the shell's own prompt), Classic, Minimal or Tiili. Off SHALL be the default and SHALL be marked "(default)"; an unknown or wrong-typed saved value SHALL load as Off. The choice SHALL apply to shells opened after it and to the local zsh, bash and PowerShell shells already open in the app, where those shells' own config left the default prompt. An open zsh shell SHALL redraw an idle prompt at once; other open shells SHALL switch at their next prompt. Nothing SHALL be typed into a shell to switch it.

#### Scenario: Off by default
- **WHEN** tiili starts with no saved settings, or the saved prompt is unknown
- **THEN** the prompt setting is Off and shells show their own prompt

#### Scenario: New panes use the choice
- **WHEN** the user chooses Classic and opens a new pane
- **THEN** the new pane's shell starts with the Classic prompt

#### Scenario: Open panes switch
- **WHEN** a zsh pane started with Off is idle at its prompt and the user saves Tiili
- **THEN** the pane's prompt redraws as the Tiili prompt without anything typed into the shell

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
