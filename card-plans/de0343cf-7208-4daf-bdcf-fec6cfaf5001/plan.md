# Make the pty_registry host test ignore shell-integration marks

## Why
Since "Session restore (#181)" the zsh/bash integration prints an invisible `ESC ] 1337;TiiliCmd=… BEL` mark just before a command's output. `sessions_keep_their_own_size_input_and_directory` in `src-tauri/tests/pty_registry.rs` waits for `"\ntiili-N-ok"`, but the output now reads `…\u{7}tiili-0-ok`, so the match fails and `cargo-test-host` is red on hv/main. The app behaves correctly; the test is too literal.

## What Changes
- In `src-tauri/tests/pty_registry.rs`, `Outputs::text` (or a helper used by `wait_for`) strips OSC sequences (`ESC ]` up to BEL or `ESC \`) before matching, so `"\ntiili-N-ok"`, `"\n{rows} {cols}"` and the pwd checks see the visible text only.
- No product code or spec changes.

## Acceptance
`cargo test --manifest-path src-tauri/Cargo.toml --test pty_registry -- --include-ignored` passes on a host with zsh.

## Citations
- src-tauri/tests/pty_registry.rs:25 (`wait_for`), :80 (failing assert)
- src-tauri/src/shell_integration/zsh/zshrc.zsh, bash/tiili.bash (TiiliCmd mark added in 8002416)

## Assumptions
- Fix the test rather than move the mark after a newline in the integration scripts; the mark's position is part of session restore and invisible to users.
