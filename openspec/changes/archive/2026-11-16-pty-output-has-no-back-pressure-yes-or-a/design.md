## Approach

Watermark flow control, as in xterm.js's flow-control guide. The pty-reader thread calls `gate.wait()` before
handing a chunk to the session sink, so when 1 MiB is unacknowledged the reader stops reading and the kernel PTY
buffer fills, which blocks the child (`yes`) naturally. The wait is outside the sink lock so `pty_detach` and
`pty_attach` never block behind it. The frontend acks from `term.write`'s callback, i.e. after xterm has parsed the
bytes, in 64 KiB batches via `pty_ack`. Closing a gate (on `forget_session`, `pty_close` via it, and
`window_destroyed`) wakes the reader so it can exit with the child. Ctrl+C still works: input goes through
`pty_write`, independent of the reader, and the drain of at most 1 MiB is quick. The dev bridge has no `ack`, so it
keeps its current behaviour.
