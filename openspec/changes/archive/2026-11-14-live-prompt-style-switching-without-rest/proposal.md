## Why

Reijo: "Prompt style doesn't change on fly nor preview on fly." Today a prompt choice only reaches shells opened after
it, so trying a style means opening new panes, and the panes already open never change.

## What Changes

- Open local zsh, bash and PowerShell panes follow the prompt choice: picking a row in the prompt list previews it in
  the open panes, Save keeps it, Cancel (Esc, ×) puts the saved prompt back.
- Every local zsh, bash and PowerShell shell starts through tiili's shell integration, including with Off, so a pane
  started with Off can switch to a style later; Off still shows the user's own prompt unchanged.
- A prompt the user set in their own shell config still wins: those panes keep it whatever the choice.
- The hint under the prompt list says the choice applies to open panes too.

## Outcome

- Prompt list hint
  - Now: `Applies to panes opened from now on. A prompt set in your own shell config (PROMPT, PS1 or a prompt …) wins.`
  - After: `Applies to open panes and new ones. A prompt set in your own shell config (PROMPT, PS1 or a prompt …) wins.`
- Moving the prompt list from Off to Tiili with a zsh pane open at its prompt
  - Now: the pane keeps its prompt
  - After: the pane's prompt redraws as the Tiili prompt at once

## Assumptions

- zsh redraws an idle prompt at once; bash and PowerShell cannot redraw an idle prompt from outside, so they switch at
  their next prompt (after Enter or the running command ends). Ruled out: typing a command into the shell.
- Panes busy running a program switch when they return to a prompt; nothing is sent to the program.
- Shells started with Off now load tiili's integration scripts (which only report the folder and keep the user's
  prompt). Ruled out: leaving Off panes unable to switch.
- Remote (ssh) panes, fish and other shells are untouched. The dev browser bridge keeps new-panes-only.
- The hint's exact middle wording stays as today; only its first sentence changes.
