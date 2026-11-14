## Why
With many coding agents tiled side by side, nothing in tiili reacts to the terminal bell or to notification escape codes, so the user can't see which pane is waiting for them.

## What Changes
- New `pane-attention` capability: one "needs you" mark per terminal pane, raised by BEL, OSC 9 (not ConEmu `9;<n>;…`), OSC 777 `notify` and basic OSC 99, heard in xterm.js; rate-limited per pane; message text sanitised like remote text.
- Marks live in a Rust registry keyed by session, so they move with the pane between windows and are counted across windows.
- A brick at the start of `.pane-chip`, one pulse on arrival (not under reduced motion), message in the chip tooltip.
- Top-bar count of marked panes; "Next pane that needs you" on Cmd+J / Ctrl+Shift+J, oldest first, across windows.
- When tiili is not the front app: Dock badge + bounce (macOS), taskbar overlay + flash (Windows), urgency hint + launcher badge (Linux).
- Desktop notifications through tauri-plugin-notification, one per pane until cleared, summarised within ~2 s.
- Settings: Attention section on the Behaviour tab after Panes (Notify, Outside tiili, Agents); Behaviour tab still fits 720×640.

## Outcome
- Top bar with two marked panes
  - After: a brick with `2`, tooltip `2 panes need you`
- Several panes in 2 s
  - After: notification `3 panes need you`
- Single-pane notification title
  - After: `build-box:api · claude`
- Settings Agents line
  - After: `Claude Code needs one setting` with Copy for `"preferredNotifChannel": "iterm2"`

## Assumptions
- Rate limit: at most one new mark/notification per pane per 2 s, extra signals dropped (alternative: a token bucket).
- BEL and OSC 9 within 100 ms count as one signal (alternative: same parser tick only).
- Settings are stored as `attention.notify`, `attention.badge`, `attention.bounce` in the existing settings file (alternative: a separate file).
- The top-bar count is hidden at zero (alternative: show `0`).
- The Windows overlay icon is a new brick PNG under `src-tauri/icons/` (alternative: drawn at run time).
