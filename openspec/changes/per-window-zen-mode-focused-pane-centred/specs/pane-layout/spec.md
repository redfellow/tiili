## ADDED Requirements

### Requirement: Zen edge drag
Either side edge of the Zen pane SHALL be draggable; the drag SHALL move both edges symmetrically, keep the pane centred, stay between 80 columns and 90% of the pane area, hold the terminal size during the drag and send one resize when it ends. The resulting width SHALL become the Zen width setting.

#### Scenario: Drag widens
- **WHEN** the user drags the right edge of the Zen pane outward and releases
- **THEN** both edges moved, the shell got one resize, and the Zen width setting holds the new column count

### Requirement: Layout actions leave Zen
Layout keys, the reset shortcut and the Reset layout button SHALL first leave Zen and then perform their action. Pane drag and swap SHALL do nothing while Zen is on.

#### Scenario: Reset in Zen
- **WHEN** Zen is on and the user presses ⌃⌘0
- **THEN** the grid returns and its layout is reset
