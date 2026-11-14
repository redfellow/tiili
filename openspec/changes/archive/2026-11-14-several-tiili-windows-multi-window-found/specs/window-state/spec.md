## MODIFIED Requirements

### Requirement: Window state persists between launches
tiili SHALL open its main window at the size, position and maximised/fullscreen state it had when it was last closed, on macOS, Windows and Linux. Relaunching SHALL open only the main window; other windows SHALL NOT be reopened and their size and place SHALL NOT be saved as the main window's.

#### Scenario: Resized window reopens at the same size and place
- **WHEN** the user resizes the window to 1280×720, moves it, quits and relaunches tiili
- **THEN** the window opens at 1280×720 in the same place

#### Scenario: Maximised window reopens maximised
- **WHEN** the user quits tiili while the window is maximised or fullscreen
- **THEN** the window opens maximised or fullscreen on relaunch

#### Scenario: Extra windows are not remembered
- **WHEN** the user opens a second window, resizes it, quits and relaunches tiili
- **THEN** only the main window opens, at the main window's own saved size and place
