## Why
A terminal keeps xterm's default 1 000 lines of scrollback, which long builds and logs overrun, and on macOS there is no way to select text while a program that reports the mouse (vim, tmux, htop) is running; Shift-drag already does this on Windows and Linux.

## What Changes
- `settings`: a "Scrollback lines" number field in Behaviour › Panes, default 10 000, range 1 000–100 000 (out-of-range values clamped, invalid values fall back to the default). It applies live to every open pane and is saved with the other settings.
- `terminal-session`: terminals are created with the saved scrollback and set `macOptionClickForcesSelection: true`, so Option-drag selects over mouse-reporting programs on macOS. Plain Option-click still moves the shell cursor; double-click selects a word and triple-click a line as before.
- Moving a pane to another window carries its serialized scrollback; a test checks that a full 100 000-line scrollback goes through the move payload (Rust `MovePayload` round trip) without being cut off.
- Direction: this card is part 3 of 3 of "terminal-find-and-links". The direction repeats the origin's scope and adds the shared constraints (all three platforms, no key conflicts). It did not change the idea.

## Outcome
- Behaviour › Panes
  - Now: `Responsive text`, `Hover`
  - After: `Responsive text`, `Hover`, `Scrollback lines` `10000`
- Option-drag over vim on macOS
  - Now: vim gets the drag, nothing is selected
  - After: the text is selected

## Assumptions
- The cap is 100 000 lines. Alternative: 50 000 or 1 000 000 (more memory per pane and a larger move payload).
- The minimum is 1 000 (xterm's own default). Alternative: allowing 0.
- The field is in Behaviour › Panes. Alternative: Style › Terminal.
- Lowering the value live drops older lines beyond the new limit (xterm's behaviour). Alternative: applying only to new panes.
