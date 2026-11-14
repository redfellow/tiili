## 1. Rust resolution
- [x] 1.1 Rework `src-tauri/src/repo.rs`: `.git` file/`gitdir:`/`commondir` resolution, fallback, naming rules, `key` and `worktree` (branch or worktree name); table-driven unit tests over temp dirs for: main checkout, two worktrees sharing key, bare `foo.git` and `.bare` layouts, submodule (no commondir), dangling gitdir, detached HEAD
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib repo::`
- [x] 1.2 Key tints on `repo.key` in `lib.rs` `PaneCwdEvent::new`, add `worktree` to `RepoInfo`; in `cwd.rs` make `report_polled` re-check the repository of a standing local OSC 7 cwd, and strip a trailing `.git` in `remote_repo`; extend `cwd.rs` tests
  - Tests to update: src-tauri/src/cwd.rs (tests module), src-tauri/src/tints.rs (tests module)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib tints::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking`

## 2. Frontend
- [x] 2.1 `src/paneChip.ts`: `PaneCwd.repo.worktree`, `placeLabel` adds ` › <worktree>`; extend the table in `src/paneChip.test.ts`
  - Tests to update: src/paneChip.test.ts
  - proof: `npx vitest run src/paneChip.test.ts`
  - proof: `npx eslint src/paneChip.ts src/paneChip.test.ts`
- [x] 2.2 `src/remoteSnippets.ts`: send the main worktree root from `git worktree list --porcelain` with `--show-toplevel` fallback (bash/zsh/fish/pwsh), note in the Remote shells hint that installed snippets need reinstalling
  - Tests to update: src/remoteSnippets.test.ts
  - proof: `npx vitest run src/remoteSnippets.test.ts`
  - proof: `npx eslint src/remoteSnippets.ts src/remoteSnippets.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Open panes in a main checkout and two of its worktrees: all share one tint; worktree chips read `tiili › <branch> · zsh`, main reads `tiili · zsh`.
- In a worktree pane run `git switch` inside a running program (macOS/Linux): the chip updates within about a second.
- A detached-HEAD hv worktree shows `tiili › _main`.
