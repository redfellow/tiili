## Why

The PTY reader forwards output as fast as the shell produces it and the frontend never acknowledges it. `yes` or a
huge `cat` grows the IPC queue and xterm's write buffer without bound; at 50 MB pending xterm throws "write data
discarded, use flow control" and output is lost.

## What Changes

- `src-tauri/src/sink.rs`: `FlowGate` (unacked byte count, `FLOW_HIGH = 1 MiB`, condvar wait, ack, close) and a
  managed `FlowGates` map keyed by session.
- `src-tauri/src/lib.rs`: `pty_spawn` waits on the gate (outside the sink lock) before each chunk and counts it as
  sent; new `pty_ack` command; gates are removed and closed in `forget_session` and `window_destroyed`.
- Frontend: `Backend.ack?` (Tauri only, fire-and-forget); `PaneTerminal.output(bytes)` writes to xterm and acks every
  64 KiB once xterm has parsed them; spawn and every attach path use it.
- The dev WebSocket bridge is unchanged.

## Outcome

- Running `yes` in a pane
  - Now: memory grows without bound and the console shows `write data discarded, use flow control`
  - After: memory stays flat, Ctrl+C stops it within a second, no output is discarded

## Assumptions

- Acks are batched at 64 KiB in the frontend; ruled out: acking every chunk.
- Bytes buffered while a pane is detached count against the gate and are acked by the window that attaches; ruled
  out: exempting detached output.
- No new unit test in the frontend for the ack batching; the Rust gate is unit-tested; ruled out: mocking xterm.
