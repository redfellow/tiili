## Approach
xterm.js already turns the blink class off when it thinks the pane has no focus, but the cursor in unfocused panes still blinks. So the rule is made explicit: in `openTerminal` (`src/terminal.ts`), listen for focus and blur on the terminal's textarea (`term.textarea`). On blur, set `term.options.cursorBlink = false`. On focus, set it to `settings().cursor.blink`. `applyTerminalSettings` sets `cursorBlink` only while the terminal has focus (check `container.contains(document.activeElement)` or keep a focused flag), so a settings change can't make a pane without focus blink again. Remove the listeners when the terminal is disposed.

A setting in the terminal itself is cheaper and more reliable than overriding the cursor animation in CSS.
