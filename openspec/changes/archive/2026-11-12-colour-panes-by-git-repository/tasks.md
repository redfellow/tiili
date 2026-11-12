## 1. Brand

- [x] 1.1 Merge `origin/main` (scaffold and auto-tiling must have landed); add `--tint-9` … `--tint-16` with `--tint-N-on` to `docs/brand/tiili.css` and a table row each plus the order sentence in `docs/brand/README.md`
  - proof: `grep -cE -- '--tint-(9|1[0-6])-on' docs/brand/tiili.css`

## 2. Core (Rust)

- [x] 2.1 Add `src-tauri/src/repo.rs` `find_repo_root` with unit tests (`.git` dir, `.git` file, nested, none)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml repo::`
- [x] 2.2 Add `src-tauri/src/cwd.rs`: OSC 7 parser (table-driven tests incl. percent-encoding and Windows drive paths), macOS/Linux poller, `pane-cwd` event carrying cwd, root and name
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml cwd::`
- [x] 2.3 Integration test `src-tauri/tests/repo_tracking.rs` (first line `// @harvaaja-test-tier: integration`): temp dirs with `git init`, a shell `cd`s between them, tracked root follows (skip polling assertions on Windows)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## 3. Frontend

- [x] 3.1 Add pure `src/tints.ts` and table-driven `src/tints.test.ts` (first line `// @harvaaja-test-tier: fast`): order, stability, least-used after 16, tie to lowest
  - proof: `npx vitest run src/tints.test.ts`
- [x] 3.2 Add `src/paneChip.ts` and wire `pane-cwd` events to pane tint and chip (neutral outside a repository); document the Windows OSC 7 prompt snippets in README.md
  - proof: `npx eslint src/paneChip.ts src/tints.ts`
  - proof: `npm run typecheck`
  - proof: `npx vitest run src/paneChip.test.ts`

## Manual checks after merge (The user)

- On macOS and Linux, open panes in two repositories and a plain folder; `cd` between them and see chips and tints follow.
- On Windows with the documented PowerShell snippet, `cd` updates the chip; without it the chip shows the start folder.
- Check the eight new tints look right beside the brand palette in light and dark.
