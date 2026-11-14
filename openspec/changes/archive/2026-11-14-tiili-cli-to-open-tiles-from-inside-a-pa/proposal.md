## Why

tiili has no external control surface: no socket and no argv handling. Scripts and coding agents (Claude Code and the like) running in a tiili pane cannot open tiles of their own. A small, local, token-guarded control channel plus a `tiili` command is the foundation for that.

## What Changes

- New capability **pane-control**:
  - The running app listens on a per-user local endpoint: a Unix domain socket with 0600 permissions on macOS and Linux, a named pipe on Windows. A random per-run token guards it; requests without the right token are refused.
  - Every pane's process gets `TIILI_SOCKET`, `TIILI_TOKEN` and `TIILI_PANE` in its environment, and a folder holding a `tiili` link to the app's own binary is put first on its `PATH`.
  - The main binary runs as a CLI when started with `open` or `list` (no window opens):
    - `tiili open [--cwd DIR] [--title T] -- CMD ARGS...` adds a pane to the caller's window, tiled like ⌘T, running CMD directly in DIR (default: the caller's cwd). Focus stays in the caller's pane. It prints the new pane's id.
    - `tiili list` prints the caller's window's panes, one per line: id, cwd, title.
  - When CMD exits the pane follows the existing shell-exit behaviour (it closes; the last-pane rule is unchanged).
- The request parsing and token check live in a socket-free module (like `bridge.rs`) with unit tests.

## Outcome

- Opening a tile from a pane
  - After: `$ tiili open --cwd ~/src/app -- npm run dev` prints `7` and a new pane running `npm run dev` appears in the grid.
- Listing panes
  - After: `tiili list` prints lines such as `3	/Users/red/src/app	app`.
- Outside tiili
  - After: `tiili open -- ls` run outside a tiili pane prints `tiili: not inside a tiili pane (TIILI_SOCKET is not set)` and exits 1.

## Assumptions

- `--title T` sets the pane's chip title in place of the repository-derived name until the pane closes; ruled out: ignoring the title or making it a window title.
- CMD is started directly (no shell wrapping, no shell integration prompt); ruled out: typing CMD into a new shell, which would keep the pane open after CMD exits.
- A `tiili open` from a pane whose window is closing, or with an unknown `TIILI_PANE`, fails with a message and exit code 1; ruled out: opening a new window.
- `tiili list` output is tab-separated plain text; ruled out: JSON (could be a later `--json` flag).
- The socket lives in the per-user runtime/temp folder (`$XDG_RUNTIME_DIR` or the temp dir, in a 0700 folder) and is removed when the app quits; the named pipe is created with a per-user ACL (default DACL of the current user).
- Pane ids printed are tiili's session ids (the same ids as `TIILI_PANE`).
