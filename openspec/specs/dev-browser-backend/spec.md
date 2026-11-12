# dev-browser-backend Specification

## Purpose
A real shell in tiili's terminal when the frontend runs in a plain browser from the dev server: a local, dev-only WebSocket bridge to tiili's own PTY code, so the browser preview (and Design) can demo a working terminal.

## Requirements

### Requirement: Browser dev server runs a real shell
When the frontend runs in a plain browser from the dev server, the terminal SHALL connect over a WebSocket to a dev-only bridge that runs the user's default shell through tiili's own PTY code, with typing, resize, exit and restart on Enter working as in the app. In the Tauri app the terminal SHALL keep using the Tauri commands.

#### Scenario: Backend selection
- **WHEN** the page loads with `__TAURI_INTERNALS__` on `window`
- **THEN** the Tauri backend is used, and otherwise the WebSocket backend

#### Scenario: Shell in the browser
- **WHEN** the user types `echo hi` and Enter in the browser preview
- **THEN** the shell's output `hi` is shown

#### Scenario: Exit and restart
- **WHEN** the shell exits in the browser preview and the user presses Enter
- **THEN** the exit message is shown and a new shell starts

### Requirement: Bridge is local, tokened and dev-only
The bridge SHALL listen on 127.0.0.1 only, SHALL refuse a connection without the per-run token the dev server gives the page, SHALL end the shell when its connection closes, and SHALL NOT be part of `npm run build` or the app bundle.

#### Scenario: Wrong token
- **WHEN** a WebSocket connects to `/pty` with a missing or wrong token
- **THEN** the bridge refuses the handshake and starts no shell

### Requirement: Browser copy and paste
In the browser preview copy and paste SHALL use the browser clipboard with the same shortcuts as the app, and right-click SHALL show an HTML menu with Copy and Paste.

#### Scenario: Right-click menu
- **WHEN** the user right-clicks the terminal in the browser preview and chooses Paste
- **THEN** the clipboard text is pasted into the shell

### Requirement: Bridge reports a shell it cannot start
When the dev bridge accepts a connection but cannot open a pseudo-terminal or start the shell, it SHALL send the page an error message with the reason and close the connection. The browser terminal SHALL show one line, `The dev bridge could not open a shell: <reason>`, and the rest of the interface SHALL stay usable. When the shell starts, the bridge SHALL tell the page it is ready.

#### Scenario: No pseudo-terminal available
- **WHEN** the bridge's attempt to open a PTY fails with a reason
- **THEN** the terminal shows `The dev bridge could not open a shell: <reason>` and no shell runs

#### Scenario: Shell starts
- **WHEN** the bridge starts the shell
- **THEN** it sends a ready message, and the terminal runs the user's shell
