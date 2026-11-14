## MODIFIED Requirements

### Requirement: Settings tab contents
Style SHALL hold Theme, Prompt and Terminal (Cursor, Inactive panes and, on macOS, Dock icon). Typography SHALL hold Font, with the family list beside Size, Weight, Bold weight, Line height, Letter spacing and Ligatures. Behaviour SHALL hold Tiling, Panes (Responsive text, Hover), Attention, App (Startup, Updates) and Remote shells.

#### Scenario: Behaviour tab sections
- **WHEN** the user opens the Behaviour tab
- **THEN** it shows the Tiling, Panes, Attention, App and Remote shells sections

### Requirement: Compact settings window
With default settings, no tab's panel SHALL scroll in a 720×640 settings window, including the macOS Dock icon row and the Behaviour tab's Attention section; the Remote shells snippet MAY scroll inside a fixed height. Cancel and Save SHALL stay visible at any window size, with only the panel body scrolling.

#### Scenario: Style tab fits
- **WHEN** the settings window is 720×640 on macOS with default settings and the Style tab is shown
- **THEN** its body does not scroll and Cancel and Save are visible

#### Scenario: Behaviour tab fits
- **WHEN** the settings window is 720×640 with default settings and the Behaviour tab is shown
- **THEN** its body does not scroll and Cancel and Save are visible

## ADDED Requirements

### Requirement: Attention settings
The Behaviour tab's Attention section SHALL have Notify (Messages, Messages and bells, Off; default Messages), "Badge the app icon" (default on) and Bounce/flash (Once, Until I return, Never; default Once), labelled with the Dock on macOS, the Taskbar on Windows and the Launcher on Linux, and a hint that Windows notifications only work in installed builds. Missing or invalid saved values SHALL fall back to their defaults.

#### Scenario: Invalid saved attention settings
- **WHEN** the settings file has a notify value of `"loud"`
- **THEN** Notify is Messages and the other settings load

### Requirement: Agents setting hint
The Attention section SHALL have an Agents line saying Claude Code needs one setting, with an info hint and a Copy button for `"preferredNotifChannel": "iterm2"`.

#### Scenario: Copy the Claude Code setting
- **WHEN** the user clicks the Agents Copy button
- **THEN** the clipboard holds `"preferredNotifChannel": "iterm2"`
