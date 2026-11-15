## ADDED Requirements

### Requirement: Heynote follows tiili's light or dark
While Heynote's theme is left at its default, Heynote SHALL use dark mode under a dark tiili theme and light mode under a light one, with tiili's System theme following the OS, and SHALL change live when tiili's theme changes. A theme chosen inside Heynote SHALL take precedence.

#### Scenario: Dark tiili theme
- **WHEN** tiili's theme is Koski, the OS is light, and the user opens a Heynote pane
- **THEN** Heynote shows in its dark mode

#### Scenario: Heynote choice kept
- **WHEN** the user chose Light inside Heynote and tiili's theme is dark
- **THEN** Heynote stays light

### Requirement: Heynote opens without a flash
A Heynote pane SHALL show the background of the mode Heynote starts in from its first frame until Heynote has painted, and SHALL never show a white or light ground while opening in dark mode.

#### Scenario: Open in dark
- **WHEN** tiili's theme is dark and the user opens a Heynote pane
- **THEN** the pane is dark throughout opening
