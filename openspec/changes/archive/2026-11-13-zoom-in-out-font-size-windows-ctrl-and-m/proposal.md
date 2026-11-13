## Why
Reijo wants to zoom a terminal's text with the usual keys: Ctrl + and Ctrl − on Windows (and Linux), ⌘+ and ⌘− on macOS.

## What Changes
- New per-pane zoom shortcuts: ⌘= / ⌘+ and ⌘− on macOS, Ctrl+= / Ctrl++ and Ctrl+− on Windows and Linux, step the **focused pane's** font size up or down by 1 px; ⌘0 / Ctrl+0 resets that pane to the Settings size.
- Zoom is temporary: it lives with the pane, is not saved and does not change the Settings font size. A new pane starts at the Settings size.
- The keys are kept from the shell; the pane's PTY is refitted after each step.

## Outcome
- Zooming the focused pane
  - After: `⌘+ / Ctrl++ makes the focused pane's text 1 px larger; ⌘− / Ctrl+− 1 px smaller; ⌘0 / Ctrl+0 back to the Settings size`

## Assumptions
- Step is 1 px, clamped to 6–48 px (ruled out: percentage steps like browsers).
- The zoom offset is added to the Settings size before responsive text shrinks a small pane, so a zoomed small pane still shrinks (ruled out: zoom overriding responsive text).
- Heynote panes are not zoomed; the keys pass to Heynote there (ruled out: zooming Heynote too).
- Ctrl+− on Windows/Linux is taken from the shell, which loses readline's rarely used Ctrl+− undo; Ctrl+0 likewise (ruled out: Ctrl+Shift variants, since the card names plain Ctrl).
- Settings changes keep each pane's zoom offset (ruled out: resetting zoom on save).
