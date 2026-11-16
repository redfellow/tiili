## Why
In a tiili pane, ⌘←/→, ⌥←/→ and Home/End don't move the cursor in zsh. On Linux/Windows, Ctrl+←/→ only works in bash when the distro's inputrc binds it. xterm.js 6 sends nothing for ⌘+arrow and sends ESC[1;3D/C for ⌥+arrow. Stock zsh binds neither of these, and it doesn't bind Home/End either. Users expect line editing to work out of the box, as it does in iTerm2's "Natural Text Editing" preset and in Ghostty.

## What Changes
- macOS: the pane key hook sends ⌘← as `^A`, ⌘→ as `^E`, ⌥← as `ESC b`, ⌥→ as `ESC f`, ⌘⌫ as `^U` and ⌥⌫ as `^W`. The ⌃⌘arrow layout keys and the other ⌘ shortcuts don't change. Windows and Linux get no in-app translation.
- zsh integration: after the user's `.zshrc`, binds each of these keys only where the user left it unbound, in both the emacs and viins keymaps:
  - `ESC[H` and `ESC O H` to beginning-of-line
  - `ESC[F` and `ESC O F` to end-of-line
  - `ESC[1;3D` and `ESC[1;5D` to backward-word
  - `ESC[1;3C` and `ESC[1;5C` to forward-word
- bash integration: binds `ESC[1;5D/C` and `ESC[1;3D/C` to backward-/forward-word when they are unbound.
- Home/End keep sending their real escape codes, so vim, less and other full-screen programs still get them.

## Outcome
- ⌘← / ⌘→ at a zsh prompt on macOS
  - Now: nothing happens
  - After: the cursor goes to the start / end of the line
- ⌥← / ⌥→ (and Ctrl+←/→ on Linux/Windows)
  - Now: nothing happens, or `;3D` is printed
  - After: the cursor moves one word left / right
- Home / End in zsh
  - Now: nothing happens
  - After: the cursor goes to the start / end of the line

## Assumptions
- ⌥⌫ is translated to `^W` even though xterm.js may send `ESC DEL` for it. `^W` deletes the word before the cursor in both zsh and bash. The alternative was to leave xterm's output as it is.
- The translation applies only when the plain modifier is held, with no Shift and no other modifier. Shift-selection variants pass through unchanged.
- pwsh/cmd get no changes: PSReadLine already handles Ctrl+arrow and Home/End through ConPTY. This is listed as a manual check.
- The translation applies whatever xterm's macOptionIsMeta setting is.
