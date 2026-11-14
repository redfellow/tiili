## Why

Every tiili window is titled plain `tiili`, so in the alt-tab switcher, Mission Control and the taskbar the windows
look the same and tell nothing about what runs in them. Reijo asked for `tiili >_`, the active terminal's title, or
both; he chose both.

## What Changes

- Each window's title becomes the focused pane's title followed by ` — tiili >_`, or just `tiili >_` when the focused
  pane has no title (a Heynote pane, or before the shell reports one).
- The pane's title is the command tiili already follows for the chip: the title a program sets (OSC 0/2), else the
  foreground process name.
- The title follows focus moves, title changes, pane close and pane moves between windows.
- The initial window title in `tauri.conf.json` and new windows' title become `tiili >_`.

## Outcome

- A window running vim
  - Now: `tiili`
  - After: `vim README.md — tiili >_`
- A window whose focused pane has no title yet
  - Now: `tiili`
  - After: `tiili >_`

## Assumptions

- The separator is ` — ` (em dash, macOS convention), not ` - ` or `·`.
- The "terminal title" is the pane's followed command (OSC title else process name), not only OSC titles; this
  matches what the chip shows, rather than leaving the title blank while a bare shell runs.
- The repository chip text is not included, keeping titles short.
