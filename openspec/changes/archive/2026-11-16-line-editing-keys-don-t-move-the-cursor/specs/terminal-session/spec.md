## ADDED Requirements

### Requirement: macOS line-editing keys
On macOS, a terminal pane SHALL send ⌘← as `^A`, ⌘→ as `^E`, ⌥← as `ESC b`, ⌥→ as `ESC f`, ⌘⌫ as `^U` and ⌥⌫ as `^W` to its shell, instead of what xterm.js would send. Keys with any other modifiers, the layout and app shortcuts, and every key on Windows and Linux SHALL pass through unchanged.

#### Scenario: Command and Option arrows edit the line
- **WHEN** the user presses ⌘←, ⌘→, ⌥←, ⌥→, ⌘⌫ or ⌥⌫ in a macOS pane
- **THEN** the shell receives `^A`, `^E`, `ESC b`, `ESC f`, `^U` or `^W` respectively

#### Scenario: Layout keys and other platforms untouched
- **WHEN** the user presses ⌃⌘← on macOS, or Ctrl+← on Windows or Linux
- **THEN** no line-editing translation happens

### Requirement: Shell line-editing bindings
The zsh integration SHALL bind `ESC[H` and `ESC O H` to beginning-of-line, `ESC[F` and `ESC O F` to end-of-line, `ESC[1;3D` and `ESC[1;5D` to backward-word, and `ESC[1;3C` and `ESC[1;5C` to forward-word, in the emacs and viins keymaps. The bash integration SHALL bind the same four word-move sequences. Both SHALL only bind keys the user's own config left unbound. Home and End SHALL still reach programs as their escape codes.

#### Scenario: Home and word keys work in default zsh
- **WHEN** an integrated zsh whose config binds none of these keys starts
- **THEN** `bindkey` maps `^[[H` to beginning-of-line and `^[[1;5D` to backward-word

#### Scenario: User's own binding wins
- **WHEN** the user's `.zshrc` or `.bashrc` binds `^[[1;5D` to another widget
- **THEN** that binding stays

#### Scenario: Default bash gets word moves
- **WHEN** an integrated bash whose config binds no Ctrl/Alt arrows starts
- **THEN** `^[[1;5C` and `^[[1;3C` are bound to forward-word
