# clipboard Specification

## Purpose
TBD - created by archiving change scaffold-the-tiili-app-one-window-one-wo. Update Purpose after archive.

## Requirements

### Requirement: Platform copy and paste shortcuts
The app SHALL copy the terminal selection and paste clipboard text with platform shortcuts: ⌘C, ⌘V and ⌘A (Select All) through an Edit menu on macOS; Ctrl+Shift+C and Ctrl+Shift+V on Windows and Linux.

#### Scenario: macOS Edit menu
- **WHEN** the app runs on macOS
- **THEN** the menu bar has an Edit menu with Copy (⌘C), Paste (⌘V) and Select All (⌘A) that act on the terminal

#### Scenario: Windows and Linux shortcuts
- **WHEN** the user presses Ctrl+Shift+C with text selected, or Ctrl+Shift+V, on Windows or Linux
- **THEN** the selection is copied, or the clipboard text is pasted into the shell, and the key is not sent to the shell

### Requirement: Ctrl+C still interrupts
On Windows and Linux plain Ctrl+C SHALL reach the shell as an interrupt.

#### Scenario: Interrupt
- **WHEN** the user presses Ctrl+C without Shift
- **THEN** the shell receives the interrupt character

### Requirement: Right-click Copy and Paste
Right-clicking the terminal SHALL offer Copy and Paste on all platforms.

#### Scenario: Context menu
- **WHEN** the user right-clicks the terminal
- **THEN** a menu with Copy and Paste appears and each acts on the terminal
