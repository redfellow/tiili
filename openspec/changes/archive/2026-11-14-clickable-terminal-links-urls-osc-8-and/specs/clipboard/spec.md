## MODIFIED Requirements

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
