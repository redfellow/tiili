## 1. Still cursor in panes without focus

- [x] 1.1 In `src/terminal.ts`, turn `cursorBlink` off when the terminal loses focus and restore `settings().cursor.blink` when it gains focus. Have `applyTerminalSettings` set blink only while the terminal has focus. Update the `openTerminal` doc comment.
  - proof: `npx eslint src/terminal.ts`
  - proof: `npm run typecheck`
- [x] 1.2 Validate the spec delta
  - proof: `openspec validate static-non-blinking-cursor-in-unfocu-2 --strict`

## Manual checks after merge (The user)
- With Blink on and two panes, focus one: the other pane's outlined cursor stays still and the focused one blinks. Switch focus: they swap.
- Turn Blink off and on in settings while two panes are open: only the focused pane's cursor ever blinks.
