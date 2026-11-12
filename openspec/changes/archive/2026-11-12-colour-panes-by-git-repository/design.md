## Approach

- **CWD tracking (Rust, `src-tauri/src/cwd.rs`)**: an OSC 7 parser (`file://host/path`, percent-decoded; Windows `/C:/x` → `C:\x`) scans PTY output in the reader thread. A poller per session reads the shell pid's cwd: macOS `proc_pidinfo(PROC_PIDVNODEPATHINFO)` (libc), Linux `read_link("/proc/<pid>/cwd")`, Windows none. OSC 7 wins when both report; changes emit `pane-cwd` events `{paneId, cwd}`.
- **Repo root (`src-tauri/src/repo.rs`)**: pure `find_repo_root(path) -> Option<PathBuf>` walking up until `.git` exists (dir or file). Result sent with the cwd event as `{root, name}`.
- **Tints (`src/tints.ts`)**: pure `TintAssigner` with `assign(root, openCounts)`: first 16 new roots get 1..16 in order; existing roots keep theirs; after 16, least-used (ties lowest). Frontend sets `--pane-tint`/`--pane-tint-on` from `var(--tint-N)`.
- **Chip (`src/paneChip.ts`)**: small label in pane title; neutral style uses `--surface`/`--muted`; Geist sans per brand rules.
- **Platform differences**: Windows only via OSC 7; the README documents PowerShell/cmd prompt snippets.

## Why

OSC 7 is accurate and cheap where shells emit it; polling makes macOS/Linux work with no setup. Pure root-finding and tint logic keeps the risky parts unit-testable.

## Risks

- Polling sees the foreground shell's cwd, not a child process's.
- Windows panes without OSC 7 don't follow `cd`.
