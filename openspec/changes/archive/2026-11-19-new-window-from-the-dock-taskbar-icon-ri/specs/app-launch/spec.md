## Purpose

How tiili is launched and relaunched from the OS: one running tiili per user, and New Window from the Dock or taskbar icon onto the current desktop.

## ADDED Requirements

### Requirement: One running tiili

When tiili is launched while it already runs, the new process SHALL hand its arguments to the running tiili and exit without opening a window or restoring the session. With no `--new-window` argument the running tiili SHALL bring its last focused window to the front. A development run (`npm run tauri dev`) SHALL NOT take part in this hand-off: it shares the installed tiili's identifier, so it starts as a tiili of its own even while the installed one runs.

#### Scenario: Plain relaunch focuses
- **WHEN** tiili runs and is started again with no arguments
- **THEN** the second process exits, no session is restored again, and the last focused tiili window is focused

#### Scenario: Relaunch with new-window
- **WHEN** tiili runs and is started again with `--new-window`
- **THEN** the running tiili opens one new window on the current desktop and focuses it

#### Scenario: Dev run beside the installed tiili
- **WHEN** the installed tiili runs and a development build is started with `npm run tauri dev`
- **THEN** the development build opens its own window and the installed tiili is left as it was

### Requirement: New Window from the app icon

tiili SHALL offer New Window from its app icon: a Dock menu item on macOS, a jump-list task on Windows and a desktop action in the Linux .desktop entry. Each SHALL open a new tiili window on the current desktop or Space and focus it.

#### Scenario: macOS Dock menu
- **WHEN** the user right-clicks tiili's Dock icon and chooses New Window
- **THEN** a new window opens on the current Space without switching Spaces, and takes focus

#### Scenario: Windows jump list
- **WHEN** the user chooses New Window from tiili's taskbar jump list
- **THEN** tiili is launched with `--new-window` and the running tiili opens a new window

#### Scenario: Linux desktop action
- **WHEN** the installed .desktop entry is read
- **THEN** it lists `Actions=new-window;` and a `[Desktop Action new-window]` with `Name=New Window` and `Exec=tiili --new-window`
