# Proposal

## Why

A shell on another machine (reached with `ssh`, a devcontainer, a codespace or WSL) that reports its folder with
OSC 7 gets that folder looked up on the local disk: `osc7_path` (`src-tauri/src/cwd.rs`) drops the host from
`file://HOST/path`, so the pane is tinted as a local repository with the same path, or shown as a neutral local
folder. Once OSC 7 has been seen, polling is ignored for the life of the pane, so after `exit` the remote folder
sticks. The user and their agents work both on servers and in git repositories on remote machines, so remote panes
should be told apart by host and, where possible, by repository, the way local panes are.

## What Changes

- OSC 7 keeps its host. A report whose host is not this machine, or (on Windows) whose path has no drive letter,
  makes the pane **remote**: no local repository lookup, the chip shows `host:place`, and the pane is tinted.
- Remote panes are tinted per host and repository when the remote shell reports its git root, otherwise per host.
- A remote shell reports its git root with `OSC 1337 ; SetUserVar=tiili_repo=<base64 path>`, sent by a small snippet
  the user adds to the remote machine's shell startup file. Everything a remote shell sends is only displayed.
- A remote state ends when the shell is back in front (macOS and Linux: the pseudo-terminal's foreground process
  group is the shell's again) or when a local OSC 7 arrives; the pane then follows its local folder again. This also
  fixes the stuck folder after `exit` for every OSC 7 that came from a program other than the shell.
- tiili's prompt integration (zsh, bash, PowerShell; any prompt but Off) makes the shell send OSC 7 at each prompt,
  whatever prompt ends up shown, so a pane learns it is local again on every platform, Windows included.
- Settings gets a "Remote shells" section on the Behaviour tab with the snippet for bash, zsh and fish, each with a
  Copy button.
- Out of scope: a "New remote pane" that lists `~/.ssh/config` hosts (a later change), mosh (it strips OSC 7), a
  built-in SSH client, tmux passthrough on the remote, and mapping WSL paths to `\\wsl.localhost\…`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repository-colours`: panes follow OSC 7's host; remote panes, their chip and their tint; how a remote state ends.
- `terminal-session`: prompt shell integration also reports the working folder with OSC 7 at every prompt.
- `settings`: a Remote shells section on the Behaviour tab with copyable snippets.

## Impact

- Rust: `src-tauri/src/cwd.rs` (OSC 7 host, the user-var scanner, the remote state and when it ends), `src-tauri/src/pty.rs`
  (foreground reads feed the cwd tracker, the shell's own process group), a small local-hostname helper, the
  `pane-cwd` event payload (adds `host`).
- Shell integration: `src-tauri/src/shell_integration/{zsh,bash,pwsh}` gain an OSC 7 hook.
- TypeScript: `src/paneChip.ts` (payload, `host:place` label), `src/panes.ts` and `src/tints.ts` (tint keys for remote
  panes), the settings dialogue (Remote shells section, clipboard copy).
- No new dependencies are expected; the hostname comes from the OS (`gethostname` on Unix via `libc`, `COMPUTERNAME`
  on Windows).

## Assumptions

- With the prompt setting Off, tiili still starts shells unmodified, so on Windows (no foreground reading) a pane that
  went remote stays remote after `exit` until a local OSC 7 arrives. Ruled out: sending OSC 7 even with Off, which
  would break the "Off starts the shell unchanged" contract.
- A host counts as this machine when it is empty, `localhost`, or matches the local hostname case-insensitively,
  in full or by its first label (`mac.local` = `mac`). Ruled out: resolving names over DNS.
- WSL is recognised by its path (no drive letter on Windows), labelled with its OSC 7 host when that is not this
  machine, else `WSL`. Ruled out: detecting `wsl.exe`, which Windows cannot see as a foreground process.
- The remote repo report reuses the iTerm2/WezTerm user-variable sequence rather than a tiili-private OSC, so other
  terminals that understand it ignore or store it harmlessly.
- A remote pane outside any repository is tinted by its host (unlike a local pane outside a repository, which stays
  untinted), so remote hosts are told apart at a glance.
