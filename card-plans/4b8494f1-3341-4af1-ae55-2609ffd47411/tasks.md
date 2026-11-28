# Tasks

## 1. Specs pass strict validation

- [ ] 1.1 Shorten settings "Settings tab contents", "Prompt choice" and "Prompt list" to at most 500 characters each,
  moving the removed sentences into scenarios with the same words (for example the Integrations "EXPERIMENTAL" tag,
  the "DEFAULT" tag and wrong-typed values loading as Default, and the Prompt info hint). Keep every existing scenario
  name.
  - proof: `openspec validate settings --type spec --strict --no-interactive`
- [ ] 1.2 Shorten terminal-session "Prompt shell integration" to at most 500 characters the same way (for example
  move "Other shells SHALL start with the same program and arguments" into a scenario). Change the "Folder reported
  at every prompt" THEN clause to "the chosen prompt and the user's existing prompt hooks still run".
  - proof: `openspec validate terminal-session --type spec --strict --no-interactive`
  - proof: `openspec validate --all --strict --no-interactive`

## 2. Stale OSC 7 host test

- [ ] 2.1 In `src-tauri/tests/pty_session.rs`, make `folder_reported_at_every_prompt_zsh_and_bash_send_osc7` wait for
  Classic's `\x1b[39m@\x1b[32m` (the `CLASSIC` const) in the case with its own prompt and hook, instead of `mine`. It
  then still requires OSC 7 for `/tmp` and `hook:/tmp`. Drop the unused `mine` column and update the doc comment and
  the assert message.
  Tests to update: src-tauri/tests/pty_session.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test pty_session -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)

- If cargo-test-host fails again with "failed to openpty … Device not configured", the machine has run out of
  pseudo-terminals. Close idle terminals (or raise `kern.tty.ptmx_max`) and run the check again.
