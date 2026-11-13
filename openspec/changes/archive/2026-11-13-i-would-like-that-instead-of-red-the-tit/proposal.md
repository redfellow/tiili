## Why
Every pane's chip reads only the folder or repository (e.g. `red` for the home folder), so panes running bash, Heynote or top all look alike. Reijo wants the chip to name what runs in the pane while keeping the repository.

## What Changes
- The title chip shows `<repo or folder> · <command>`; the repo part keeps its tint as today.
- The command is the title the running program set itself (OSC 0/2) when it has set one, otherwise the name of the pane's foreground process (e.g. `top`, `vim`).
- At an idle prompt the command is the shell's name (`zsh`, `bash`).
- The core emits a new `pane-command` event when a pane's command changes.

## Outcome
- Idle shell in home folder
  - Now: `red`
  - After: `red · zsh`
- top running in home folder
  - Now: `red`
  - After: `red · top`
- Program that sets its own title, inside the tiili repo
  - Now: `tiili`
  - After: `tiili · <the program's title>`

## Assumptions
- A program-set title is dropped when the foreground process changes (e.g. returns to the shell), so a stale title never lingers; ruled out keeping the last title until another is sent.
- Foreground process is polled about once a second alongside the cwd poll; ruled out a faster or event-driven watch.
- Where the foreground process can't be read (e.g. Windows), the shell's name is shown; ruled out leaving the command part empty.
- A shell's own titles (zsh/oh-my-zsh setting `user@host:~`) count as program-set titles while the shell is in the foreground; ruled out ignoring titles from shells.
