## Approach

- **`src-tauri/src/integrations.rs`** (new, `pub mod`): an `Integration` table (id, name, description, location, required tool) with `status(env) -> {installed, available, reason}`, `install`, `uninstall`, and `refresh_installed(app_version)`. External commands go through an injectable runner trait so tests fake `omp` and PATH lookups; real runs use `std::process::Command` with PATH lookup that handles Windows `.exe`/`.cmd`.
- **omp**: files embedded with `include_str!` from `integrations/subagent-panes/omp/` (`package.json`, `index.ts`), written to `<app_data_dir>/integrations/omp-subagent-panes/`, then `omp plugin link <dir>`. Off: `omp plugin uninstall tiili-subagent-panes`, then delete the folder. Confirm the uninstall verb from omp's plugin command source (actions: install, uninstall, link, list, …); do not use an unlink verb unless omp has one.
- **Claude**: reuse `claude_skill::install`; add `claude_skill::uninstall(home)` removing the `tiili-tiles` folder.
- **`tiili follow`** (new `src-tauri/src/follow.rs`, CLI command in `control.rs`/`cli.rs`, works without the app like `describe`): port of `follow.mjs` — wait for file, tail it, render omp and Claude Code JSONL events, strip control sequences, stop on `session_exit`, `--done` marker, or `--pid` gone. `follow.test.ts` cases become a table-driven Rust test. `index.ts` runs `tiili follow` instead of `node follow.mjs`.
- **Tauri commands** `integrations_status` and `integrations_apply(changes) -> per-id result {ok | error, fix}`; each change applied independently.
- **Frontend**: `src/integrations.ts` (pure: diff of ticked vs installed, mapping results to row state; unit-tested) and a fourth panel in `settingsDialog.ts`. Save with integration failures keeps the dialog open and re-reads status.
- **Refresh**: at startup, if the stamp in `<app data>/integrations/version` differs from the app version, rewrite files only of integrations whose files exist (never link or install a missing one), then write the stamp.

## Why

Embedding (as `claude_skill.rs` does) keeps every install self-contained on all three OSes without bundle-resource paths. Porting the viewer removes the Node dependency the card flags.
