# Tasks

- [x] 1.1 pty.rs: add the `exited` flag (set by the waiter), make `pid()` return None after exit, and make Drop kill only while running, then drop the master and, on unix, SIGKILL from a "pty-reap" thread after `KILL_GRACE`. Add the host test (`sh -c "trap '' HUP; sleep 30"`, drop the session, on_exit fires within 5 s), tagged `#[ignore = "host: ..."]`.
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test pty_session -- -D warnings`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session --test pty_registry`
- [x] 1.2 lib.rs `pty_spawn`: add the `exited` AtomicBool, set it in the exit closure before `forget_session`, and call `forget_session` again after the two `add` calls if it is set.
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [x] 2.1 terminal.ts `openTerminal`: add the `earlyExits` set, and handle it after `spawn` resolves and after `take` sets `session = id`.
  - proof: `npx eslint src/terminal.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- From a tiili pane, run `tiili open -- true`: the new pane opens and closes on its own.
- Run `tiili open -- sh -c "trap '' HUP; sleep 300"`, close that pane, and check with `ps` that the sleep is gone within about 2 s.
- Run `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session --test pty_registry -- --include-ignored` on the host.
