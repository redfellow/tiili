# Design

## Context

- `src-tauri/src/cwd.rs`: `Osc7Scanner` finds OSC 7 in a session's output and `osc7_path` turns `file://host/path` into
  a path, dropping the host. `CwdTracker` combines OSC 7 with polled folders; its `from_osc7` flag makes OSC 7 win for
  the rest of the session. `update` calls `find_repo` (`src-tauri/src/repo.rs`) on the local disk for every folder.
- `src-tauri/src/pty.rs`: `spawn_tracked` feeds output to the cwd and command trackers and runs a ~1 s tick that polls
  the shell's folder (`process_cwd(pid)`) and the foreground (`ForegroundReader::read`, macOS and Linux only; `None`
  on Windows). The shell is its session's leader, so its process group id equals its pid.
- `src-tauri/src/command.rs` already ties a window title to the foreground process group that was in front when it
  arrived; this change gives OSC 7 the same treatment.
- Frontend: the `pane-cwd` event (`src/paneChip.ts`) carries `{ paneId, cwd, repo }`; `src/panes.ts` `showPlace`
  assigns tints by `repo.root` through `TintAssigner` (`src/tints.ts`) and renders the chip with `textContent`.
- Prompt integration lives in `src-tauri/src/shell_integration/{zsh,bash,pwsh}` and runs only when the prompt is not Off.

## Goals / Non-Goals

**Goals:**
- One place (the Rust `CwdTracker`) decides local vs remote and when a remote state ends; the frontend only renders.
- Remote state ends without naming programs (`ssh`, `docker`, `gh`): it follows the foreground process group.

**Non-Goals:**
- Starting remote sessions from tiili, reading `~/.ssh/config`, or running anything on the remote machine.
- A new pane opened from a remote pane still starts in the local shell's folder; it does not reconnect.

## Decisions

### 1. Keep the host and classify in Rust
`osc7_path` becomes a parser returning `{ host, path }` (host percent-decoded, path as today, including the Windows
drive handling). `CwdTracker` classifies: local when the host is empty, `localhost`, or matches the local hostname
case-insensitively in full or by first label; on Windows a path with no drive letter is never local and its host
becomes `WSL` when the host was local. The local hostname is read once per process (`libc::gethostname` on Unix,
`COMPUTERNAME` on Windows). Alternative: send the raw host to the frontend and decide there. Rejected: the local lookup
(`find_repo`) is in Rust and must be skipped before it runs.

`PaneCwd` gains `host: Option<String>` (`None` = local). For a remote pane, `repo` comes only from `tiili_repo`
(decision 2), with `root` the remote path and `name` its last segment (`/` or `\`). The `pane-cwd` payload gains
`host: string | null`.

### 2. Repository report through `OSC 1337 ; SetUserVar`
The scanner generalises from one introducer to two: `ESC ] 7 ;` and `ESC ] 1337 ; SetUserVar=`. Only the variable
`tiili_repo` is used; its value is base64 (standard alphabet, padding optional), decoded to UTF-8 lossily. The same
4096-byte cap, terminators (BEL, ST) and chunk-split handling apply. Alternative: a tiili-private OSC number.
Rejected: the user-var form is an existing convention (iTerm2, WezTerm) that other terminals already tolerate, and
the snippet can't tell it runs under tiili because `TERM_PROGRAM` is not forwarded over ssh by default.

### 3. Reports belong to the process group in front when they arrived
`feed_output` takes the current foreground (`Option<Foreground>`, read lazily as the command tracker already does).
The tracker stores, with the latest OSC 7, the foreground pgid at that moment. On each tick it is told the
foreground: when the shell's own pgid (its pid) is in front and the stored pgid was a different one, the OSC 7 and any
`tiili_repo` are dropped, `from_osc7` is cleared, and the next polled folder is reported (so the pane is local again
within one tick). An OSC 7 that arrived with the shell in front (local fish, tiili's integration) stays, as now.
Where the foreground can't be read (Windows), nothing is dropped and only a later OSC 7 replaces the remote one.
Alternative: match the foreground process name against `ssh`, `mosh-client`, `wsl`, … Rejected: a name list misses
`docker exec`, `gh codespace ssh`, `et`, and needs upkeep.

A local OSC 7 (decision 1) also ends a remote state directly on every platform, which is what tiili's prompt
integration relies on.

### 4. Tint keys
`TintAssigner.assign` keeps its rule; `showPlace` builds the key: local repository → `repo.root` (unchanged, so local
tints don't move); remote repository → `remote\0<host>\0<root>`; remote without repository → `remote\0<host>`. NUL
can't occur in a path or the cleaned host, so keys can't collide. The label is `chipLabel(`${host}:${name}`, command)`
where `name` is the repository name or `folderName(cwd)`.

### 5. Untrusted text
Host, path and repository text from a shell has C0/C1 control characters removed in Rust before it is sent, and
reaches the DOM only through `textContent`/`title` as today. For a remote pane no path is passed to `find_repo`,
`process_cwd`, or any spawn: the "new pane starts in the focused pane's folder" path keeps using `process_cwd(pid)`
of the local shell, never the remote folder.

### 6. Prompt integration sends OSC 7
- zsh: a `precmd` function added with `add-zsh-hook` after the user's `.zshrc`, printing
  `ESC]7;file://$HOST<percent-encoded $PWD>BEL`.
- bash: the same printf prepended to `PROMPT_COMMAND` (string or array form) after the user's files.
- PowerShell: wrap whatever `prompt` function is defined after the user's profile (tiili's own or the user's), write
  `ESC]7;file://<MachineName>/<C:/path with forward slashes>ESC\` with `[Console]::Write`, then return the wrapped
  prompt's output unchanged. Only FileSystem provider locations are reported.
Percent-encode at least `%`, space and non-ASCII bytes. The existing "user's prompt wins" checks are untouched.

### 7. Settings snippets
Snippets are constants in the frontend (one module, unit-tested for their exact text), shown in `<pre>` blocks in a
Remote shells group on the Behaviour tab after Panes, with a Copy button calling the backend's `writeClipboard`.
- bash/zsh: a function hooked like decision 6 that sends OSC 7 for `$PWD` and
  `ESC]1337;SetUserVar=tiili_repo=<base64 of git rev-parse --show-toplevel, or empty>BEL`.
- fish: the same in a `--on-event fish_prompt` function (`string escape --style=url`, `base64`/`openssl base64`).
`base64` output has newlines stripped (`tr -d '\n'`) for portability between GNU and BSD.

## Risks / Trade-offs

- [ConPTY may drop OSC sequences it does not understand on older Windows builds, so `tiili_repo` might not arrive]
  → Remote panes on Windows then fall back to the host tint; a task verifies on the Windows CI runner or by hand.
- [tmux or screen on the remote host swallow OSC 7 and user vars] → Out of scope; the pane shows the host only if
  the outer shell reported it. Documented in the snippet hint.
- [A remote host whose short name equals this machine's is taken as local] → Rare; the path test still catches the
  common WSL case. No mitigation now.
- [Windows with prompt Off stays remote after `exit`] → Accepted (proposal Assumptions); choosing any prompt fixes it.
- [`git rev-parse` on every prompt in the snippet adds latency on slow remote filesystems] → It already runs in most
  git-aware prompts; the snippet is opt-in.

## Migration Plan

None: no saved settings change, local panes behave as before, and the event payload grows by one field.
