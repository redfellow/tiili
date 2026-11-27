## MODIFIED Requirements

### Requirement: Settings tab contents
Style SHALL hold Theme, Prompt and Terminal (Cursor, Inactive panes and, on macOS, Dock icon). Typography SHALL hold Font, with the family list beside Size, Weight, Bold weight, Line height, Letter spacing and Ligatures. Behaviour SHALL hold Shell, Tiling, Panes (Responsive text, Hover, Scrollback lines), Attention, App (Startup, Updates) and Remote shells. Integrations SHALL hold Coding agents.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Shell, Tiling, Panes, Attention, App and Remote shells sections

## ADDED Requirements

### Requirement: Shell choice
The Shell section SHALL offer a menu of System default (naming the default shell), the shells installed on this machine (`/etc/shells` on macOS and Linux; Windows PowerShell, PowerShell 7 when on `PATH`, and Command Prompt on Windows) and Other…, which shows a field for a shell's path. System default SHALL be the default; a wrong-typed saved value SHALL load as System default. The choice SHALL apply to panes opened after Save; open panes keep their shell.

#### Scenario: System default by default
- **WHEN** tiili starts with no saved settings on a machine whose default shell is fish
- **THEN** the Shell menu shows `System default (fish)` and new panes run fish

#### Scenario: Installed shells listed
- **WHEN** `/etc/shells` lists `/bin/bash`, `/usr/bin/zsh` and `/usr/bin/fish` and the user opens the Shell menu
- **THEN** the menu shows System default, those three paths and Other…

#### Scenario: New panes use the chosen shell
- **WHEN** the user chooses `/usr/bin/zsh`, saves, and opens a new pane while a fish pane is open
- **THEN** the new pane runs zsh and the open pane keeps running fish

#### Scenario: Custom path
- **WHEN** the user chooses Other…, types `/opt/homebrew/bin/nu` and saves
- **THEN** new panes run that shell and reopening Settings shows Other… with that path

#### Scenario: Restart keeps the shell
- **WHEN** the user saved `/usr/bin/zsh` and restarts tiili
- **THEN** the restored panes and new panes run zsh
