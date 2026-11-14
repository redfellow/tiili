## MODIFIED Requirements

### Requirement: Pane follows its working directory
Each pane SHALL know its shell's current working directory and its git repository, updated from OSC 7 on all platforms and by polling the shell process on macOS and Linux. An OSC 7 report SHALL keep the host it names, and SHALL be looked up on the local disk only when the pane is local (see Remote panes). The repository SHALL be found at the nearest `.git`; when that is a file whose `gitdir:` (absolute or relative to its folder) holds a `commondir`, the pane is in a linked worktree and its repository is the common git folder; a `gitdir` without `commondir` (submodule, separate git dir) is its own repository; an unreadable or dangling pointer SHALL make the folder holding the `.git` file the repository. HEAD SHALL be re-read on every lookup, and on macOS and Linux the poll SHALL re-check the repository of a local pane every second even while an OSC 7 stands; Windows updates at each prompt.

#### Scenario: Change directory into a repository
- **WHEN** the user runs `cd` into a folder inside a git repository
- **THEN** the pane's repository becomes that repository within about a second

#### Scenario: Local OSC 7 with this machine's name
- **WHEN** a local shell sends OSC 7 `file://<this machine's hostname>/Users/red/tiili` and that folder is in a repository
- **THEN** the pane shows that repository as before

#### Scenario: Missing main checkout falls back
- **WHEN** a worktree's `gitdir:` points at a folder that no longer exists
- **THEN** the worktree folder is the pane's repository, named after it

#### Scenario: Mid-run git switch
- **WHEN** a program running in a worktree pane on macOS or Linux runs `git switch other`
- **THEN** the chip shows `other` within about a second

### Requirement: Panes in one repository share a tint
Panes in the same repository SHALL share a project tint, assigned in order tint 1 to tint 16 as new repositories appear, stable for the session; once all 16 are taken a new repository SHALL get the least-used tint, ties to the lowest number. A local repository SHALL be identified by its canonicalised common git folder, so a main checkout and all its linked worktrees share exactly one tint; a submodule keeps its own.

#### Scenario: Two panes, one repository
- **WHEN** two panes are in the same repository
- **THEN** both show the same tint

#### Scenario: Seventeenth repository
- **WHEN** a seventeenth repository appears
- **THEN** it gets the tint with the fewest open panes

#### Scenario: Worktree and main checkout share a tint
- **WHEN** one pane is in `tiili` and another in a linked worktree of it
- **THEN** both show the same tint

#### Scenario: Two worktrees
- **WHEN** two panes are in two linked worktrees of one repository
- **THEN** both show the same tint

#### Scenario: Worktree of a bare repository
- **WHEN** a pane is in a worktree of bare repository `api.git` with no main checkout
- **THEN** its repository is named `api`, and every worktree of it shares its tint

#### Scenario: Submodule keeps its own tint
- **WHEN** a pane is inside a submodule of a repository
- **THEN** it has the submodule's own tint, not the parent's

### Requirement: Title chip
Each pane SHALL show a title chip naming its place and its command as `<place> · <command>`: the place is the repository name in its tint and label colour, or the folder name in a neutral style when outside any repository, where the pane stays untinted. In a linked worktree of a local repository the place SHALL be `<repository> › <branch>`, or `<repository> › <worktree name>` on a detached HEAD, the worktree name being git's `<name>` in `.git/worktrees/<name>`; the main checkout's place is the repository name alone. The command SHALL be the title the foreground program has set itself since it came to the foreground, otherwise the name of the pane's foreground process; at an idle prompt this is the shell's name.

#### Scenario: Outside a repository
- **WHEN** a pane's cwd is not in a git repository
- **THEN** its chip shows the folder name in the neutral style and the pane has no tint

#### Scenario: Program running
- **WHEN** the user runs `top` in a pane in their home folder `red`
- **THEN** the chip reads `red · top`, and after quitting top it reads `red · zsh` (with zsh as the shell)

#### Scenario: Program sets its own title
- **WHEN** the foreground program sends a window title
- **THEN** the chip's command part shows that title until the foreground process changes

#### Scenario: Worktree on a branch
- **WHEN** `claude` runs in a linked worktree of `tiili` on branch `brand/app-icon-15`
- **THEN** the chip reads `tiili › brand/app-icon-15 · claude`

#### Scenario: Detached HEAD shows worktree name
- **WHEN** a linked worktree of `tiili` registered as `_main` is on a detached HEAD
- **THEN** the chip's place reads `tiili › _main`

### Requirement: Remote repository report
A remote pane SHALL take its repository root from the user variable `tiili_repo` sent with `OSC 1337 ; SetUserVar=tiili_repo=<base64>`, the repository being named after the root's last folder without a trailing `.git`. tiili's remote snippets SHALL report the main worktree's root (the first entry of `git worktree list --porcelain`), falling back to `git rev-parse --show-toplevel` where that fails; snippets installed before this change keep reporting the worktree root until reinstalled. An empty value SHALL mean no repository. The variable SHALL be ignored while the pane is local, and a pane that goes remote SHALL start without a repository until one is reported.

#### Scenario: Repository reported
- **WHEN** a remote pane on `build-box` receives `tiili_repo` with the base64 of `/srv/api`
- **THEN** the pane's repository is `api` on `build-box`

#### Scenario: Bare repository reported
- **WHEN** a remote pane on `build-box` receives `tiili_repo` with the base64 of `/srv/api.git`
- **THEN** the pane's repository is `api` on `build-box`

#### Scenario: Left the repository
- **WHEN** a remote pane in a repository receives an empty `tiili_repo`
- **THEN** the pane has no repository and its chip shows `<host>:<folder name>`

#### Scenario: Local shell sends the variable
- **WHEN** a local pane receives `tiili_repo`
- **THEN** its repository still comes from the local disk
