## Why

tiili has no code yet. Everything later (tiling, repository colours, settings) needs an app skeleton: one window, one working terminal, on macOS, Windows and Linux. Copy and paste must work from day one: the app tiili replaces (docs/concept.md) shipped with no Edit menu, so ⌘C/⌘V did nothing.

## What Changes

- Tauri 2 app: Rust core in `src-tauri/`, TypeScript frontend built with Vite, npm as package manager.
- One window titled `tiili` with one xterm.js terminal connected to the user's default shell through `portable-pty` (ConPTY on Windows). Typing, output, resize (rows/columns sent to the PTY) and shell exit (plain message plus an offer to start a new shell).
- Copy and paste: macOS Edit menu (Copy ⌘C, Paste ⌘V, Select All ⌘A); Ctrl+Shift+C/V on Windows and Linux with plain Ctrl+C still going to the shell; right-click Copy/Paste everywhere. The key mapping is a pure, unit-tested function.
- Brand basics: tokens from `docs/brand/tiili.css`; terminal theme follows the system setting (koski + dark ANSI, kalkki + light ANSI); bundled Geist Mono; block cursor `#A4472B`; icons generated from `docs/brand/logo/icon-light.svg`.
- Tooling: `tsc --noEmit`, ESLint, Vitest, `cargo fmt --check`, `cargo clippy`, `cargo test`. `.harvaaja/checks.yaml`, `.harvaaja/network.yaml` and the "Current state" of `.harvaaja/instructions/plan.md` and `build.md` updated (triage, human-only paths).
- New specs: `terminal-session`, `clipboard`.

## Outcome

- Launching the app
  - After: a window titled `tiili` showing the user's shell prompt in Geist Mono with a brick block cursor.
- Shell exits
  - After: `[process exited] Press Enter to start a new shell`
- macOS menu bar
  - After: an `Edit` menu with `Copy ⌘C`, `Paste ⌘V`, `Select All ⌘A`.
- Right-click in the terminal
  - After: a menu with `Copy` and `Paste`.

## Assumptions

- The brand docs are on `origin/main` (commit d64fcfc) but not yet in this worktree; the build merges `origin/main` first. Ruled out: copying them in.
- Exit offer is "press Enter to start a new shell" in the terminal itself; ruled out a separate button overlay.
- Right-click menu is a native Tauri context menu; ruled out an HTML-drawn menu.
- Copy with no selection does nothing (no fallthrough to the shell for Ctrl+Shift+C); ruled out sending the key.
- Default shell: `$SHELL` (fallback `/bin/sh`) on macOS/Linux, `%COMSPEC%` (fallback `powershell.exe`) on Windows, via `portable-pty`'s `CommandBuilder::new_default_prog`; ruled out a shell setting (settings are out of scope).
- Geist Mono is vendored as woff2 from its OFL release with its licence file; ruled out an npm font package fetched at build.
- Out of scope: tiling and panes, git colouring, focus brick line, settings, packaging and signing.
