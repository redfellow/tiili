## MODIFIED Requirements

### Requirement: Branded terminal appearance
By default the terminal SHALL use the Koski theme, bundled Geist Mono at weight 100, and a blinking block (Brick) cursor. When the user chooses another theme, font or cursor in settings, the terminal SHALL use that choice instead.

#### Scenario: Follows system appearance
- **WHEN** the theme setting is System and the system switches between light and dark
- **THEN** the terminal colours switch to the matching token set
