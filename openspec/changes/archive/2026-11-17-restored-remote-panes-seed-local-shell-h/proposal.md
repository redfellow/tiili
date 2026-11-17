## Why

A remote pane's recorded command comes from the TiiliCmd marker, which any PTY output can print, including a remote host over SSH. On restore, `paneRestore` (src/session.ts) seeds the local shell's history with it, so one Up and Enter runs locally a command the remote host chose, while the restore line only says `was connected to <host>`.

## What Changes

- `paneRestore` sets no history when the pane has a host.
- The session-restore requirement states that remote panes never seed history.

## Outcome

- Restored SSH pane, pressing Up
  - Now: the command the remote side reported appears on the local prompt
  - After: Up shows the local shell's own previous history entry

## Assumptions

- The optional control-character/newline filter on recorded commands is left out; the host check is the fix (ruled out: adding the filter in this change).
