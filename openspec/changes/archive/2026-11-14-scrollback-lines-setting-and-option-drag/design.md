## Approach
- `src/settings.ts`: add `scrollback: number` to `Settings` (inside the behaviour group if it fits, otherwise top level), `SCROLLBACK_RANGE = { min: 1000, max: 100000, step: 1 }`, default 10 000; `normalize` clamps with the existing range helper and falls back on invalid values. Covered in `src/settings.test.ts`.
- `src/terminal.ts`: pass `scrollback` and `macOptionClickForcesSelection: true` to `new Terminal`; where settings are applied live (alongside cursor settings) set `term.options.scrollback`. xterm handles word/line multi-click and Option-click cursor moves (`altClickMovesCursor`, default true) unchanged.
- `src/settingsDialog.ts`: a number input row "Scrollback lines" in the Panes section.
- Move payload: it travels through Tauri `invoke("pane_move")` as JSON, which has no size limit of its own. A Rust unit test in `src-tauri/src/windows.rs` serializes/deserializes a `MovePayload::Terminal` holding ~100 000 lines × 200 columns of text (≈20 MB) and asserts it comes back intact. If the check shows a problem the builder lowers the cap and records it.

Why: xterm already supports changing `scrollback` live and the macOS option; the work is the setting and the cap check.
