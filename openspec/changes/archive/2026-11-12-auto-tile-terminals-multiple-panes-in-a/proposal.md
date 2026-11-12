## Why

tiili exists to run many terminals side by side without manual splitting (docs/concept.md, "Auto-tiling"). The scaffold gives one window with one terminal; this change adds several panes that tile themselves, with the focus states from docs/brand/README.md.

## What Changes

- Several terminals in one window, each with its own PTY session (Rust session registry keyed by id).
- Automatic grid: columns = ceil(sqrt(n)), rows = ceil(n / columns); 1 fills, 2 side by side, 3–4 a 2×2, 5–9 a 3×3. An unfilled last row stretches its panes to share the full width. Closing a pane re-flows the rest. The rule is a pure, unit-tested function.
- Shortcuts (pure, unit-tested mapping): new terminal ⌘T / Ctrl+Shift+T; close focused ⌘W / Ctrl+Shift+W; focus pane N with ⌘1–⌘9 / Alt+1–Alt+9. Clicking a pane focuses it. Closing the last pane closes the window.
- Each pane resizes its PTY on layout change, debounced so dragging the window does not flood resize calls.
- Focus states: panes sit on `--term-gap` with 3 px gaps; focused pane has a 2 px accent line on its top edge and a solid block cursor; other panes have an outline cursor and 82% opacity and keep streaming output.
- New panes start in the focused pane's working directory where the platform allows it (macOS, Linux), otherwise in the home folder (Windows).
- New spec: `pane-tiling`.

## Outcome

- Three terminals open
  - After: two panes side by side on top, one full-width pane below, separated by 3 px mortar gaps.
- Focused pane
  - After: a 2 px brick line on its top edge and a solid brick cursor; the other panes are dimmed to 82% with an outlined cursor.
- Pressing ⌘T (Ctrl+Shift+T on Windows/Linux)
  - After: a new pane opens in the focused pane's folder and the grid re-flows.

## Assumptions

- Builds on the scaffold change `scaffold-the-tiili-app-one-window-one-wo`; this card is blocked until it merges, and the build merges `origin/main` first. Ruled out: building the scaffold here.
- Focus keys are fixed for now (⌘1–9 / Alt+1–9, per Reijo); rebinding in settings is a later card. Ruled out: a settings file now.
- Pane order is the order opened; pane N for focus keys counts left-to-right, top-to-bottom; ⌘9/Alt+9 with fewer panes does nothing. Ruled out: "9 = last pane".
- Closing a pane moves focus to the pane that took its place (same index), else the previous one. Ruled out: focus history.
- Closing a pane whose shell is still running closes it without a confirmation prompt. Ruled out: a confirm dialog.
- The scaffold's "[process exited] Press Enter" restart stays per pane; the exit does not close the pane. Ruled out: auto-close on exit.
- Working directory: macOS via `proc_pidinfo` (libproc) on the shell pid, Linux via `/proc/<pid>/cwd`; Windows has no reliable way to read another process's cwd, so it uses the home folder. Ruled out: shell-integration OSC 7 parsing (could come later).
- Resize debounce is ~50 ms trailing, plus skipping unchanged rows/cols. Ruled out: throttle without trailing call.
- Accent line uses `--accent` (and the dark-mode focus brick tokens from the brand README); no new colours.
- The scaffold's Windows/Linux Ctrl+Shift+C/V mapping and macOS Edit menu stay; ⌘T/⌘W are added as menu items (a Shell/File menu) on macOS so the webview receives them. Ruled out: webview-only handling on macOS.
