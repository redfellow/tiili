# window-state Specification

## Purpose
How tiili's main window keeps its size, position and maximised or fullscreen state between launches.

## Requirements

### Requirement: Default when no usable saved state
When there is no saved state, or a window's saved position is off every connected screen, tiili SHALL open that window at 900×600 centred on the main screen.

#### Scenario: Monitor unplugged
- **WHEN** the window was last closed on a monitor that is no longer connected
- **THEN** tiili opens the window at 900×600 centred on the main screen

### Requirement: Every window keeps its state between launches
tiili SHALL reopen each restored window at the size, position and maximised/fullscreen state it had when the app last ended, on macOS, Windows and Linux. Each window SHALL keep its own size and place.

#### Scenario: Resized window reopens at the same size and place
- **WHEN** the user resizes the window to 1280×720, moves it, quits and relaunches tiili
- **THEN** the window opens at 1280×720 in the same place

#### Scenario: Maximised window reopens maximised
- **WHEN** the user quits tiili while the window is maximised or fullscreen
- **THEN** the window opens maximised or fullscreen on relaunch

#### Scenario: Extra windows keep their own place
- **WHEN** the user opens a second window, resizes it, quits and relaunches tiili
- **THEN** both windows open, each at its own saved size and place
