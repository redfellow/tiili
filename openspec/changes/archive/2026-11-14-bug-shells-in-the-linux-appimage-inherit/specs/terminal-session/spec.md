## ADDED Requirements

### Requirement: Session environment in AppImage shells
When tiili runs from a Linux AppImage, every shell it spawns SHALL get no environment entries pointing at or inside the AppImage mount: such entries SHALL be dropped from colon-separated variables (removing a variable left empty), variables whose single value is inside the mount SHALL be removed, `APPIMAGE`, `APPDIR`, `ARGV0` and `OWD` SHALL be removed, and `GDK_BACKEND` SHALL be removed when it is `x11`. Outside an AppImage the shell environment SHALL be unchanged.

#### Scenario: System tools use system libraries
- **WHEN** the user runs `env | grep -i mount_` in a shell of the tiili AppImage
- **THEN** nothing is shown

#### Scenario: PATH keeps the user's entries
- **WHEN** tiili runs from an AppImage and its PATH mixes AppImage and system folders
- **THEN** the shell's PATH holds only the system folders, in their original order

#### Scenario: No change outside an AppImage
- **WHEN** tiili runs without `APPDIR` set
- **THEN** the shell's environment is the one tiili had, plus the colour variables
