## ADDED Requirements

### Requirement: Working app icon
While any pane is working, the running app icon SHALL show the "Hot cursor" working frames of its light or dark variant, swapping frames about every 333 ms. A pane is working while its foreground program is not its shell and it has printed output in the last 3 seconds. When the OS asks for reduced motion the icon SHALL hold frame 0. When no pane is working it SHALL show the normal icon and stop the frame timer.

#### Scenario: Script running
- **WHEN** a pane runs a script that keeps printing output
- **THEN** the app icon cycles the 8 working frames of the current variant

#### Scenario: Quiet foreground program
- **WHEN** a pane's foreground program is vim, or an agent waiting for an answer, and it has printed nothing for 3 seconds
- **THEN** the pane does not count as working and, with no other pane working, the normal icon shows

#### Scenario: Reduced motion
- **WHEN** a pane is working and the OS reduce-motion preference is on
- **THEN** the app icon shows working frame 0 and does not change frames

#### Scenario: Attention while working
- **WHEN** a pane is working and another pane marks attention while tiili is in the background
- **THEN** the badge and the bounce or flash appear as before and stay while the frames change

### Requirement: Working icon frames
The icon pipeline SHALL render 8 working frames for each of the light and dark icons from the brand SVGs, at the size of the run-time icons, using only the koivu and kalkki brand tokens for the cursor and its bloom.

#### Scenario: Frame set check
- **WHEN** the icon check runs
- **THEN** it passes only if `app-light-working-0.png` to `-7.png` and `app-dark-working-0.png` to `-7.png` exist at 512 px
