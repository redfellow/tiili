# Shell lifecycle: early exits, pane close escalation, stale pids

## Why
A shell that exits before `pty_spawn` returns (`tiili open -- true`) leaves its pane open, with "shell has exited" on every keystroke, and its registry entries stay behind. Closing a pane only sends SIGHUP, so a process that ignores HUP keeps running. After the shell is reaped, its pid is still signalled and inspected, and by then it may belong to an unrelated process.

## What Changes
- `src-tauri/src/lib.rs` `pty_spawn`: an `exited` AtomicBool (SeqCst) is set by the exit closure. After `SessionSinks::add` and `WindowSessions::add`, `forget_session` runs again if the flag is set.
- `src/terminal.ts` `openTerminal`: exit events that arrive while `session` is undefined go into `earlyExits`. After `spawn` resolves and after `take` sets `session = id`, an early exit marks the pane not running, calls `onSession` and then `onExit`.
- `src-tauri/src/pty.rs`: `PtySession` gets `exited: Arc<AtomicBool>`, which the waiter sets right after `child.wait()`. `pid()` returns None once it is set. Drop kills only when the shell has not exited, then drops the master. On unix it spawns a "pty-reap" thread that sends SIGKILL after `KILL_GRACE` (2 s) if the shell still has not exited.
- A host test in `src-tauri/tests/pty_session.rs` checks that a HUP-ignoring shell exits within 5 s of the drop.

## Acceptance
- `tiili open -- true` opens a pane that closes on its own.
- Dropping a session whose shell has `trap '' HUP` ends it within 5 s.
- No signal goes to a pid after its process is reaped.

## Citations
- openspec/specs/terminal-session/spec.md (shell exit closes its pane)
- openspec/specs/pane-tiling/spec.md:151 (closing a window SHALL end that window's shells)

## Assumptions
- No spec change: the specs already require this behaviour. Ruled out: a new requirement for the SIGKILL grace period.
- `KILL_GRACE` is a fixed 2 s, as the card says. Ruled out: making it a setting.
- The early-exit path in `openTerminal` is not unit tested: `terminal.ts` has no unit test harness, and the manual check covers it. Ruled out: building a new test harness for it.
