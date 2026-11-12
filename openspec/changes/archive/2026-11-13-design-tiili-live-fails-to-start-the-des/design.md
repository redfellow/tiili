## Approach
- `bridge.rs`: add `ready_message()` and `error_message(reason)`. They are pure and table-tested next to `exit_message`.
- `dev-bridge.rs`: if `PtySession::spawn` fails, send the error message, close and flush, then return `Ok(())`. If it succeeds, send `ready` before the read loop. Output can still reach the socket before `ready`, so the page buffers nothing: it treats binary output as usual.
- `backend-ws.ts`: `ServerMessage` gains `ready` and `error`. `spawn` registers the session on open but resolves only on `ready`. On `error` it rejects with `Error("The dev bridge could not open a shell: " + message)`. `terminal.ts` already writes rejected spawns as one line (`reportError`), so it does not change.
- Design preparation lives in a manual `design-prepare` check, because hv runs that role in the design worktree with network allowed. Agents cannot edit `.harvaaja/`, so it is a triage task.
