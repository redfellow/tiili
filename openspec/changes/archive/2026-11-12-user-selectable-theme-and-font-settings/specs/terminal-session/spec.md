## MODIFIED Requirements

### Requirement: Branded terminal appearance
By default the terminal SHALL use the tiili design tokens: koski background and dark ANSI set in dark mode, kalkki and light ANSI set in light mode, following the system setting; bundled Geist Mono; a block cursor in `#A4472B`. When the user chooses another theme or font in settings, the terminal SHALL use that choice instead.

#### Scenario: Follows system appearance
- **WHEN** the theme setting is System and the system switches between light and dark
- **THEN** the terminal colours switch to the matching token set
