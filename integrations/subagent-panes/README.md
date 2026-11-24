# Subagent panes

When a coding agent running in a tiili pane starts a subagent, tiili opens a new pane beside it that shows the
subagent's work live: its task, tool calls, short tool results and replies. When the subagent finishes, the pane
says so and closes by itself 3 seconds later (any key closes it sooner, Ctrl-C at any time).

The subagent still runs inside its agent as before. The pane only reads the subagent's transcript file, so the
agent's own subagent features (worktrees, budgets, results, its own subagent view) work as usual. The pane is
read-only: to steer a subagent, use the agent's own UI.

Supported now: **Claude Code** (`claude`) and **Oh My Pi** (`omp`).

## Needs

- tiili, with the agent running inside a tiili pane (the pane gives it `TIILI_SOCKET` and puts `tiili` on `PATH`).
  The viewer is `tiili follow`, part of tiili itself: nothing else, Node included, is needed.

## Claude Code

Turn on **Claude Code subagent panes** in tiili's Settings → Integrations and save. tiili adds two hooks to
`~/.claude/settings.json`, `SubagentStart` and `SubagentStop`, and changes nothing else in the file; unticking it
takes them out again. Both run the same command:

```sh
[ -z "$TIILI_SOCKET" ] || tiili claude-hook --pid "$PPID"
```

Outside a tiili pane it does nothing, so Claude Code sessions elsewhere are untouched. Then start `claude` in a tiili
pane. Each subagent (the Agent tool, including background ones) gets a pane titled after its agent type and the
start of its id. Claude Code's own helper agents, which come without an agent type, do not. To turn it off inside
tiili, set `TIILI_SUBAGENT_PANES=0`. Claude Code holds back hooks in a folder until you accept its trust dialog for
it.

How it works: on `SubagentStart`, `tiili claude-hook` reads the hook's JSON on stdin and runs

```sh
tiili open --key claude-subagent-<id> --title "<agent type> · <id>" --cwd <cwd> -- \
  tiili follow <session>/subagents/agent-<id>.jsonl --done <marker> --pid <claude pid>
```

with the marker in a `tiili-claude-subagents` folder in the temp folder. A Claude Code transcript has no end record
of its own, so on `SubagentStop` the hook creates the marker, and the pane says the subagent finished and closes. On
Windows, where hooks run in Git Bash and `$PPID` is not a Windows process id, the marker alone ends it.

## Oh My Pi

Turn on **Oh My Pi subagent panes** in tiili's Settings → Integrations and save. tiili writes the extension it
carries to `integrations/omp-subagent-panes` in its app data folder and runs `omp plugin link` on it; unticking it
runs `omp plugin uninstall tiili-subagent-panes` and removes the folder. When tiili updates, it rewrites the folder
with the new version's extension.

From a checkout you can instead link this folder (keep the checkout where it is; the link points at it), or load it
for one run:

```sh
omp plugin link /path/to/tiili/integrations/subagent-panes/omp
omp -e /path/to/tiili/integrations/subagent-panes/omp/index.ts
```

Then start `omp` in a tiili pane. Each subagent (the `task` tool, eval `agent()`, `/tan` clones; not the advisor)
gets a pane titled after the agent and its id. Outside tiili the extension does nothing. To turn it off inside
tiili, set `TIILI_SUBAGENT_PANES=0`.

How it works: omp runs every extension again in each subagent session, so `session_start` fires once per subagent
with `ctx.agent.kind === "sub"`. The extension then runs

```sh
tiili open --key omp-subagent-<id> --title "<agent> · <id>" --cwd <cwd> -- tiili follow <session file> --pid <omp pid>
```

`--key` keeps it to one pane per subagent. The viewer stops when omp writes the subagent's `session_exit` record, or
when the omp process is gone.

## The viewer on its own

```sh
tiili follow FILE [--title TEXT] [--pid PID] [--done MARKER]
```

`FILE` is an Oh My Pi session file or a Claude Code transcript (`.jsonl`). It waits for the file to appear and
follows it. It stops at an Oh My Pi `session_exit` record, when `MARKER` exists, or when process `PID` has exited,
then exits 3 seconds later (sooner on a key press), which closes its pane. Terminal control sequences in the
transcript are stripped before printing.
