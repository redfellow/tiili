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

### Requirement: Refresh on app update
On the first launch of a new app version, tiili SHALL rewrite the files of integrations that are installed to the app's version, and SHALL not install any that are not.

#### Scenario: Update with skill on
- **WHEN** the skill is installed, the omp integration is not, and a new version launches
- **THEN** SKILL.md is the new bundled text and the omp folder does not exist

### Requirement: Follow command
`tiili follow FILE [--title TEXT] [--pid PID] [--done MARKER]` SHALL wait for an Oh My Pi or Claude Code transcript, print its task, tool calls, short results and replies with control sequences stripped, and stop at `session_exit`, when MARKER exists or when PID has exited, without the app running.

#### Scenario: Subagent ends
- **WHEN** the followed omp session file gains a `session_exit` record
- **THEN** the command prints that the subagent finished and stops following
