# repository-colours Specification

## Purpose
How tiili tells repositories apart at a glance: each pane follows its shell's working directory and git repository, panes in the same repository share a tint, and a title chip names the repository.

## Requirements

### Requirement: Pane follows its working directory
Each pane SHALL know its shell's current working directory and its git repository, updated from OSC 7 on all platforms and by polling the shell process on macOS and Linux. An OSC 7 report SHALL keep the host it names, and SHALL be looked up on the local disk only when the pane is local (see Remote panes).

#### Scenario: Change directory into a repository
- **WHEN** the user runs `cd` into a folder inside a git repository
- **THEN** the pane's repository becomes that repository within about a second

#### Scenario: Local OSC 7 with this machine's name
- **WHEN** a local shell sends OSC 7 `file://<this machine's hostname>/Users/red/tiili` and that folder is in a repository
- **THEN** the pane shows that repository as before

### Requirement: Repository lookup
The repository SHALL be found at the nearest `.git`. When that is a file whose `gitdir:` (absolute or relative to its folder) holds a `commondir`, the pane is in a linked worktree and its repository is the common git folder. A `gitdir` without `commondir` (submodule, separate git dir) is its own repository. An unreadable or dangling pointer SHALL make the folder holding the `.git` file the repository.

#### Scenario: Missing main checkout falls back
- **WHEN** a worktree's `gitdir:` points at a folder that no longer exists
- **THEN** the worktree folder is the pane's repository, named after it

### Requirement: Repository lookup stays current
HEAD SHALL be re-read on every lookup. On macOS and Linux the poll SHALL re-check the repository of a local pane every second even while an OSC 7 stands; Windows updates at each prompt.

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
Each pane SHALL show a title chip naming its place and its command as `<place> · <command>`: the place is the repository name in its tint and label colour, or the folder name in a neutral style when outside any repository, where the pane stays untinted.

#### Scenario: Outside a repository
- **WHEN** a pane's cwd is not in a git repository
- **THEN** its chip shows the folder name in the neutral style and the pane has no tint

### Requirement: Title chip command
The command part of the title chip SHALL be the title the foreground program has set itself since it came to the foreground, otherwise the name of the pane's foreground process; at an idle prompt this is the shell's name.

#### Scenario: Program running
- **WHEN** the user runs `top` in a pane in their home folder `red`
- **THEN** the chip reads `red · top`, and after quitting top it reads `red · zsh` (with zsh as the shell)

#### Scenario: Program sets its own title
- **WHEN** the foreground program sends a window title
- **THEN** the chip's command part shows that title until the foreground process changes

### Requirement: Title chip in a linked worktree
In a linked worktree of a local repository the chip's place SHALL be `<repository> › <branch>`, or `<repository> › <worktree name>` on a detached HEAD, the worktree name being git's `<name>` in `.git/worktrees/<name>`. The main checkout's place SHALL be the repository name alone.

#### Scenario: Worktree on a branch
- **WHEN** `claude` runs in a linked worktree of `tiili` on branch `brand/app-icon-15`
- **THEN** the chip reads `tiili › brand/app-icon-15 · claude`

#### Scenario: Detached HEAD shows worktree name
- **WHEN** a linked worktree of `tiili` registered as `_main` is on a detached HEAD
- **THEN** the chip's place reads `tiili › _main`

### Requirement: Remote title chip
A remote pane's title chip place SHALL be `<host>:<repository name>`, or `<host>:<folder name>` outside a known repository, in its tint and label colour.

#### Scenario: Remote place
- **WHEN** a pane runs `ssh build-box` and the remote shell reports `file://build-box/home/red/api` and repository root `/home/red/api`
- **THEN** the chip's place reads `build-box:api` in the pane's tint

### Requirement: Tints are shared across windows
Project tints SHALL be assigned once for the whole app, so a repository has the same tint in every window, and the least-used rule SHALL count open panes in all windows.

#### Scenario: Same repository in two windows
- **WHEN** a pane in one window and a pane in another window are in the same repository
- **THEN** both show the same tint

