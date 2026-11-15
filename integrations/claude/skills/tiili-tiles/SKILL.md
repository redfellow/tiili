---
name: tiili-tiles
description: Fan work out into side-by-side tiili terminal tiles, one Claude Code session per task. Use when the user asks to review several pull requests at once, or to run one task per tile in tiili.
---

# tiili-tiles

Open one tiili tile per task, each running its own Claude Code session with a prompt written for that task. tiili
tiles the terminals side by side and tints each by its git repository, so tasks in the same repository share a
colour and each tile's chip names its branch.

## 1. Preflight

Before opening anything, check the tools this skill needs. Run each check and collect every failure:

```sh
command -v gh
command -v claude
command -v tiili
gh auth status
[ -n "$TIILI_SOCKET" ]
```

- If `gh`, `claude` or `tiili` is not on PATH, say plainly which one is missing (for example "`tiili` is not on
  PATH: install tiili and make sure its command is on PATH").
- If `gh auth status` fails, say that `gh` is not signed in and that `gh auth login` fixes it.
- If `TIILI_SOCKET` is unset (`[ -n "$TIILI_SOCKET" ]` fails), say that `tiili open` only works from inside a tiili
  pane, so Claude Code has to run in a tiili pane for this skill to open tiles.

If any check fails, stop here and open no tiles.

## Command reference

`tiili help` lists the commands and `tiili help <command>` shows one; `tiili describe` prints the whole command
line as JSON (arguments, needed variables, output, exit codes, and each error with its fix), and works outside a
pane. When a `tiili` command fails it prints `tiili: <what went wrong>` and then a `hint:` line naming the fix: tell
the user both, and follow the hint before trying again.

## Intents: what to ask tiili for

Each thing you may want from tiili has one recipe. `tiili prompt` prints this list as plain text to put in a prompt
you write for another agent, and `tiili describe` lists it as `intents`.

<!-- tiili:intents:begin -->
- **fan-out**: when a task should run in its own pane, one agent session per task.

  ```sh
  tiili open --cwd DIR -- claude "PROMPT"
  ```

  The new session does not see this conversation, so PROMPT says everything the task needs.

- **run-beside**: when a long-running command (a dev server, a watcher, tests) should run beside you while you read its output.

  ```sh
  tiili open --key dev -- sh -c 'CMD 2>&1 | tee FILE'
  ```

  Then read FILE; it prints opened ID, and running it again with the same --key prints reused ID instead of opening a second pane; tiili close ID closes it.

- **need-you**: when you need the user: a question, a finished task, something to review.

  ```sh
  tiili attention "MSG"
  ```

  Marks your own pane with MSG while the user is elsewhere; it clears when they focus the pane, or with tiili attention --clear.

- **find-reuse**: when you want to find a pane to reuse, read or close.

  ```sh
  tiili list --json
  ```

  Each pane has id, cwd, title, command, tab, key, self and opened_by_you; tiili close works only on panes with opened_by_you true.
<!-- tiili:intents:end -->

### Run something beside you

Use run-beside instead of starting a dev server, watcher or long test run in the background of your own shell. The
command runs in its own tile where the user can watch it, and `tee` copies its output to `FILE` (pick a path such as
`/tmp/<project>-dev.log`) for you to read with your file tools. Give each long-running command its own `--key`: the
first call prints `opened <id>`, and any later call with the same key prints `reused <id>` without opening a second
tile, so running the recipe again is safe. Once the tile's command has exited, the next call opens a fresh one.

When you no longer need it, close it with `tiili close <id>`. You can close only tiles you opened yourself; for any
other tile tiili refuses with `not_opened_by_you`, and you ask the user to close it instead.

### Ask for the user

Use need-you when you finish a task, are blocked on a question, or have something for the user to review: run
`tiili attention "<short message>"` and then wait for them. It marks only your own tile, the same way a terminal
notification does, and shows nothing when the user is already looking at your tile. The mark clears when they focus
your tile; if you no longer need them before that, run `tiili attention --clear`.

## 2. Generic recipe: one tile per task

For each task:

1. Pick the folder the task runs in (`<dir>`), creating it if the task needs its own checkout.
2. Write a self-contained prompt for the task: the new session does not see this conversation.
3. Open the tile:

   ```sh
   tiili open --cwd "<dir>" -- claude "<prompt>"
   ```

Open the tiles one after another, then tell the user which tile runs which task.

## 3. Recipe: review pull requests

Run this from inside the git repository whose pull requests are to be reviewed.

1. **Pick the PRs.** List the open ones:

   ```sh
   gh pr list --state open --limit 20 --json number,title,headRefName,updatedAt
   ```

   Use the PR numbers the user named. If they named none, take the three most recently updated open PRs from that
   list. If there are no open PRs, say so and stop.

2. **Make a worktree per PR.** Let `<repo>` be the repository's top folder (`git rev-parse --show-toplevel`) and
   `<name>` its folder name. For each PR `<N>`, the worktree is `<repo>/../<name>-pr-<N>`:

   - If that folder already exists and is a worktree of this repository (it shows in `git worktree list`), reuse it.
   - Otherwise create it detached from the current commit:

     ```sh
     git worktree add --detach "<repo>/../<name>-pr-<N>"
     ```

   Then check the PR out inside it:

   ```sh
   gh pr checkout <N>
   ```

   with the worktree as the working directory: `(cd "<repo>/../<name>-pr-<N>" && gh pr checkout <N>)`. If the
   checkout fails, say which PR failed and why, open no tile for it, and carry on with the others.

3. **Open a tile per PR:**

   ```sh
   tiili open --cwd "<repo>/../<name>-pr-<N>" -- claude "<review prompt for PR #N>"
   ```

   The review prompt, with `<N>` and the PR title filled in:

   > Review pull request #<N> ("<title>"), which is checked out in this folder. Read its description with
   > `gh pr view <N>` and its changes against the base branch with `gh pr diff <N>`, reading the surrounding code
   > where you need it. Report correctness bugs first, then risky or unclear changes, then smaller suggestions,
   > each with the file and line. Do not push, comment on the PR or change any files unless I ask.

4. **Report** which tile reviews which PR, and the worktree folders, so the user can remove them later with
   `git worktree remove <folder>`.
