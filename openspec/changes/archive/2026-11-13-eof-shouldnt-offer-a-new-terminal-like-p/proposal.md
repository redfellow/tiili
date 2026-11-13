## Why
When the shell exits (e.g. Ctrl+D / `exit`), tiili shows `[process exited] Press Enter to start a new shell`. Reijo wants an exited shell to go away like any terminal: close its pane, and close the app when it was the last one.

## What Changes
- When a pane's shell exits, the pane closes the same way the close shortcut closes it (layout re-flows, focus moves).
- When that was the last pane, the window closes, which quits the app (existing "Last pane closed" behaviour).
- The exit message and the press-Enter restart go away.

## Outcome
- Shell exits
  - Now: `[process exited] Press Enter to start a new shell`
  - After: the pane closes; with no pane left, the app closes

## Assumptions
- Any shell exit closes the pane, whatever its exit status (ruled out: keep the message for a non-zero exit).
- A Heynote pane counts as a pane: if one is still open, the exiting terminal's pane closes and the window stays (ruled out: quitting when no terminal remains).
- If spawning the shell fails, the error is still written in the terminal as today (ruled out: closing on spawn errors).
