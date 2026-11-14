# tiili: concept

tiili is a desktop terminal that tiles its terminals automatically, so you can run many coding agents side by side
and still tell them apart. *Tiili* is Finnish for brick: each terminal is a brick, and the window is the wall.

## Why it exists

The idea comes from Waffle (waffle.baby), a native macOS terminal for running coding agents in parallel. Waffle
works for the most part, but in version 0.3.0 copy and paste do nothing: the app has no Edit menu, and ⌘C/⌘V go
through the Edit menu on macOS. The bug has been reported in its public issue tracker (`olleepalmer/waffle-releases`
issues #2 and #3) without a reply, and the app's source is not public and has no licence.

tiili is a clean-room replacement. It reproduces the ideas, not the code: nothing is decompiled, copied or
derived from Waffle's binaries, name or artwork.

## What it does

- **Auto-tiling.** Opening a terminal places it: fullscreen, then two side by side, then a 2×2 grid, then 3×3,
  and so on. No manual splitting is needed, though panes can be resized and rearranged later.
- **Colour by project.** Terminals whose working directory is in the same git repository share a colour, taken
  from the project tints in the brand palette. You can tell ten agents across three repositories apart at a glance.
- **Focus you can see.** The focused pane has a brick line on its top edge and a solid brick cursor; the others
  have an outlined cursor and dim slightly.
- **Copy and paste that work on every platform.** ⌘C/⌘V on macOS, through a real Edit menu. Ctrl+Shift+C/V on
  Windows and Linux, because plain Ctrl+C must still interrupt the running program. Right-click offers Copy and
  Paste too.
- **Native feel, small footprint.** A real application per platform, not a browser tab, and far lighter than an
  Electron app.

## Platforms

macOS, Windows and Linux from one codebase. Every feature is designed and tested for all three; platform
differences (keyboard shortcuts, menus, shells, PTY handling) are called out wherever they apply.

## Technology

| Piece | Choice | Why |
| --- | --- | --- |
| App shell | Tauri 2 (Rust core, system webview) | One codebase for all three platforms; ~10 MB downloads instead of Electron's ~150 MB |
| Terminal emulator | xterm.js | The emulator behind VS Code's terminal: selection, clipboard, search, links and GPU rendering are built in |
| PTY | `portable-pty` (Rust) | Spawns the user's shell on macOS and Linux, and uses ConPTY on Windows |
| Layout and UI | TypeScript in the webview | Tiling is layout code, simplest with CSS grid |

Considered and set aside: Electron (heavy), a fully native Rust UI with `alacritty_terminal` (fastest, but
selection, clipboard, fonts, IME and accessibility would all need to be built by hand), and Flutter (smaller
terminal ecosystem). The Rust side of the Tauri app (PTYs, git detection) would carry over to a native UI later.

## Out of scope for now

- Remote sessions (SSH) and session persistence across restarts.
- Any account, sync or telemetry.

## Brand

The visual identity is in [`brand/`](brand/README.md).
