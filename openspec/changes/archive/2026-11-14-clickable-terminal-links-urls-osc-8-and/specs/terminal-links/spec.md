## Purpose

Make URLs, OSC 8 hyperlinks and existing file paths in a tiili terminal pane clickable, opening them safely in the operating system rather than in the app's webview.

## ADDED Requirements

### Requirement: Modifier-click opens links
URLs, OSC 8 hyperlinks and path links SHALL open only on ⌘-click on macOS and Ctrl-click on Windows and Linux, never on a plain click, and SHALL never navigate the webview. A modifier-click on a link SHALL open it even when the running program has turned on mouse reporting.

#### Scenario: Plain click does nothing
- **WHEN** the user plain-clicks a URL
- **THEN** nothing opens

#### Scenario: Modifier-click in a mouse-reporting program
- **WHEN** a program reporting the mouse runs and the user ⌘-clicks (macOS) or Ctrl-clicks (Windows/Linux) a URL
- **THEN** the URL opens in the system browser and the click is not sent to the program

### Requirement: Hover hint
Hovering a link SHALL underline it and show a hint naming the open gesture, kept inside the pane and middle-truncated. For an OSC 8 link the hint SHALL show its real target.

#### Scenario: OSC 8 target shown
- **WHEN** the user hovers OSC 8 text whose target differs from the text
- **THEN** the hint shows the target URI

### Requirement: Scheme rules
`http`, `https` and `mailto` links SHALL open directly. Other schemes SHALL open only after a confirm dialog showing the scheme and full URI. `javascript:`, `data:`, `blob:` and `file://` with a non-local host SHALL never open. A Rust command SHALL enforce these rules before calling the opener.

#### Scenario: Unknown scheme asks first
- **WHEN** the user opens a `vscode://` link
- **THEN** a dialog shows the scheme and URI and the link opens only if confirmed

#### Scenario: Forbidden scheme
- **WHEN** an OSC 8 link targets `javascript:` or `data:`
- **THEN** it never opens

### Requirement: Existing file paths become links
Relative, `./`, `../`, `~/`, absolute and Windows drive paths, with an optional `:line[:col]` or `(line,col)`, SHALL become links only when they exist, resolved against the pane's current folder. Existence SHALL be checked only for the hovered line, asynchronously and cached. Paths in remote (ssh) and WSL panes SHALL stay plain text.

#### Scenario: Missing path
- **WHEN** the user hovers `src/nope.ts:12` and no such file exists
- **THEN** it is not a link

#### Scenario: Remote pane
- **WHEN** the pane is in an ssh session
- **THEN** paths are not links

### Requirement: Opening paths
A file SHALL open in the OS default app with any line dropped, and the hint SHALL say the line is ignored. A folder SHALL open in Finder, Explorer or the Linux file manager. Executables and launchers (macOS `.app .command .tool .pkg` and exec bit; Windows `.exe .bat .cmd .ps1 .vbs .js .msi .lnk .scr`; Linux exec bit and `.desktop`) SHALL only be revealed, never opened.

#### Scenario: Executable is revealed
- **WHEN** the user ⌘/Ctrl-clicks `./build.sh` which has the exec bit
- **THEN** its folder opens with the file selected and the script does not run
