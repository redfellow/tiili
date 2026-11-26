## Context

Panes live in `Tab` grids (`src/tab.ts`) owned by the window's `Panes` (`src/panes.ts`). Hidden tabs already keep
their terminals at their last size with `holdSize()` and refit once with `releaseSize()`; minimize reuses that.
The top bar (`src/topBar.ts`) holds the tab strip and right-hand buttons, and the macOS title is hidden by CSS
while the strip shows. A pane's exit comes from `backend.onExit(id, code)`, which already carries the exit code, but
`openTerminal` drops the code and `Panes` closes the pane. `tiili list`, `open` and `close` go through `control.rs`
(protocol, CLI parsing, `describe` table and golden file) and `control_app.rs`, which checks ownership and forwards
to the window by event, waiting for a `*_done` command.

The user chose to build all of it as one change. "Exited" means the pane's own process (its shell, or the
`tiili open` command) exits while minimized. `tiili minimize/restore` act on the caller's own pane or one it opened.
The peek keeps the PTY size and scales the terminal down.

## Goals / Non-Goals

Goals: everything on the card. Non-goals: auto-restarting programs on launch; tracking exit codes of commands typed
at a prompt; a macOS menu item for Minimize Pane.

## Decisions

- **Window-level minimized list.** `Panes` keeps `minimized: Minimized[]`, each entry being
  `{ pane, tab, at, peers, state, since }`:
  - `at` is the pane's grid index when it was minimized, and `peers` the ids of the other panes in its tab then.
  - Minimizing removes the pane from `tab.panes` and the layout through the same path as close (`tab.remove`,
    focus hand-off), without disposing it.
  - Its element moves into a detached holder and its terminal calls `holdSize()`.
  - Because the pane leaves `tab.panes`, focus by number, Zen, swap and `tab.sessions()` skip it without new rules.
  - Restore re-adds it at `restoreIndex(at, peers, current ids)`, its old index only when the current ids equal
    `peers`, else the end, then `releaseSize(true)`.
  - The pure rules (restore index, badge fit and overflow count, title placement, badge state) live in
    `src/minimized.ts`, with one table-driven test.
- **Last visible pane.** When the window's last visible pane closes while panes are minimized, the one minimized
  last (`bringBack`) is restored into the shown tab with the focus, so the window and the minimized shells stay;
  the window closes only when no visible or minimized pane is left.
- **Sessions in the order report.** `reportOrder` sends each tab's visible sessions followed by its minimized ones,
  so `tiili list`, `tab` and ownership keep working. A separate `minimized` session list goes with it to
  `pane_order_set`, which `control_app` stores and puts into `PaneInfo.minimized`.
- **Exit while minimized.** `openTerminal`'s `onExit` gets the code. When the pane is minimized, `Panes` sets the
  entry's state to `exited(code)` instead of closing, and on a non-zero code calls `attention.mark(session,
  "exited with code N", chip)`. Restoring an exited pane puts it in the grid with input disabled (the terminal's
  `disableStdin`); its close icon and the badge's Close dispose it.
- **Running pulse.** The terminal reports output arrival through a new optional `onOutput` hook. The badge sets
  `data-active` and clears it about 1.5 s after the last chunk, throttled to one DOM write per animation frame.
- **Badges component.** `src/minimizedBar.ts` renders the badges, the `+N` overflow list and the peek into a
  container that `createTopBar` places after the strip, and exposes `update(entries)`.
  - Fit: a `ResizeObserver` on the bar measures the free width between the strip's end and the actions group, and
    `fitBadges` decides how many show.
  - Title: on the overlay bar the title is positioned by `titlePlacement` (centred, slid, or hidden) with a CSS
    transition on `transform`. This replaces the CSS-only rule that hides the title whenever the strip shows, since
    the same placement covers the strip.
  - Styles: tokens only (`--tint-N`, `--klinkkeri`, `--font-mono`), with the attention brick reusing
    `.pane-chip-brick`.
- **Peek.** A popover under the bar takes the pane's terminal host element while open and scales it with
  `transform: scale()` to the peek width. The PTY is never resized. The host returns to the holder on close.
  Keyboard focus goes to the terminal once the user clicks in. The peek's keydown handler catches Escape first and
  closes. Hover opens after ~300 ms; a 500 ms long press opens it for touch and pen.
- **Badge menu.** It uses the existing `showContextMenu`. Move to Tab moves the entry's `tab`; the pane stays
  minimized. Move to Window reuses `movePane`'s token handoff with a `minimized` flag in the adopted pane's data,
  so the arriving window adds it minimized.
- **Session.** `SavedTab` gains `minimized?: (SavedPane & { at: number })[]` in TypeScript and Rust (serde
  default), kept apart from `panes` so the saved layout still matches the grid. Scrollback is flushed and kept for
  those pane ids too. `restorePlans` yields them, and `restoreTab` opens each with its preface and then minimizes
  it before it is shown, in state `stopped(command)`.
- **Command line.**
  - Requests: `Op::Open` gains `minimized: bool`, and `Op::Minimize { target: Option<SessionId> }` and
    `Op::Restore { target }` are new.
  - Ownership: `control_app` checks with the close rule when a target is given; no target means the caller.
  - Forwarding: the request goes to the window as `pane-minimize-request { request_id, session, minimize }`,
    answered by `pane_minimize_done(request_id, error)`, an error being the `last_visible_pane` code.
  - Docs: `COMMANDS`, `describe.json` and `cli.rs` dispatch follow. `list_lines` appends `\tminimized`.
- **Shortcut.** A new `minimizeAction` in `keymap.ts` (⇧⌘M; Ctrl+Shift+M with no Alt or Meta), handled in
  `Panes.shortcut` and listed in `SHORTCUTS` under Panes, so `npm run docs` regenerates the README and site tables.

## Risks / Trade-offs

- Moving the xterm host element between the holder, peek and grid can lose WebGL context or scroll position. The
  build should move the existing `.pane-terminal` element (as tab switching does) rather than re-open the
  terminal, and refit only on restore.
- Escape in the peek never reaches the program; a user who needs Escape there restores the pane.
- `panes.ts` is already large; the badge UI stays in `minimizedBar.ts` and the pure rules in `minimized.ts` to keep
  growth there to the lifecycle.
