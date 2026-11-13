## REMOVED Requirements

### Requirement: Browser dev server runs a real shell
**Reason**: An exited shell now closes its pane instead of restarting on Enter, so the requirement is restated without restart.
**Migration**: See "Browser dev server runs a real shell that closes on exit".

## ADDED Requirements

### Requirement: Browser dev server runs a real shell that closes on exit
When the frontend runs in a plain browser from the dev server, the terminal SHALL connect over a WebSocket to a dev-only bridge that runs the user's default shell through tiili's own PTY code, with typing, resize and exit working as in the app. In the Tauri app the terminal SHALL keep using the Tauri commands.

#### Scenario: Backend selection
- **WHEN** the page loads with `__TAURI_INTERNALS__` on `window`
- **THEN** the Tauri backend is used, and otherwise the WebSocket backend

#### Scenario: Shell in the browser
- **WHEN** the user types `echo hi` and Enter in the browser preview
- **THEN** the shell's output `hi` is shown

#### Scenario: Exit closes the pane
- **WHEN** the shell exits in the browser preview
- **THEN** its pane closes, as in the app
