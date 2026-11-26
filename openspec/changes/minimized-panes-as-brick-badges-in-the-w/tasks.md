## 1. Shortcut

- [x] 1.1 Add `minimizeAction` to `src/keymap.ts` (⇧⌘M on macOS; Ctrl+Shift+M on Windows and Linux, with no Alt or Meta). Add a `minimize:pane` entry under Panes in `src/shortcuts.ts`, map it in `src/shortcuts.test.ts`'s `keymapAction`, add the chords to the table cases in `src/keymap.test.ts` (including ⌘M and plain Ctrl+M returning null), and run `npm run docs` to regenerate the README and site tables
  Tests to update: src/keymap.test.ts, src/shortcuts.test.ts, scripts/docs.test.ts
  - proof: `npx vitest run src/keymap.test.ts src/shortcuts.test.ts scripts/docs.test.ts`
  - proof: `npx eslint src/keymap.ts src/shortcuts.ts src/keymap.test.ts src/shortcuts.test.ts`

## 2. Pure rules

- [x] 2.1 Add `src/minimized.ts` with these rules, and one table-driven `src/minimized.test.ts` (first line `// @harvaaja-test-tier: fast`) covering back in place, layout changed, overflow `+N` and title centred, slid or hidden:
  - `restoreIndex(at, peers, currentIds)`: the old index while the tab's other panes are unchanged, else the end.
  - `fitBadges(widths, available, plusWidth)`: how many badges show and how many go to `+N`.
  - `titlePlacement(bar, title, badgesEnd, actionsStart)`: centred, slid to the middle of the free space, or hidden.
  - `badgeState`: running, needs-you, exited with code, or stopped.
  - `bringBack(minimized, visible)`: the pane minimized last once no pane is visible, else none.
  - proof: `npx vitest run src/minimized.test.ts`
  - proof: `npx eslint src/minimized.ts src/minimized.test.ts`

## 3. Minimize and restore in the window

