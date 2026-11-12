## Why
Design view cannot start tiili's browser preview. Its worktree never gets `node_modules`, so Vite is missing. Design servers always run sandboxed, and the sandbox refuses `openpty`. Once Vite starts, the dev bridge fails to spawn the shell, and the terminal is left on a dead socket with no explanation.

## What Changes
- Propose (triage) a `design-prepare` check in `.harvaaja/checks.yaml`. It runs `npm ci` and builds the `dev-bridge` binary before the design server starts, which also takes the cargo compile out of the server's startup.
- When the bridge cannot open a PTY, it sends `{"type":"error","message":"<reason>"}` and closes. When the shell starts, it sends `{"type":"ready"}`.
- The browser backend resolves `spawn` on `ready` and rejects on `error` with `The dev bridge could not open a shell: <reason>`. The terminal shows that line, and the rest of the UI stays usable.

## Outcome
- Terminal pane in the sandboxed Design preview
  - Now: blank terminal, socket open but no shell
  - After: `The dev bridge could not open a shell: <reason>`

## Assumptions
- The PTY opt-in for the design entry is left until the Härvääjä card lands, as the card says. It is not part of this change.
- Pressing Enter after the error retries the spawn, as the existing restart path already does. The alternative was to block retries.
- The bridge gets an explicit `ready` message rather than the backend treating any first output as success. That keeps the promise contract exact.
