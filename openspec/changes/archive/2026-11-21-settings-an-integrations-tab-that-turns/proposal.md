## Why

tiili's coding-agent integrations (Oh My Pi subagent panes, the Claude Code tiili-tiles skill) can only be turned on by hand: linking a repo checkout into omp, needing Node for `follow.mjs`, or running `tiili install-claude-skill`. An installed-app user has neither the checkout nor a reason to know the commands.

## What Changes

- A fourth settings tab, **Integrations**, after Behaviour. Each integration is a row: checkbox, one-line description, where it installs, and why it can't work here when it can't (`omp`/`claude` not on PATH). The checkbox shows what is installed on disk when the dialog opens.
- Save runs install or uninstall for each changed row only. A failure keeps the dialog open with that row's error and a fix to try; rows that succeeded stay applied. Nothing installs or uninstalls on startup, first run or update.
- The viewer moves into the binary: `tiili follow FILE [--title TEXT] [--pid PID] [--done MARKER]`, same behaviour as `follow.mjs` (which is removed, its tests ported to Rust). No Node needed.
- The app embeds the omp extension, writes it to `<app data dir>/integrations/omp-subagent-panes/`, and runs `omp plugin link <dir>`; turning it off runs `omp plugin uninstall tiili-subagent-panes`. The extension runs `tiili follow`.
- The Claude Code skill row uses the existing install code; turning it off removes `~/.claude/skills/tiili-tiles/`. `tiili install-claude-skill` stays.
- On the first launch of a new app version, files of integrations already installed are rewritten to the app's version. None is turned on.
- Works the same on macOS, Windows and Linux. The tab's list is data-driven so Claude Code subagent panes can be added next.

## Outcome

- The tabs
  - Now: `Style  Typography  Behaviour`
  - After: `Style  Typography  Behaviour  Integrations`
- Oh My Pi row
  - After: `☐ Oh My Pi subagent panes — Each omp subagent opens a read-only tiili pane that follows its transcript. Installs to <app data>/integrations/omp-subagent-panes and links it into omp.`
- Claude Code row
  - After: `☐ Claude Code tiili-tiles skill — Lets Claude Code fan work out into tiili tiles. Installs to ~/.claude/skills/tiili-tiles.`
- Missing tool
  - After: `omp is not on PATH. Install Oh My Pi, then reopen Settings.` (checkbox disabled)
- Save failed
  - After: row error `Could not link into omp: <message>. Try: run omp plugin doctor, or untick and save.`

## Assumptions

- omp's removal command is `omp plugin uninstall <name>` (omp's plugin command lists install, uninstall, link, list…, no `unlink`); the build confirms it against omp's source/`--help` before relying on it, rather than guessing `unlink`.
- "Installed" for omp is: the app-data folder exists and `omp plugin list` names `tiili-subagent-panes`; for Claude: `SKILL.md` exists. Ruled out: trusting a saved preference.
- A row whose tool is missing but is installed on disk stays untickable (so it can be turned off); only ticking is disabled.
- Version-change refresh is recorded with a stamp file in the integrations folder, not in settings.json.
- The Claude row needs `claude` on PATH to be ticked, as the card asks; ruled out: allowing the skill to be written without Claude Code installed.
