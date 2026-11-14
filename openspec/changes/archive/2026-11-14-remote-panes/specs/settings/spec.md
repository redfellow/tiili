## MODIFIED Requirements

### Requirement: Settings tabs
The settings dialogue SHALL show three tabs, Style, Typography and Behaviour in that order, as a tablist. Left and Right arrow keys SHALL move between the tabs, wrapping at either end, and the dialogue SHALL open on Style. Style SHALL hold Theme, Cursor and Inactive terminals. Typography SHALL hold Font (with Family on its own row above its list, then Size as a slider, Weight, Bold weight, Line height, Letter spacing and Ligatures). Behaviour SHALL hold Tiling, Responsive text, Panes and Remote shells.

#### Scenario: Arrow to the Typography tab
- **WHEN** the Style tab has focus and the user presses the Right arrow
- **THEN** the Typography tab is selected and the Font section is shown

#### Scenario: Arrow to the Behaviour tab
- **WHEN** the Typography tab has focus and the user presses the Right arrow
- **THEN** the Behaviour tab is selected and its panel is shown

## ADDED Requirements

### Requirement: Remote shells snippets
The Behaviour tab SHALL have a Remote shells section with a hint saying that adding the snippet to a remote machine's shell startup file lets tiili show that machine's folder and repository. It SHALL show one read-only snippet each for bash, zsh and fish, each with a Copy button that puts the snippet on the clipboard. Each snippet SHALL report the folder with OSC 7 and the git root (empty outside a repository) as `tiili_repo` at every prompt. The section saves nothing.

#### Scenario: Copy the zsh snippet
- **WHEN** the user clicks Copy beside the zsh snippet
- **THEN** the clipboard holds the zsh snippet exactly as shown

#### Scenario: Snippet reports a repository
- **WHEN** the bash snippet is sourced on a remote machine and the user runs `cd /srv/api/src` inside repository `/srv/api`
- **THEN** the next prompt sends OSC 7 for `/srv/api/src` and `tiili_repo` set to the base64 of `/srv/api`

#### Scenario: Snippet outside a repository
- **WHEN** the user runs `cd /tmp` on the remote machine with the snippet sourced
- **THEN** the next prompt sends `tiili_repo` with an empty value
