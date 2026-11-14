# clipboard Specification

## Purpose
Copy and paste between the tiili terminal and the system clipboard with each platform's usual shortcuts and context menu, without taking Ctrl+C away from the shell.

## Requirements

### Requirement: Platform copy and paste shortcuts
The app SHALL copy the terminal selection and paste clipboard text with platform shortcuts: ⌘C, ⌘V and ⌘A (Select All) through an Edit menu on macOS; Ctrl+Shift+C and Ctrl+Shift+V on Windows and Linux. The macOS Edit menu SHALL also have Find… (⌘F), Find Next (⌘G) and Find Previous (⇧⌘G) acting on the focused pane.

#### Scenario: macOS Edit menu
- **WHEN** the app runs on macOS
- **THEN** the menu bar has an Edit menu with Copy (⌘C), Paste (⌘V) and Select All (⌘A) that act on the terminal, and Find… (⌘F), Find Next (⌘G) and Find Previous (⇧⌘G) that act on the focused pane

#### Scenario: Windows and Linux shortcuts
- **WHEN** the user presses Ctrl+Shift+C with text selected, or Ctrl+Shift+V, on Windows or Linux
- **THEN** the selection is copied, or the clipboard text is pasted into the shell, and the key is not sent to the shell

### Requirement: Ctrl+C still interrupts
On Windows and Linux plain Ctrl+C SHALL reach the shell as an interrupt.

#### Scenario: Interrupt
- **WHEN** the user presses Ctrl+C without Shift
- **THEN** the shell receives the interrupt character

### Requirement: Right-click Copy and Paste
Right-clicking the terminal SHALL offer Copy and Paste on all platforms. When the pointer is on a link, link items SHALL come first: Open Link and Copy Link (the target) for a URL or OSC 8 link; Open (absent for executables), Reveal in Finder / Show in Explorer / Show in Folder, and Copy Path (absolute) for a path.

#### Scenario: Context menu
- **WHEN** the user right-clicks the terminal
- **THEN** a menu with Copy and Paste appears and each acts on the terminal

#### Scenario: Context menu on a URL
- **WHEN** the user right-clicks a hovered URL
- **THEN** Open Link and Copy Link appear above Copy and Paste, and Copy Link copies the target

#### Scenario: Context menu on a path
- **WHEN** the user right-clicks a hovered existing path
- **THEN** Open, the platform's reveal item and Copy Path appear above Copy and Paste, and Copy Path copies the absolute path

### Requirement: Menus act on the focused window
On macOS the Edit, Shell and app menu items SHALL act only on the focused window.

#### Scenario: Copy with two windows open
- **WHEN** two windows are open and the user chooses Edit › Copy
- **THEN** only the focused window's focused pane copies its selection
