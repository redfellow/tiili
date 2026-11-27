# Fix failing checks: cargo-fmt & cargo-clippy

## Why

The base branch hv/main fails `cargo-fmt` and `cargo-clippy` since the merge f31430a39922: `src-tauri/src/launch.rs`
is not rustfmt-formatted (the `find_map` chain in `launch_action` and four focus-pane test cases), and clippy's
`manual_contains` lint rejects `args.iter().any(|arg| *arg == NEW_WINDOW_ARG)` at line 32. Auto merges wait on this.

## What Changes

- Run rustfmt on `src-tauri/src/launch.rs` so `cargo fmt --check` passes.
- Replace `args.iter().any(|arg| *arg == NEW_WINDOW_ARG)` with `args.contains(&NEW_WINDOW_ARG)` (same result).

No behaviour change; nothing the user sees changes.

## Acceptance

- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` reports no diff.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings` passes.
- The launch-action table test in `src-tauri/src/launch.rs` still passes.

## Citations

- `src-tauri/src/launch.rs:24-36` (the code both checks flag).
- `openspec/specs/app-launch/spec.md` (behaviour stays as specified).

## Assumptions

- Take clippy's suggested `contains` rewrite rather than an `#[allow(clippy::manual_contains)]`.
