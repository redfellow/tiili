# Subagent panes

When a coding agent running in a tiili pane starts a subagent, tiili opens a new pane beside it that shows the
subagent's work live: its task, tool calls, short tool results and replies. When the subagent finishes, the pane
says so and closes on the next key press (Ctrl-C closes it at any time).

The subagent still runs inside its agent as before. The pane only reads the subagent's transcript file, so the
agent's own subagent features (worktrees, budgets, results, its own subagent view) work as usual. The pane is
read-only: to steer a subagent, use the agent's own UI.

Supported now: **Oh My Pi** (`omp`). The viewer already reads Claude Code transcripts too; a Claude Code hook
adapter is the next step.

## Needs

- tiili, with the agent running inside a tiili pane (the pane gives it `TIILI_SOCKET` and puts `tiili` on `PATH`).
- Node.js 18 or newer on `PATH` (the viewer is `follow.mjs`, a plain Node script with no dependencies).

## Oh My Pi

Install the extension once by linking this folder (keep the checkout where it is; the link points at it):

```sh
omp plugin link /path/to/tiili/integrations/subagent-panes/omp
```

Or load it for one run: `omp -e /path/to/tiili/integrations/subagent-panes/omp/index.ts`.

Then start `omp` in a tiili pane. Each subagent (the `task` tool, eval `agent()`, `/tan` clones; not the advisor)
gets a pane titled after the agent and its id. Outside tiili the extension does nothing. To turn it off inside
tiili, set `TIILI_SUBAGENT_PANES=0`.

How it works: omp runs every extension again in each subagent session, so `session_start` fires once per subagent
with `ctx.agent.kind === "sub"`. The extension then runs

```sh
tiili open --key omp-subagent-<id> --title "<agent> · <id>" --cwd <cwd> -- node follow.mjs <session file> --pid <omp pid>
```

`--key` keeps it to one pane per subagent. The viewer stops when omp writes the subagent's `session_exit` record, or
when the omp process is gone.

## The viewer on its own

```sh
node follow.mjs FILE [--title TEXT] [--pid PID] [--done MARKER]
```

`FILE` is an Oh My Pi session file or a Claude Code transcript (`.jsonl`). It waits for the file to appear and
follows it. It stops at an Oh My Pi `session_exit` record, when `MARKER` exists, or when process `PID` has exited.
Terminal control sequences in the transcript are stripped before printing.