### Requirement: Remote panes
A pane SHALL become remote when an OSC 7 report names a host other than this machine, or, on Windows, names a path without a drive letter. A host is this machine when it is empty, `localhost`, or equals the local hostname case-insensitively, in full or by its first dot-separated label. A remote pane's folder SHALL NOT be looked up on the local disk. On Windows a driveless path from this machine's host SHALL be labelled `WSL`.

#### Scenario: ssh with OSC 7
- **WHEN** a remote shell sends OSC 7 `file://build-box/home/red/api`
- **THEN** the pane is remote with host `build-box` and folder `/home/red/api`, and no local folder `/home/red/api` is consulted

#### Scenario: Same path exists locally
- **WHEN** a remote shell on `build-box` reports `/Users/red/tiili` and the local disk has a repository at that path
- **THEN** the pane is not tinted as the local `tiili` repository

#### Scenario: WSL on Windows
- **WHEN** a WSL shell in a pane on Windows sends OSC 7 `file://<this machine's name>/home/red`
- **THEN** the pane is remote with host `WSL` and its chip's place reads `WSL:red`

### Requirement: Remote repository report
A remote pane SHALL take its repository root from the user variable `tiili_repo` sent with `OSC 1337 ; SetUserVar=tiili_repo=<base64>`, the repository being named after the root's last folder without a trailing `.git`. An empty value SHALL mean no repository. The variable SHALL be ignored while the pane is local, and a pane that goes remote SHALL start without a repository until one is reported.

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

### Requirement: Remote snippets report the main worktree
tiili's remote snippets SHALL report the main worktree's root (the first entry of `git worktree list --porcelain`), falling back to `git rev-parse --show-toplevel` where that fails. Snippets installed before this change keep reporting the worktree root until reinstalled.

#### Scenario: Snippet in a linked worktree
- **WHEN** a tiili remote snippet runs in a linked worktree of `/srv/api`
- **THEN** it reports `/srv/api`, the main worktree's root, as `tiili_repo`

#### Scenario: Worktree list fails
- **WHEN** `git worktree list --porcelain` fails in a remote repository
- **THEN** the snippet reports the output of `git rev-parse --show-toplevel`

### Requirement: Remote pane tint
Remote panes SHALL be tinted from the same 16 project tints and assignment rule as repositories: panes with the same host and repository root share a tint, and a remote pane without a repository takes its host's tint. A remote repository SHALL never share a tint key with a local repository or another host's repository of the same path.

#### Scenario: Two agents in one remote repository
- **WHEN** two panes are on `build-box` in repository `/srv/api`
- **THEN** both show the same tint

#### Scenario: Same path on two hosts
- **WHEN** one pane is on `build-box` in `/srv/api` and another on `staging` in `/srv/api`
- **THEN** each gets its own tint

#### Scenario: Remote without the snippet
- **WHEN** two panes are on `build-box` and no `tiili_repo` has been reported
- **THEN** both show `build-box`'s tint

### Requirement: Remote state ends with its program
An OSC 7 report or repository report that arrived while a program other than the shell was in the foreground SHALL last until the shell is back in the foreground (macOS and Linux) or until a later OSC 7 replaces it (all platforms). The pane SHALL then follow its local working directory again, by polling where the platform allows it.

#### Scenario: Exit ssh on macOS or Linux
- **WHEN** a remote pane's `ssh` exits and the shell, which sends no OSC 7, is in front again
- **THEN** within about a second the pane shows its local folder and repository again

#### Scenario: Exit ssh with prompt integration
- **WHEN** a remote pane's `ssh` exits on Windows and tiili's prompt integration is on
- **THEN** the shell's next prompt reports its local folder and the pane is local again

#### Scenario: Local shell with its own OSC 7
- **WHEN** a local fish shell that sends OSC 7 runs `vim` and the user quits it
- **THEN** the pane keeps the folder fish reported

### Requirement: Remote text is only displayed
Folder, host and repository text received from a shell SHALL only be displayed and used as tint keys: it SHALL NOT be run, opened or used as a local path for a remote pane. Control characters SHALL be removed before display, and a report longer than 4096 bytes SHALL be ignored.

#### Scenario: Hostile host name
- **WHEN** a remote shell reports a host containing escape characters or markup
- **THEN** the chip shows the text without control characters and as plain text
