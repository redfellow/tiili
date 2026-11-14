## Why
Colour-by-repository breaks for git worktrees, which is how parallel agents usually run: `find_repo_root` stops at a linked worktree's own `.git` file, so each worktree counts as a new repository with a new tint, and its chip shows the worktree folder name (e.g. `_main`, `tiili-icon`).

## What Changes
- Local repository resolution follows a `.git` file's `gitdir:`; a gitdir with `commondir` is a linked worktree whose repository is the common git folder. No `commondir` (submodule, `--separate-git-dir`) stays its own repository. A dangling or unreadable pointer falls back to today's behaviour.
- The tint key of a local repository is the canonicalised common git folder, so a main checkout and all its worktrees share one tint exactly. Names: `X/.git` → `X`, bare `foo.git` → `foo`, dot-named (`.bare`) → parent folder name.
- A linked worktree's chip reads `<repo> › <branch> · <command>`; on a detached HEAD it shows git's worktree name. The main checkout's chip is unchanged.
- HEAD is re-read on every lookup, and on macOS/Linux the 1 s poll also re-checks the repository while an OSC 7 stands, so a mid-run `git switch` shows within about a second. Windows updates at each prompt.
- Remote snippets send the main worktree root (`git worktree list --porcelain`, first entry), falling back to `--show-toplevel`; remote names drop a trailing `.git`. Installed snippets keep the old behaviour until reinstalled.

## Outcome
- Linked worktree on a branch
  - Now: `tiili-icon · claude`
  - After: `tiili › brand/app-icon-15 · claude`
- hv card worktree on a detached HEAD
  - Now: `_main · zsh`
  - After: `tiili › _main · zsh`
- Main checkout
  - Now: `tiili · zsh`
  - After: `tiili · zsh`

## Assumptions
- The separator is `›` (U+203A); if the brand font lacks it the system fallback draws it (alternative: a different separator such as `/`).
- Long branch names are not truncated separately; the chip's existing ellipsis cuts the whole label (alternative: cap the branch at N characters).
- The tint key is the common git folder only for local panes; remote keys stay host + reported root (alternative: send the git dir from remote snippets).
