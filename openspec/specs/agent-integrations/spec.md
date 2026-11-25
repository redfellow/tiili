# agent-integrations Specification

## Purpose
Turn tiili's integrations with coding agents on and off from the app, carrying their files with the app so no one has to run a command by hand.

## Requirements

### Requirement: Integrations install only when asked
tiili SHALL install or uninstall an integration only when the user saves the Integrations tab with its checkbox changed. Startup, first run and app updates SHALL never install or uninstall one.

#### Scenario: First run
- **WHEN** tiili starts for the first time with `omp` and `claude` on PATH
- **THEN** no integration is installed

### Requirement: Integration status from disk
Each integration's checkbox SHALL show whether it is installed on disk when the dialog opens. When its tool (`omp` or `claude`) is not on PATH, its row SHALL say so and what to install, and its checkbox SHALL not be tickable; an installed one SHALL still be untickable, so it can be turned off.

#### Scenario: Installed outside the app
- **WHEN** `~/.claude/skills/tiili-tiles/SKILL.md` exists and the dialog opens
- **THEN** the Claude Code skill box is ticked

#### Scenario: Tool missing
- **WHEN** `omp` is not on PATH
- **THEN** the Oh My Pi row says omp is not on PATH and to install Oh My Pi, and its box cannot be ticked

#### Scenario: Turn off without the tool
- **WHEN** the skill is installed, `claude` is not on PATH, and the user unticks the skill and saves
- **THEN** the `~/.claude/skills/tiili-tiles` folder is removed; with `omp` off PATH, unticking Oh My Pi subagent panes instead keeps its folder and shows an error and a fix

### Requirement: Applying integrations
Save SHALL install each newly ticked integration and uninstall each newly unticked one. When one fails, the dialog SHALL stay open showing that row's error and a fix to try, and integrations that succeeded SHALL stay applied.

#### Scenario: One fails
- **WHEN** the user ticks both integrations, saves and linking into omp fails
- **THEN** the skill is installed, the dialog stays open and the Oh My Pi row shows the error and a fix

### Requirement: Oh My Pi subagent panes integration
Turning it on SHALL write the app's bundled omp extension to an `integrations/omp-subagent-panes` folder in the app data dir and run `omp plugin link` on it; turning it off SHALL run omp's plugin uninstall for it and remove the folder. It SHALL need only tiili and omp.

#### Scenario: Turn on
- **WHEN** the user ticks Oh My Pi subagent panes and saves
- **THEN** the folder holds the extension and `omp plugin link <folder>` was run

### Requirement: Claude Code subagent panes integration
Turning it on SHALL add tiili's `SubagentStart` and `SubagentStop` command hooks, which run `tiili claude-hook`, to `~/.claude/settings.json`, replacing any it added before; turning it off SHALL remove them. Either SHALL change only the file's `hooks` entry, keeping the user's other settings and hooks as written, and SHALL leave a file that is not a JSON object as it is and show an error and a fix. Its box SHALL be ticked when the file holds tiili's `SubagentStart` hook.

#### Scenario: Turn on beside the user's hooks
- **WHEN** `~/.claude/settings.json` has the user's own settings and a `SubagentStop` hook, and the user ticks Claude Code subagent panes and saves
- **THEN** the file has tiili's two hooks as well, the user's hook and every other entry are unchanged and in place, and unticking and saving gives back the same settings

#### Scenario: Settings file is broken
- **WHEN** `~/.claude/settings.json` is not valid JSON and the user ticks Claude Code subagent panes and saves
- **THEN** the file is unchanged and the row shows the error and a fix

### Requirement: Claude Code subagent hook
`tiili claude-hook [--pid PID]` SHALL read a Claude Code hook's JSON on stdin. On `SubagentStart` for a subagent with an agent type it SHALL open a pane keyed to the subagent's id in the hook's `cwd` running `tiili follow` on the subagent's transcript (`<session>/subagents/agent-<id>.jsonl`) with a done marker and PID; on `SubagentStop` for a subagent it opened a pane for it SHALL create that marker.

#### Scenario: Subagent starts and stops
- **WHEN** Claude Code runs in a tiili pane with the hooks installed and starts an Explore subagent, which then finishes
- **THEN** a pane titled after Explore follows the subagent's transcript, says it finished once `SubagentStop` runs, and closes by itself

### Requirement: Claude Code subagent hook stays quiet elsewhere
Outside a tiili pane, with `TIILI_SUBAGENT_PANES=0`, or for any input other than a subagent's start or stop, `tiili claude-hook` SHALL do nothing, print nothing and exit 0.

#### Scenario: Outside tiili
- **WHEN** Claude Code with the hooks installed runs outside a tiili pane and starts a subagent
- **THEN** no pane opens and the hook prints nothing and succeeds

### Requirement: Refresh on app update
On the first launch of a new app version, tiili SHALL rewrite the files of integrations that are installed to the app's version (for the Claude Code subagent panes, its hooks in the settings file), and SHALL not install any that are not.

#### Scenario: Update with skill on
- **WHEN** the skill is installed, the omp integration is not, and a new version launches
- **THEN** SKILL.md is the new bundled text and the omp folder does not exist

### Requirement: Follow command
`tiili follow FILE [--title TEXT] [--pid PID] [--done MARKER]` SHALL wait for an Oh My Pi or Claude Code transcript, print its task, tool calls, short results and replies with control sequences stripped, and stop at `session_exit`, when MARKER exists or when PID has exited, without the app running. Once it stops it SHALL exit by itself a few seconds later, or at once on a key press, so the pane it runs in closes without the user going to it.

#### Scenario: Subagent ends
- **WHEN** the followed omp session file gains a `session_exit` record
- **THEN** the command prints that the subagent finished and that the pane is closing, stops following, and exits about 3 seconds later
