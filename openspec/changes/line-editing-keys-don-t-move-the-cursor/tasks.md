## 1. macOS key translation

- [ ] 1.1 Add `lineEditInput` to `src/keymap.ts`, with one table-driven case list in `src/keymap.test.ts` named after the scenarios "Command and Option arrows edit the line" and "Layout keys and other platforms untouched". The list covers each of the six macOS keys and its bytes, ⌃⌘←, ⇧⌘←, ⇧⌥←, plain ←, and Ctrl+←/Alt+← on Windows and Linux returning null.
  - proof: `npx vitest run src/keymap.test.ts`
  - proof: `npx eslint src/keymap.ts src/keymap.test.ts`
- [ ] 1.2 In `src/panes.ts` `onKey`, after `shortcut()`: when `lineEditInput` returns bytes, then on keydown call preventDefault and write the bytes to the pane's PTY the way the pane's `onData` does, and return false for that key's keydown and keyup.
  - proof: `npx eslint src/panes.ts`
  - proof: `npm run typecheck`

## 2. Shell bindings

- [ ] 2.1 In `src-tauri/src/shell_integration/zsh/zshrc.zsh`, after the user's `.zshrc` is sourced, bind the eight sequences in the emacs and viins keymaps, but only where `bindkey -M <map> <seq>` shows no binding or `undefined-key`.
  - proof: `zsh -n src-tauri/src/shell_integration/zsh/zshrc.zsh`
- [ ] 2.2 In `src-tauri/src/shell_integration/bash/tiili.bash`, bind `\e[1;5D`/`\e[1;3D` to backward-word and `\e[1;5C`/`\e[1;3C` to forward-word, only when they are unbound and line editing is on.
  - proof: `bash -n src-tauri/src/shell_integration/bash/tiili.bash`
- [ ] 2.3 Add a test to `src-tauri/tests/pty_session.rs`. It starts the integrated zsh and bash through `classic_shell`, once with a config that binds `^[[1;5D` itself and once without, and checks the `bindkey`/`bind -p` output against the "Home and word keys work in default zsh", "User's own binding wins" and "Default bash gets word moves" scenarios. It skips where the shell is missing, as the existing tests do.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test pty_session -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)

- macOS, new pane in zsh: ⌘←/→ jump to the start/end of the line, ⌥←/→ move by a word, Home/End jump, ⌘⌫ deletes to the start, ⌥⌫ deletes the previous word. ⌃⌘arrows still move panes.
- In vim and less, Home/End and the arrows still work.
- Linux: Ctrl+←/→ and Home/End work in zsh and bash.
- Windows: Ctrl+←/→ and Home/End work in pwsh (PSReadLine).
