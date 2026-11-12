## Why

tiili's concept (docs/concept.md, "Colour by project") is that terminals in the same git repository share a colour so many agents across several repositories can be told apart at a glance. With auto-tiling in place, panes need that colour and a label.

## What Changes

- Each pane tracks its shell's current working directory: OSC 7 from the shell when sent; on macOS and Linux the core also polls the shell process's cwd about once a second. On Windows only OSC 7 updates it (documented prompt snippet for PowerShell and cmd); without it the pane keeps its start folder.
- The repository root is found by walking up from the cwd to a folder containing `.git` (directory or file, so worktrees and submodules count).
- Panes in the same repository share a tint. Tints are assigned in order `--tint-1` … `--tint-16` as new repositories appear and stay stable for the session; once all 16 are in use, a new repository gets the least-used tint (ties: lowest number).
- Brand: `docs/brand/tiili.css` and `docs/brand/README.md` gain `--tint-9` … `--tint-16`, each with a `--tint-N-on` label colour, designed to sit with the material palette and meet label contrast.
- Each pane shows a title chip: repository name in its tint and label colour; outside a repository, the folder name in a neutral style (surface/muted). Untinted otherwise.
- New specs: `repository-colours`; delta to brand tokens (`brand-tokens`).

## Outcome

- Pane in `~/code/tiili/src`
  - After: chip `tiili` in tint 1 (brick, white text)
- Second repository opened
  - After: its panes' chip in tint 2 (savi, dark text)
- Pane in `~/Downloads`
  - After: neutral chip `Downloads`, pane untinted

## Assumptions

- Builds on the scaffold card and the auto-tiling card; the build merges `origin/main` once they have landed. Ruled out: building panes here.
- Polling interval 1 s, only while the app runs; ruled out faster polling.
- "Least-used" counts open panes per tint; a tint whose repository has no open panes still keeps that repository's assignment for the session (stable) but counts 0 for reuse. Ruled out freeing assignments.
- Repository name is the root folder's name; ruled out reading the remote URL.
- Chip shows the repository name only, not the subfolder; ruled out a path.
- The new 8 tints are chosen by the builder from the material palette idea and recorded in the brand README table; the owner reviews them in the PR.
- No `.harvaaja/` changes are needed: checks from the scaffold card (vitest, cargo test) cover the new tests.
