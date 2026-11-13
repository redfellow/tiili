# Tasks

## 1. OSC 7 host and the user-variable report (Rust, `src-tauri/src/cwd.rs`)

- [ ] 1.1 Replace `osc7_path` with a parser returning host and path (host percent-decoded; Windows drive handling unchanged) and extend the `osc7_paths` table with host cases (`file://build-box/x`, `file:///x`, `file://localhost/x`, encoded host)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [ ] 1.2 Generalise `Osc7Scanner` to also find `ESC ] 1337 ; SetUserVar=tiili_repo=<base64>` (BEL or ST, split across chunks, 4096-byte cap, other user vars ignored, bad base64 ignored, empty value = no repository) with table cases next to `osc7_in_output`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [ ] 1.3 Add the local-host check (empty, `localhost`, local hostname in full or by first label, case-insensitive; `libc::gethostname` on Unix, `COMPUTERNAME` on Windows) and the Windows driveless-path rule labelling `WSL`, with unit tests that inject the local name
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [ ] 1.4 Strip C0/C1 control characters from host, path and repository text and cover it with a test case of a hostile host
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`

## 2. Remote state in `CwdTracker`

- [ ] 2.1 Add `host: Option<String>` to `PaneCwd`; for a remote report skip `find_repo` and take the repository only from `tiili_repo` (name = last segment); ignore `tiili_repo` while local; a pane going remote starts with no repository; unit tests for each `repository-colours` Remote panes / Remote repository report scenario
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [ ] 2.2 Record the foreground process group with each OSC 7; add a foreground report to the tracker that, when the shell's own pgid is back in front and the OSC 7 came from another group, drops the OSC 7 and repository, clears the OSC 7 latch and reports the next polled folder; a local OSC 7 ends a remote state at once; unit tests for "Exit ssh", "local fish runs vim" and "no foreground (Windows) keeps remote until a local OSC 7"
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [ ] 2.3 Wire it in `src-tauri/src/pty.rs` `spawn_tracked`: pass the lazily read foreground to `feed_output`, pass the shell's pid as its pgid, and report the foreground to the cwd tracker on each tick (before the polled folder); serialise `host` in the `pane-cwd` event
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- [ ] 2.4 Add a host-tier integration test in `src-tauri/tests/repo_tracking.rs` (macOS and Linux): a shell runs a child that prints a remote OSC 7 and `tiili_repo`, then exits; the registry reports the remote host and repository, then the local folder and repository within the timeout
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking -- --include-ignored`

## 3. Chip and tints (TypeScript)

- [ ] 3.1 Add `host: string | null` to `PaneCwd` in `src/paneChip.ts` and a helper for the remote place label (`host:name`), with cases in `src/paneChip.test.ts` (repository, folder, WSL, Windows-style remote path)
  - proof: `npx vitest run src/paneChip.test.ts`
- [ ] 3.2 Build tint keys in `src/panes.ts` `showPlace` (local root unchanged; `remote\0host\0root`; `remote\0host`), tint remote panes without a repository by host, and add cases to `src/tints.test.ts` showing remote keys never share a tint with a local root or another host's same path
  - proof: `npx vitest run src/tints.test.ts src/paneChip.test.ts`
  - proof: `npm run typecheck`
  - proof: `npm run lint`

## 4. Prompt integration sends OSC 7

- [ ] 4.1 zsh (`zshrc.zsh`, `add-zsh-hook precmd`) and bash (`tiili.bash`, prepend to `PROMPT_COMMAND` in string or array form) send percent-encoded OSC 7 with the hostname before every prompt, after the user's files, keeping the user's prompt and hooks; extend `src-tauri/tests/pty_session.rs` so a Classic zsh and bash, with and without their own PROMPT/PS1, report a `cd /tmp` through OSC 7
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session -- --include-ignored`
- [ ] 4.2 PowerShell (`tiili.ps1`): wrap whichever `prompt` exists after the profile (tiili's or the user's) to write OSC 7 `file://<MachineName>/C:/…` for FileSystem locations and return the wrapped output unchanged; a Windows-only case in `pty_session.rs` (or a `#[cfg(windows)]` test) checks the report
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session -- --include-ignored`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 5. Remote shells in Settings

- [ ] 5.1 Add the bash, zsh and fish snippets as constants in a new `src/remoteSnippets.ts` (OSC 7 + `tiili_repo` per design decision 7) with `src/remoteSnippets.test.ts` checking each contains the OSC 7 and SetUserVar sequences and strips base64 newlines; check by hand that each snippet, sourced in its shell, prints the expected bytes (`script -q` / `cat -v`)
  - proof: `npx vitest run src/remoteSnippets.test.ts`
- [ ] 5.2 Add the Remote shells group to the Behaviour tab after Panes in `src/settingsDialog.ts` (hint text, one read-only `<pre>` per shell, Copy buttons through `writeClipboard`, tooltip and focus like other dialogue buttons, styles from `docs/brand/tiili.css` tokens); it saves nothing and Cancel/Save are unaffected
  - proof: `npm run typecheck`
  - proof: `npm run lint`
  - proof: `npm test`

## Manual checks after merge (The user)

- macOS: `ssh` to a host with the zsh snippet; the chip reads `host:repo` in a remote tint; `cd` out of the repo shows `host:folder` in the host tint; `exit` returns to the local folder and tint within a second.
- macOS: `ssh` to a host *without* the snippet but with fish; the pane shows `host:folder` in a host tint and is not tinted as a local repo with the same path.
- Linux: the same ssh round trip.
- Windows with a Classic prompt: `ssh` round trip; after `exit` the next prompt makes the pane local. Note whether `tiili_repo` arrives through ConPTY (else the remote pane keeps its host tint).
- Windows: a WSL shell with the bash snippet shows `WSL:<folder>`.
- Settings > Behaviour > Remote shells: each Copy button puts its snippet on the clipboard.
