## MODIFIED Requirements

### Requirement: Font family list
The family SHALL be chosen from a keyboard-navigable list with a Bundled group (Geist Mono, Victor Mono, Commit Mono, Recursive Mono, Cascadia Code) and an OS group (the fixed-width fonts installed on the machine), and moving through it SHALL apply the font at once; a missing font SHALL fall back to Geist Mono. Nerd Font icon codepoints that the chosen font and Geist Mono lack SHALL be drawn from a bundled Symbols Nerd Font Mono limited to icon ranges, so it never replaces the chosen font's letters or icons.

#### Scenario: Unavailable font
- **WHEN** the saved font family is not installed
- **THEN** the terminal uses Geist Mono

#### Scenario: Arrowing previews fonts
- **WHEN** the family list has focus on Geist Mono and the user presses the Down arrow
- **THEN** Victor Mono is selected and the terminal uses it at once

#### Scenario: Nerd Font icons without a Nerd Font
- **WHEN** a pane prints U+F0219 while the chosen font is a bundled font
- **THEN** the icon is drawn from the bundled symbols font, one cell wide, not as a missing-glyph box

#### Scenario: Picked Nerd Font keeps its icons
- **WHEN** the chosen font is an installed Nerd Font and a pane prints a private-use icon
- **THEN** the icon is drawn from the chosen font
