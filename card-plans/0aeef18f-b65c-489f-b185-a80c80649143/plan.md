# Fix the repo_tracking host test race

## Why
`cargo-test-host` fails on hv/main in `change_directory_into_a_repository_tracked_root_follows`: after the final
`cd` back into `alpha`, the report says `repo: None`. Both tests in `src-tauri/tests/repo_tracking.rs` build their
folders under the same `tiili-repo-tracking-<pid>/` parent (cargo runs them in parallel in one process), and each
ends with `remove_dir_all(<that parent>)`. `exit_ssh_on_macos_or_linux_pane_is_local_again` finishes first and
deletes `alpha/.git` while the other test is still running, so `alpha` is no longer a repository. #98 changed no
cwd/repo code; it only changed timing enough for the race to land.

## What Changes
- `temp_dir` in `src-tauri/tests/repo_tracking.rs` takes the test's own parent name (e.g. a per-test tag) so each
  test gets its own `tiili-repo-tracking-<pid>-<test>/` folder, and each test removes only its own parent.
- No app code or spec changes.

## Acceptance
- `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking -- --ignored` passes on the host, both tests
  run in parallel.
- fmt and clippy clean.

## Citations
- src-tauri/tests/repo_tracking.rs:16-22 (shared parent), :100 and :147 (each removes the parent).

## Assumptions
- Fix by isolating folders rather than serialising the tests (`--test-threads=1`), which would hide the shared state.
