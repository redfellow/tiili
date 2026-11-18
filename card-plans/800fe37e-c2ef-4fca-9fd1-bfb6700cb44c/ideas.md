# Ideas for next features

Ten candidate ideas for tiili. None of them is already covered by `openspec/specs/` or in progress on another card (tabs, font zoom, Zen mode, moving panes between windows and tabs, closing owned panes with `tiili`, and the daily update check all exist already). Make a card from whichever you pick.

## Terminal & panes

1. **Split a pane in a chosen direction**: You decide where a new pane goes (right of or below the focused one) instead of the grid always placing it for you. Builds on: `pane-layout`.
2. **Type into several panes at once**: A toggle sends what you type to every pane in the tab, so you can run the same command on many machines or folders in one go. Builds on: `pane-tiling`.
3. **Rename a pane**: Give any pane, not only ones opened with `tiili open --title`, a name of your own that shows on its chip and in `tiili list`. Builds on: `repository-colours` (title chip).
4. **Save and reopen a named layout**: Store a set of panes with their folders and commands as a named workspace, and bring it back with one action, for example "frontend and backend and logs". Builds on: `session-restore`.
5. **Search across all panes**: One find bar that looks in the scrollback of every pane in the window and jumps to the pane holding the match. Builds on: `terminal-search`.

## Agent workflows

6. **Agent status on each pane chip**: Each pane shows whether its agent is working, waiting for you or done, and the top bar counts them, so you can see at a glance which pane needs you. Builds on: `pane-attention`.
7. **More fan-out skills**: Ready-made skills that open one pane per task for work other than pull request reviews, such as running a failing test file in each pane and fixing it in parallel. Builds on: `agent-skills`.
8. **Let agents focus a pane and send it text**: `tiili focus` and `tiili send` let one agent hand work to, or answer a prompt in, a pane it opened, without you switching panes. Builds on: `pane-control`.
9. **Wait for a pane to finish**: `tiili wait <pane>` blocks until that pane's command exits and prints its exit code, so an agent can start several panes and carry on when all are done. Builds on: `pane-control`.

## Other

10. **Command palette**: One shortcut opens a searchable list of every action, such as open pane, change tiling, switch theme or jump to a pane by title, so you need not remember each key. Builds on: `settings`.
