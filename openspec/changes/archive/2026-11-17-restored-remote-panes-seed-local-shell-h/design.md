## Approach

In `paneRestore`, compute `history` only when `!pane.host` (alongside `withScrollback && command`). The dim `— was connected to <host> —` line is unchanged. Tiili's shell integration does not run remotely, so a host pane's command is untrusted remote output; dropping it loses nothing legitimate.
