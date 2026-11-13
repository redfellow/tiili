# Fix racing host tests in pty_session.rs

## Why
`cargo-test-host` fails on hv/main since 7e96039f677e. The two new tests `classic_prompt_applies_only_where_the_users_config_left_the_default` and `classic_zsh_keeps_the_users_history_file` both call `classic_shell("/bin/zsh", None, …)`, which builds its home and integration-scripts folders with `temp_dir`, named only from the process id and the tag `zsh-false`. Cargo runs the tests in parallel threads of one process, so each test's `temp_dir` deletes the other's folders: one test's `command_for` fails while `install` writes the scripts (panic at line 119, "zsh and bash have an integration"), and the other's zsh starts after its integration scripts were removed, so it shows macOS's default prompt instead of Classic (panic at line 165). The product code is fine.

## What Changes
- `src-tauri/tests/pty_session.rs`: give every `classic_shell` call its own folders, e.g. add a process-wide `AtomicUsize` counter to `temp_dir` (or to the tag) so names are unique per call, not only per process and shell.

## Acceptance
- Both host tests pass when the `pty_session` test file runs with its default parallel threads.

## Citations
- src-tauri/tests/pty_session.rs:91-97 (`temp_dir`), 109-119 (`classic_shell` tag)

## Assumptions
- Fix the test's folder naming instead of serialising the tests (e.g. a mutex or `--test-threads=1`); both work, unique folders keep them parallel.
