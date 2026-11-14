## 1. Signals and gate
- [ ] 1.1 Add `src/attention.ts` (OSC 9/777/99 parsers, `sanitizeMessage`, per-pane gate merging BEL+OSC 9 and limiting to one fire per 2 s) with table-driven `src/attention.test.ts` (first line `// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/attention.test.ts`
  - proof: `npx eslint src/attention.ts src/attention.test.ts`
- [ ] 1.2 Wire `term.onBell` and `registerOscHandler` in `src/terminal.ts`/`src/panes.ts`; drop signals for the focused pane of a focused window; clear on focus, window focus, exit and close; never for Heynote panes
  - proof: `npx eslint src/terminal.ts src/panes.ts`

## 2. Registry and OS level
- [ ] 2.1 Add `src-tauri/src/attention.rs`: session-keyed registry (mark, clear, oldest-first next, count), cleared by session removal, `attention-changed` event, `attention_next` focusing the owner window; unit tests for ordering and counts
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib attention`
- [ ] 2.2 OS attention when no tiili window is focused: badge count / Windows overlay brick icon / Linux badge, `request_user_attention` Informational or Critical per setting, cleared on app focus; unit tests in an `attention::os` module for the pure decision (badge count and attention level from focus state and settings)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib attention::os`
- [ ] 2.3 Spike then add `tauri-plugin-notification` (Cargo, npm, capability): one per session until cleared, 2 s summary `N panes need you`, title `<place> · <command>`, click focuses the pane where delivered; record per-OS click findings in design.md
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib attention`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Look, top bar, shortcut
- [ ] 3.1 Chip brick, one pulse (skipped under reduced motion), tooltip message, no dimming for marked panes, in `src/paneChip.ts` and `src/styles.css`
  - proof: `npx vitest run src/paneChip.test.ts`
  - proof: `npx eslint src/paneChip.ts`
- [ ] 3.2 Top-bar count in `src/topBar.ts`; `attentionShortcut` in `src/keymap.ts` (Cmd+J / Ctrl+Shift+J) with cases added to the table in `src/keymap.test.ts`
  - proof: `npx vitest run src/keymap.test.ts`
  - proof: `npx eslint src/topBar.ts src/keymap.ts src/keymap.test.ts`

## 4. Settings
- [ ] 4.1 Attention fields with fallbacks in `src/settings.ts` and `src-tauri/src/settings.rs`; invalid-value cases in `src/settings.test.ts`
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib settings`
- [ ] 4.2 Attention section in `src/settingsDialog.ts` after Panes, platform labels, Agents Copy line, Windows hint; fixed-height Remote shells snippet if needed to fit 720×640
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Each OS: background tiili, ring a bell in a pane: badge/overlay and one bounce/flash; returning clears them.
- Signed macOS build: first notification asks permission; clicking a notification focuses the pane.
- Windows installed build shows toasts; Linux notification and urgency hint on X11.
- Settings window 720×640 Behaviour tab does not scroll.
- Move a marked pane to another window: it stays marked; Cmd+J reaches it.
