## Approach
- `src/keymap.ts`: add `zoomAction(event, platform): "in" | "out" | "reset" | null`. macOS needs ⌘ alone (Shift allowed for `+`); others Ctrl alone (Shift allowed). Keys: `=`/`+`/`Equal`/`NumpadAdd` → in, `-`/`Minus`/`NumpadSubtract` → out, `0`/`Digit0`/`Numpad0` → reset. Must not clash with `layoutAction` (⌃⌘0, Ctrl+Alt+Shift+0), which already needs extra modifiers.
- `src/panes.ts` `shortcut()`: on keydown for a terminal pane, adjust a per-pane `zoom` offset (number, default 0), clamp so the size stays in 6–48, then re-apply size and refit. Return true so the key is kept from the shell. Heynote panes return false.
- `src/terminal.ts` `applySize`: accept the pane's zoom offset and add it to `font.size` before `responsiveFont`.
Why: keymap mappings are already pure and table-tested; the offset rides the existing fit path, so PTY resizing comes for free.
