## ADDED Requirements

### Requirement: Running macOS icon matches the Dock grid
On macOS, every icon tiili sets at run time (light, dark and working frames) SHALL be drawn with the tile inset to Apple's app icon grid: 824/1024 of the canvas, centred, on a transparent margin. That way the running icon is the same size as other apps' icons in the Dock. On other platforms the run-time icon SHALL stay full-bleed.

#### Scenario: Running icon size in the Dock
- **WHEN** tiili is running on macOS and shows its normal or working icon
- **THEN** its tile in the Dock is the same size as the neighbouring app icons

#### Scenario: Inset geometry
- **WHEN** the inset rectangle is computed for a canvas of 1024 px
- **THEN** it is 824 px square at offset 100 px on both axes
