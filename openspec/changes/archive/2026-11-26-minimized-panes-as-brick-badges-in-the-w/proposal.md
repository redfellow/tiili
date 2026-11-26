## Why

Long-running commands (dev servers, watchers, `hv serve`) sit in panes for days and take grid space the user wants
for work. Closing them stops them. The user needs to tuck such a pane away while its shell keeps running, still see
at a glance whether it is busy, needs them or has stopped, and bring it back in one click.

## What Changes

- Each pane's title row gets a Minimize icon left of the Zen icon (order Minimize, Zen, Close). It follows the
  Zen/Close rules: shown on hover, hidden when the tab's grid has one pane, tooltip `Minimize pane` with the
  shortcut, and it acts on the clicked pane.
- New shortcut: ⇧⌘M on macOS, Ctrl+Shift+M on Windows and Linux. It never reaches the shell, and ⌘M stays macOS's
  window minimize.
- Minimizing re-flows the grid as closing would. The PTY keeps running at its last size and refits once on restore.
- The window's top bar gets one set of brick badges, covering every tab's minimized panes, placed after the native
  window buttons and the tab strip. Each badge is 18px tall, with an outline in the pane's repository tint, a ~16%
  tint wash, a 7px tint swatch and the running command in Geist Mono 11px. It fits the 38px macOS bar and the 24px
  Windows/Linux bar.
- Badge states:
  - **running**: the swatch pulses slowly while output arrives.
  - **needs you**: the swatch becomes the attention brick. Attention count, ⌘J and desktop notifications work as
    usual.
  - **exited**: the pane's own process exited while minimized. The pane is not closed; the badge fills klinkkeri
    and shows the exit code. A non-zero code raises an attention mark.
  - **stopped**: a minimized pane brought back by session restore. It reads `was running: <command>`.
- Clicking a badge restores the pane in its own tab, showing that tab first. It goes back to its old place when
  that tab's grid has not changed since, else to the grid's end. An exited pane comes back read-only, showing its
  final output, and closes from its close icon.
- Hovering a badge, or a long press, shows a live peek under the bar: command, repository, uptime, and the terminal
  scaled down to fit at its unchanged PTY size, which the user can type into. Escape closes it and the grid is not
  touched.
- Right-clicking a badge offers Restore, Peek, Move to Tab ▸, Move to Window ▸ and Close.
- Badges that do not fit collapse into a `+N` badge that opens a list of the rest.
- The centred `tiili` title on macOS stays centred until the badges would reach it. Then it slides (animated) to
  the middle of the free space between the last badge and the right-hand buttons, and hides when that space is
  narrower than the title.
- Zen and focus-by-number skip minimized panes. ⌘J landing on a minimized pane restores it.
- Session restore brings minimized panes back minimized, in the stopped state. Programs are still never re-run:
  restoring the pane and pressing Up then Enter runs the command again.
- Command line: `tiili open --minimized -- CMD`, `tiili minimize [PANE]` and `tiili restore [PANE]`. With no
  argument they act on the caller's own pane; with a pane id, only on a pane the caller opened. `tiili list` marks
  minimized panes, and `--json` adds `minimized`.

## Outcome

- Pane title row icons
  - Now: Zen and Close icons on hover
  - After: Minimize, Zen and Close icons on hover; Minimize's tooltip reads `Minimize pane ⇧⌘M` (`Minimize pane
    Ctrl+Shift+M` on Windows and Linux)
- A minimized dev server in the top bar
  - After: a tinted brick badge reading `npm run dev` after the window buttons (and the tabs, when shown)
- A minimized pane whose program crashed
  - After: a klinkkeri badge reading `npm run dev` with `1` beside it
- After a relaunch
  - After: a dim badge reading `was running: npm run dev`
- `tiili list`
  - Now: `8	/Users/red/src/app	dev`
  - After: `8	/Users/red/src/app	dev	minimized` for a minimized pane, unchanged for the others

## Capabilities

### New Capabilities

- `pane-minimize`: minimizing panes into brick badges in the window's top bar, and restoring, peeking at and
  managing them there.

### Modified Capabilities

- `terminal-session`: a minimized pane's exiting process no longer closes the pane.
- `session-restore`: minimized panes reopen minimized.
- `pane-control`: `tiili open --minimized`, `tiili minimize`, `tiili restore`, and the minimized flag in
  `tiili list`.
- `pane-attention`: attention for minimized panes, and a non-zero exit while minimized.

## Impact

- Frontend: `src/panes.ts`, `src/tab.ts`, `src/topBar.ts`, new `src/minimized.ts` (pure rules) and
  `src/minimizedBar.ts` (badges, peek, overflow list), `src/keymap.ts`, `src/shortcuts.ts`, `src/session.ts`,
  `src/terminal.ts`, `src/backend*.ts`, `src/styles.css`, README and site shortcut tables (generated).
- Rust: `src-tauri/src/control.rs`, `control_app.rs`, `cli.rs`, `session.rs`, `lib.rs` (command registration), the
  `describe.json` golden fixture.

## Assumptions

- The badge label is the pane's running command; at a prompt it is the pane's chip text (`api · zsh`). Ruled out:
  an empty or generic label.
- "Old position" means the pane's index in its tab's grid order. It is reused only while that tab's set of panes is
  the one it had when the pane was minimized; otherwise the pane goes to the end. Ruled out: matching layout sizes
  as well.
- When the pane's tab has closed by the time it is restored, it comes back at the end of the shown tab. Ruled out:
  reopening the closed tab.
- A pane moved to another tab or window from the badge menu stays minimized there. Ruled out: restoring it on
  arrival.
- The hover peek closes when the pointer leaves both badge and peek, unless the user clicked into the peek; then it
  stays until Escape, a click outside or a restore. Escape always closes the peek and is not sent to the shell.
  Ruled out: Escape reaching the program while peeking.
- `tiili open --minimized` starts its PTY at the caller's pane size. Ruled out: a fixed 80×24.
- `tiili minimize` on the only visible pane of its tab fails with a new code `last_visible_pane`. Minimizing a
  minimized pane, or restoring a visible one, succeeds and changes nothing. Ruled out: errors for those no-ops.
- Plain `tiili list` adds a fourth tab-separated field `minimized` only on minimized panes. Ruled out: a new column
  on every line.
- No macOS Shell menu item for Minimize Pane; the shortcut and icon are enough. Ruled out: a menu item with an
  accelerator.
- An exited badge raises the attention mark with the message `exited with code N`, through the existing mark path.
  Ruled out: a separate notification kind.
- The title dodging applies only to the macOS overlay bar, the only bar that shows the title.
