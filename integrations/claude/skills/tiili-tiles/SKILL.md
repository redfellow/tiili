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
```

- If `gh`, `claude` or `tiili` is not on PATH, say plainly which one is missing (for example "`tiili` is not on
  PATH: install tiili and make sure its command is on PATH").
- If `gh auth status` fails, say that `gh` is not signed in and that `gh auth login` fixes it.

If any check fails, stop here and open no tiles.

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
