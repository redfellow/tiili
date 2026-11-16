## Approach
- `src/keymap.ts`: add a pure function `lineEditInput(event: KeyChord, platform: Platform): string | null`. It returns the bytes to send for ⌘/⌥ + ArrowLeft/ArrowRight/Backspace on macOS, and null for any other key or platform. It requires exactly one of metaKey or altKey, with no ctrl or shift, so ⌃⌘arrow (the layout keys) is untouched.
- `src/panes.ts` `onKey`: after `shortcut()` and before the clipboard handling, if `lineEditInput` returns bytes, then on keydown call `preventDefault` and write the bytes to the pane's PTY, using the same path xterm's `onData` uses. Return false so xterm doesn't send its own sequence. This applies to keyup too, so the key never leaks to xterm.
- zsh (`zshrc.zsh`): a loop over the `emacs` and `viins` keymaps and a seq→widget table. It runs `bindkey -M $map $seq $widget` only when `bindkey -M $map $seq` reports `undefined-key`, or no binding at all. It runs after the user's `.zshrc` is sourced.
- bash (`tiili.bash`): for each seq, call `bind '"seq": widget'` only when `bind -q`/`bind -p` shows no binding for it. Do this only in an interactive shell with line editing on.
- Home/End are not translated in the app: the shell bindings handle them, and full-screen programs keep getting the real codes.

## Why not translate everything in the app
Translating Home/End or Ctrl+arrow in the app would break vim, less and other programs that read those keys. Bindings in the shell only affect the prompt.