- [x] 3.1 In `src/panes.ts` and `src/tab.ts`, add the window's minimized list and `minimize(pane)` / `restorePane(entry)`, following design.md:
  - Minimizing takes the pane out of its tab as close does but keeps it. Its terminal holds its size.
  - Restoring shows the pane's tab, puts the pane back at `restoreIndex`, refits once and focuses it.
  - Add the Minimize icon left of Zen in `paneElement`, hidden with one pane in `Tab.showZen`. It has the
    tooltip `Minimize pane ⇧⌘M` / `Minimize pane Ctrl+Shift+M`, and a press that does not move focus.
  - Handle `minimizeAction` in `Panes.shortcut` (nothing happens for the tab's only visible pane).
  - Make `focusSession` (⌘J) restore a minimized pane before focusing it.
  - When the window's last visible pane closes while panes are minimized, restore the one `bringBack` names into
    the shown tab with the focus; close the window only when no visible or minimized pane is left.
  - proof: `npx eslint src/panes.ts src/tab.ts`
- [x] 3.2 Pass the exit code through `openTerminal`'s `onExit` and add an optional `onOutput` hook in `src/terminal.ts`. A minimized pane's exit sets its state to exited instead of closing, and a non-zero code marks it `exited with code N` through `backend.attention.mark`. A restored exited pane has input disabled and closes from its close icon.
  - proof: `npx eslint src/terminal.ts src/panes.ts`
  - proof: `npx vitest run src/backend-ws.test.ts`

## 4. Badges in the top bar

- [x] 4.1 Add `src/minimizedBar.ts`, placed by `createTopBar` after the tab strip and exposed on `TopBar` as `badges`. It handles these, with styles in `src/styles.css` drawn from brand tokens only:
  - The badges: 18px tall, with the tint outline, wash and swatch, and a Geist Mono 11px label.
  - The running pulse (off under reduced motion), the needs-you brick, exited klinkkeri with the code, and the
    stopped `was running: <command>`.
  - Click to restore, and the right-click menu (Restore, Peek, Move to Tab ▸, Move to Window ▸, Close) through
    `showContextMenu`.
  - The `+N` overflow list using `fitBadges`.
  - Title dodging on the overlay bar using `titlePlacement`, with an animated slide. It replaces the CSS rule that
    hides the title whenever the strip shows.
  - Wire `Panes` to update the badges whenever the minimized list, marks or chip labels change.
  - proof: `npx eslint src/minimizedBar.ts src/topBar.ts src/panes.ts`
  - proof: `npx eslint src/styles.css`
  - proof: `npx vitest run src/minimized.test.ts`
- [x] 4.2 Add the peek to `src/minimizedBar.ts`. It opens on a ~300 ms hover or a 500 ms long press and shows the command, repository, uptime and the pane's terminal host scaled to fit, with the PTY size unchanged. Typing goes to the pane once the user clicks in. Escape closes it without reaching the shell, and it closes when the pointer leaves unless the user clicked in. Make Move to Window carry a `minimized` flag through `movePane`/`arrive`, so the pane arrives minimized.
  - proof: `npx eslint src/minimizedBar.ts src/panes.ts`
  - proof: `npm run typecheck`

## 5. Session restore

- [x] 5.1 Add `minimized` (saved panes with `at`) to `SavedTab` in `src/session.ts`, `snapshotWindow` and `restorePlans`, and in Rust `src-tauri/src/session.rs` (serde default), keeping their scrollback files. In `Panes.restoreTab`, open them with their preface and minimize them in the stopped state before they show. Add a case to `src/session.test.ts` and a round-trip case to `src-tauri/tests/session_store.rs` showing that a minimized pane and its scrollback survive save and load.
  Tests to update: src/session.test.ts, src-tauri/tests/session_store.rs
  - proof: `npx vitest run src/session.test.ts`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test session_store`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test session_store -- -D warnings`
  - proof: `npx eslint src/session.ts src/session.test.ts src/panes.ts`

## 6. Command line

- [x] 6.1 In `src-tauri/src/control.rs`, add these, with their in-file parse, args and `list_lines` tables extended:
  - `minimized` on `Op::Open` and `--minimized` in `open`'s args.
  - `Op::Minimize` / `Op::Restore { target: Option<SessionId> }` and the `minimize` / `restore` CLI commands with
    an optional PANE.
  - The `last_visible_pane` error code.
  - `minimized` on `PaneInfo` and the JSON schema.
  - `\tminimized` in `list_lines`.
  - The `COMMANDS` entries, and the `src-tauri/tests/fixtures/describe.json` golden file updated to match.

  Dispatch the new commands in `src-tauri/src/cli.rs` and extend its args tables.
  Tests to update: src-tauri/src/control.rs (in-file tests), src-tauri/src/cli.rs (in-file tests), src/docs-sync/cli-flags.test.ts
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cli::`
  - proof: `npx vitest run src/docs-sync/cli-flags.test.ts`
- [x] 6.2 In `src-tauri/src/control_app.rs`, add the following, and extend the ownership table test `ownership_and_keys_decide_reuse_and_close` with minimize/restore cases (own pane, owned pane, refused, gone):
  - Store the minimized sessions from `pane_order_set`.
  - Forward minimize and restore through `pane-minimize-request` / `pane_minimize_done`. No target means the
    caller; a target is checked with the close ownership rule.
  - Pass `minimized` on open requests.

  Register the command in `src-tauri/src/lib.rs`.
  Tests to update: src-tauri/src/control_app.rs (in-file tests)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control_app::`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [x] 6.3 In `src/backend.ts`, `src/backend-tauri.ts` and `src/backend-ws.ts`, send the minimized sessions with `setOrder`, and add `onMinimizeRequest` and `minimized(requestId, error)`. In `Panes`, open `tiili open --minimized` panes at the caller's pane size and minimized before they show. `minimizeRequested` minimizes or restores without moving focus and answers `last_visible_pane` when the pane is the tab's only visible one. Update `src/backend.test.ts`'s `setOrder` expectation.
  Tests to update: src/backend.test.ts
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts src/panes.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate minimized-panes-as-brick-badges-in-the-w --strict`

## Manual checks after merge (The user)

- With two panes, hover one: Minimize, Zen, Close icons in that order, and the Minimize tooltip names ⇧⌘M
  (Ctrl+Shift+M on Windows and Linux). ⇧⌘M minimizes the focused pane and nothing reaches the shell.
- Minimize a pane running `npm run dev`: the badge sits after the window buttons (and after the tabs with two tabs),
  pulses while output arrives, and clicking it brings the pane back where it was. Check on both the macOS bar and
  the Windows or Linux 24px bar.
- Ring the bell in a minimized pane from another app: the badge shows the brick, the count rises and a notification
  fires. Make a minimized command exit with code 1: klinkkeri badge with `1`, attention mark; Close dismisses it.
- Hover a badge: the peek shows command, repository, uptime and the live terminal. Type into it; Escape closes it
  and the grid has not moved.
- Minimize enough panes to overflow: `+N` appears and opens the rest. Watch the `tiili` title slide right and hide
  on macOS as badges grow.
- Move a minimized pane to another window from the badge menu: it arrives minimized there.
- Quit with a minimized dev server and relaunch: the badge reads `was running: npm run dev`; restore, Up, Enter
  re-runs it.
- `tiili open --minimized -- npm run dev`, `tiili minimize`, `tiili restore 8` and `tiili list` behave as specified.
