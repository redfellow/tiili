//! Shells on pseudo-terminals (ConPTY on Windows), one per pane, free of Tauri types so tests can
//! drive them.

use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

use crate::command::{CommandLineScanner, CommandTracker, Foreground, Running};
use crate::control::{PANE_VAR, SOCKET_VAR, TOKEN_VAR};
use crate::cwd::{CwdTracker, PaneCwd};

/// Called with each chunk the shell writes.
pub type OutputFn = Box<dyn FnMut(&[u8]) + Send>;
/// Called once after the shell has exited and its last output was delivered, with its exit code.
pub type ExitFn = Box<dyn FnOnce(u32) + Send>;

/// How long the exit notice waits for the shell's last output after the shell has exited. A
/// background job that outlives the shell keeps the pseudo-terminal open, so the reader may never
/// see end of file.
const LAST_OUTPUT_WAIT: Duration = Duration::from_millis(500);

/// How long a dropped session's shell has to end after its hangup before it is killed outright.
#[cfg(unix)]
const KILL_GRACE: Duration = Duration::from_secs(2);

/// The pseudo-terminal's master side; `None` once the shell has exited.
type SharedMaster = Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>;

/// Reads which process is in a session's foreground, from any thread.
#[derive(Clone)]
pub struct ForegroundReader(SharedMaster);

impl ForegroundReader {
    /// The pseudo-terminal's foreground process group and its leader's name, where the platform
    /// can read them (macOS and Linux) and the shell still runs.
    pub fn read(&self) -> Option<Foreground> {
        #[cfg(unix)]
        {
            let pgid = self.0.lock().ok()?.as_ref()?.process_group_leader()?;
            let name = crate::command::process_name(pgid)?;
            Some(Foreground { pgid, name })
        }
        #[cfg(not(unix))]
        {
            None
        }
    }
}

/// A running shell. Dropping the session ends the shell: a hangup, then SIGKILL on macOS and Linux if it
/// is still running after [`KILL_GRACE`].
pub struct PtySession {
    master: SharedMaster,
    /// Queue to the writer thread; `None` once the shell has exited.
    input: Arc<Mutex<Option<Sender<Vec<u8>>>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    pid: Option<u32>,
    /// Set as soon as the shell has been reaped: from then on its pid may belong to another process.
    exited: Arc<AtomicBool>,
    /// Set once the shell has shown a prompt through tiili's integration and redraws it on SIGUSR1 (zsh): before
    /// that, the signal could reach it ahead of the handler and end it.
    redraws: Arc<AtomicBool>,
}

/// What tiili's integration writes before every prompt (OSC 7): once seen, its startup files have loaded.
const INTEGRATION_PROMPT: &[u8] = b"\x1b]7;";

fn size(rows: u16, cols: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// What every shell tiili starts is told about the terminal: 256 colours in `TERM`, 24-bit colour in
/// `COLORTERM`, and which terminal this is. Run from a Linux AppImage (`APPDIR` set), it also takes
/// the AppImage's own entries out of the environment (see [`crate::appimage_env`]).
pub fn set_colour_env(cmd: &mut CommandBuilder) {
    let appdir = std::env::var("APPDIR").ok();
    let env = cmd
        .iter_full_env_as_str()
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect::<Vec<_>>();
    for edit in crate::appimage_env::scrub(appdir.as_deref(), env.into_iter()) {
        match edit {
            crate::appimage_env::EnvEdit::Set(key, value) => cmd.env(key, value),
            crate::appimage_env::EnvEdit::Remove(key) => cmd.env_remove(key),
        }
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "tiili");
    cmd.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));
}

/// What a pane runs instead of the default shell: `argv`, started directly, looked up on and run with `path`, the
/// `PATH` of whoever asked for it (the app's own when `None`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaneCommand {
    pub argv: Vec<String>,
    pub path: Option<OsString>,
}

/// The control channel every pane is told about (see [`crate::control`]): its endpoint, this run's token, and the
/// folder holding the `tiili` command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ControlEnv {
    pub socket: OsString,
    pub token: String,
    pub bin_dir: PathBuf,
}

/// Tells pane `id`'s process who it is in `TIILI_PANE` and, with `control`, where the control channel is
/// (`TIILI_SOCKET`, `TIILI_TOKEN`) with the `tiili` command's folder first on its `PATH`. `path`, when given,
/// replaces the `PATH` it would otherwise get.
pub fn set_pane_env(
    cmd: &mut CommandBuilder,
    id: SessionId,
    control: Option<&ControlEnv>,
    path: Option<&OsStr>,
) {
    cmd.env(PANE_VAR, id.to_string());
    let path = path
        .or_else(|| cmd.get_env("PATH"))
        .map(OsStr::to_os_string);
    let Some(control) = control else {
        if let Some(path) = path {
            cmd.env("PATH", path);
        }
        return;
    };
    cmd.env(SOCKET_VAR, &control.socket);
    cmd.env(TOKEN_VAR, &control.token);
    let rest = path
        .iter()
        .flat_map(std::env::split_paths)
        .filter(|dir| !dir.as_os_str().is_empty() && dir != &control.bin_dir);
    if let Ok(joined) = std::env::join_paths(std::iter::once(control.bin_dir.clone()).chain(rest)) {
        cmd.env("PATH", joined);
    }
}

/// How pane `id` starts in `cwd`: `command` when given, else the default shell with `prompt` through tiili's
/// integration (see [`PtySession::spawn_in`]), either way with the terminal's variables (see [`set_colour_env`])
/// and the pane's (see [`set_pane_env`]). With it comes whether the shell redraws its prompt on request.
pub fn pane_command(
    id: SessionId,
    cwd: Option<&Path>,
    prompt: &str,
    command: Option<&PaneCommand>,
    control: Option<&ControlEnv>,
) -> (CommandBuilder, bool) {
    let (mut cmd, redraws) = match command {
        Some(command) => (
            CommandBuilder::from_argv(command.argv.iter().map(OsString::from).collect()),
            false,
        ),
        None => {
            let dir = crate::shell_integration::default_dir();
            crate::shell_integration::shell_command(prompt, dir.as_deref())
        }
    };
    set_colour_env(&mut cmd);
    set_pane_env(
        &mut cmd,
        id,
        control,
        command.and_then(|c| c.path.as_deref()),
    );
    // portable-pty starts in the home folder when no cwd is set or the given one is not a folder.
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    (cmd, redraws)
}

fn to_io(err: impl std::fmt::Display) -> io::Error {
    io::Error::other(err.to_string())
}

fn gone() -> io::Error {
    io::Error::new(io::ErrorKind::BrokenPipe, "the shell has exited")
}

impl PtySession {
    /// Starts the user's default shell (`$SHELL` or `%COMSPEC%`) with `prompt` (see [`spawn_in`](Self::spawn_in)).
    pub fn spawn(
        prompt: &str,
        rows: u16,
        cols: u16,
        on_output: OutputFn,
        on_exit: ExitFn,
    ) -> io::Result<Self> {
        Self::spawn_in(None, prompt, rows, cols, on_output, on_exit)
    }

    /// Starts the user's default shell in `cwd`. Without `cwd`, or when it is not a folder, the
    /// shell starts in the home folder. zsh, bash and PowerShell start through tiili's shell
    /// integration, which sets `prompt` (Off included) where the user's own startup files left the
    /// default one, and follows later choices from [`set_prompt`]. Every shell gets
    /// `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=tiili` and `TERM_PROGRAM_VERSION`.
    pub fn spawn_in(
        cwd: Option<&Path>,
        prompt: &str,
        rows: u16,
        cols: u16,
        on_output: OutputFn,
        on_exit: ExitFn,
    ) -> io::Result<Self> {
        let dir = crate::shell_integration::default_dir();
        let (mut cmd, redraws) = crate::shell_integration::shell_command(prompt, dir.as_deref());
        set_colour_env(&mut cmd);
        // portable-pty starts the default shell in the home folder when no cwd is set or the
        // given one is not a folder.
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        Self::spawn_integrated(cmd, redraws, rows, cols, on_output, on_exit)
    }

    /// Like [`spawn_command`](Self::spawn_command), for a shell started through tiili's integration; with `redraws`
    /// (an integrated zsh) [`redraw_prompt`](Self::redraw_prompt) may signal it once it has shown its first prompt.
    pub fn spawn_integrated(
        cmd: CommandBuilder,
        redraws: bool,
        rows: u16,
        cols: u16,
        mut on_output: OutputFn,
        on_exit: ExitFn,
    ) -> io::Result<Self> {
        let ready = Arc::new(AtomicBool::new(false));
        let output_ready = Arc::clone(&ready);
        let watched = Box::new(move |data: &[u8]| {
            if redraws
                && !output_ready.load(Ordering::Relaxed)
                && data
                    .windows(INTEGRATION_PROMPT.len())
                    .any(|w| w == INTEGRATION_PROMPT)
            {
                output_ready.store(true, Ordering::Relaxed);
            }
            on_output(data)
        });
        let mut session = Self::spawn_command(cmd, rows, cols, watched, on_exit)?;
        session.redraws = ready;
        Ok(session)
    }

    /// Starts `cmd` on a new pseudo-terminal of `rows` x `cols`.
    pub fn spawn_command(
        cmd: CommandBuilder,
        rows: u16,
        cols: u16,
        mut on_output: OutputFn,
        on_exit: ExitFn,
    ) -> io::Result<Self> {
        let pair = native_pty_system()
            .openpty(size(rows, cols))
            .map_err(to_io)?;
        let mut child = pair.slave.spawn_command(cmd).map_err(to_io)?;
        // Close our copy of the slave side so the reader sees end of file once the shell is gone.
        drop(pair.slave);

        let killer = child.clone_killer();
        let pid = child.process_id();
        let mut reader = pair.master.try_clone_reader().map_err(to_io)?;
        let mut writer = pair.master.take_writer().map_err(to_io)?;
        let master = Arc::new(Mutex::new(Some(pair.master)));

        // Writes happen on their own thread, in order, so a shell that is not reading its input
        // never blocks the caller.
        let (input_tx, input_rx) = mpsc::channel::<Vec<u8>>();
        thread::Builder::new()
            .name("pty-writer".into())
            .spawn(move || {
                for data in input_rx {
                    if writer
                        .write_all(&data)
                        .and_then(|_| writer.flush())
                        .is_err()
                    {
                        break;
                    }
                }
            })?;
        let input = Arc::new(Mutex::new(Some(input_tx)));

        let (read_done_tx, read_done_rx) = mpsc::channel::<()>();
        thread::Builder::new()
            .name("pty-reader".into())
            .spawn(move || {
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => on_output(&buf[..n]),
                        Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                        Err(_) => break,
                    }
                }
                let _ = read_done_tx.send(());
            })?;

        let exited = Arc::new(AtomicBool::new(false));
        let waiter_exited = Arc::clone(&exited);
        let waiter_master = Arc::clone(&master);
        let waiter_input = Arc::clone(&input);
        thread::Builder::new()
            .name("pty-waiter".into())
            .spawn(move || {
                let code = child.wait().map(|s| s.exit_code()).unwrap_or(1);
                waiter_exited.store(true, Ordering::SeqCst);
                // Further writes fail; the writer thread ends once its queue is drained.
                drop(waiter_input.lock().ok().and_then(|mut i| i.take()));
                // Closing the pseudo-terminal lets the reader finish (ConPTY only ends its output then).
                drop(waiter_master.lock().ok().and_then(|mut m| m.take()));
                let _ = read_done_rx.recv_timeout(LAST_OUTPUT_WAIT);
                on_exit(code);
            })?;

        Ok(Self {
            master,
            input,
            killer,
            pid,
            exited,
            redraws: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Queues input for the shell, in order; never blocks on the shell. Fails once the shell has exited.
    pub fn write(&self, data: &[u8]) -> io::Result<()> {
        let guard = self.input.lock().map_err(to_io)?;
        let input = guard.as_ref().ok_or_else(gone)?;
        input.send(data.to_vec()).map_err(|_| gone())
    }

    /// The shell's process id, when the platform reports one and the shell has not exited yet.
    pub fn pid(&self) -> Option<u32> {
        if self.exited.load(Ordering::SeqCst) {
            None
        } else {
            self.pid
        }
    }

    /// Asks the shell to redraw its prompt now, after the prompt choice changed: SIGUSR1 to an integrated zsh that
    /// has shown its first prompt and still catches the signal, on macOS and Linux. Whatever has replaced it
    /// (`exec`), a process whose handlers cannot be read and other shells are sent nothing; shells switch at their
    /// next prompt. Returns whether the signal was sent.
    pub fn redraw_prompt(&self) -> bool {
        #[cfg(unix)]
        if self.redraws.load(Ordering::Relaxed) {
            if let Some(pid) = self.pid() {
                // The default action of SIGUSR1 ends the process: only one with a handler gets it.
                if crate::command::catches_signal(pid, libc::SIGUSR1) == Some(true) {
                    if let Ok(pid) = libc::pid_t::try_from(pid) {
                        // SAFETY: kill only sends a signal; the pid is this session's own shell.
                        return unsafe { libc::kill(pid, libc::SIGUSR1) } == 0;
                    }
                }
            }
        }
        false
    }

    /// Reads which process is in this session's foreground.
    pub fn foreground_reader(&self) -> ForegroundReader {
        ForegroundReader(Arc::clone(&self.master))
    }

    /// Tells the shell the terminal now has `rows` x `cols`.
    pub fn resize(&self, rows: u16, cols: u16) -> io::Result<()> {
        let guard = self.master.lock().map_err(to_io)?;
        let master = guard.as_ref().ok_or_else(gone)?;
        master.resize(size(rows, cols)).map_err(to_io)
    }
}

impl Drop for PtySession {
    /// Hangs up on a shell that still runs and closes the pseudo-terminal; on macOS and Linux a shell
    /// that is still running [`KILL_GRACE`] later is killed outright.
    fn drop(&mut self) {
        if self.exited.load(Ordering::SeqCst) {
            return;
        }
        let _ = self.killer.kill();
        drop(self.master.lock().ok().and_then(|mut m| m.take()));
        #[cfg(unix)]
        if let Some(pid) = self.pid.and_then(|p| libc::pid_t::try_from(p).ok()) {
            let exited = Arc::clone(&self.exited);
            let _ = thread::Builder::new()
                .name("pty-reap".into())
                .spawn(move || {
                    thread::sleep(KILL_GRACE);
                    if !exited.load(Ordering::SeqCst) {
                        // The shell leads its session, so its process group id is its pid: the
                        // group also holds the commands it started that ignore the hangup too.
                        // SAFETY: kill only sends a signal; the shell has not been reaped, so the
                        // pid is still its own.
                        if unsafe { libc::kill(-pid, libc::SIGKILL) } != 0 {
                            // SAFETY: as above.
                            unsafe { libc::kill(pid, libc::SIGKILL) };
                        }
                    }
                });
        }
    }
}

/// Makes `prompt` the current choice for the shells tiili integrates: written to the integration folder, which they
/// read before every prompt, and each of `sessions` that can redraw an idle prompt is asked to.
pub fn set_prompt<'a>(
    prompt: &str,
    sessions: impl IntoIterator<Item = &'a PtySession>,
) -> io::Result<()> {
    let dir = crate::shell_integration::default_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no cache folder"))?;
    crate::shell_integration::write_prompt(&dir, prompt)?;
    for session in sessions {
        session.redraw_prompt();
    }
    Ok(())
}

/// Makes `colour` (`#RRGGBB`) the one integrated zsh and bash 5.1+ shells give pasted text from their next prompt on.
pub fn set_highlight(colour: &str) -> io::Result<()> {
    let dir = crate::shell_integration::default_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no cache folder"))?;
    crate::shell_integration::write_highlight(&dir, colour)
}

/// Runs every tick about once a second while `alive` holds, on macOS and Linux; elsewhere neither
/// the working directory nor the foreground process can be read, so it does nothing.
fn poll(mut ticks: Vec<Box<dyn FnMut() + Send>>, alive: Arc<AtomicBool>) -> io::Result<()> {
    if ticks.is_empty() || cfg!(not(any(target_os = "linux", target_os = "macos"))) {
        return Ok(());
    }
    thread::Builder::new()
        .name("pty-poll".into())
        .spawn(move || {
            while alive.load(Ordering::Relaxed) {
                ticks.iter_mut().for_each(|tick| tick());
                thread::sleep(POLL_INTERVAL);
            }
        })?;
    Ok(())
}

/// Identifies one session in a [`SessionRegistry`].
pub type SessionId = u32;

/// Called with the session's id and each chunk its shell writes.
pub type SessionOutputFn = Box<dyn FnMut(SessionId, &[u8]) + Send>;
/// Called once with the session's id and exit code after its shell has exited.
pub type SessionExitFn = Box<dyn FnOnce(SessionId, u32) + Send>;
/// Called with the session's id whenever its shell's working directory or repository changes.
pub type SessionCwdFn = Box<dyn FnMut(SessionId, &PaneCwd) + Send>;
/// Called with the session's id whenever what runs in its pane changes: the title the foreground
/// program set, else the foreground process's name, else the shell's name.
pub type SessionCommandFn = Box<dyn FnMut(SessionId, &str) + Send>;

/// How often a shell's working directory and foreground process are read on macOS and Linux.
const POLL_INTERVAL: Duration = crate::cwd::POLL_INTERVAL;

/// The home folder, where a shell starts when given no folder.
fn home_dir() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

fn unknown(id: SessionId) -> io::Error {
    io::Error::new(io::ErrorKind::NotFound, format!("no session {id}"))
}

/// Every shell in the window, keyed by session id. Ids are never reused.
#[derive(Default)]
pub struct SessionRegistry {
    next_id: AtomicU32,
    sessions: Mutex<HashMap<SessionId, PtySession>>,
    /// The command line each session's shell reported running, by session.
    lines: Mutex<HashMap<SessionId, Arc<Mutex<CommandLineScanner>>>>,
    control: OnceLock<ControlEnv>,
    /// The user's own folder restored history lines are handed to shells in; none are handed over until it is set.
    history_dir: OnceLock<PathBuf>,
}

/// The environment variable naming the file whose text tiili's shell integration adds to the shell's history and
/// then deletes.
pub const RESTORE_HISTORY_VAR: &str = "TIILI_RESTORE_HISTORY";

/// Writes `line` to a new file in `dir` (created readable by the user only) that only the user can read, for
/// session `id`'s shell to add to its history. The file is created exclusively: a file or link already at its
/// name is removed first, and one that appears in between makes the write fail rather than follow it.
pub fn history_file(dir: &Path, id: SessionId, line: &str) -> io::Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
        options.mode(0o600);
    }
    let path = dir.join(format!("{}-{id}", std::process::id()));
    match std::fs::remove_file(&path) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
        _ => {}
    }
    let written = options
        .open(&path)
        .and_then(|mut file| file.write_all(line.as_bytes()));
    if let Err(e) = written {
        let _ = std::fs::remove_file(&path);
        return Err(e);
    }
    Ok(path)
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Hands restored history lines to shells through files in `dir`, which only the user can read.
    pub fn set_history_dir(&self, dir: PathBuf) {
        let _ = self.history_dir.set(dir);
    }

    /// Starts a default shell in `cwd` (home folder when `None` or unreadable) with `prompt` (see
    /// [`PtySession::spawn_in`]) and returns its id.
    pub fn spawn(
        &self,
        cwd: Option<&Path>,
        prompt: &str,
        rows: u16,
        cols: u16,
        on_output: SessionOutputFn,
        on_exit: SessionExitFn,
    ) -> io::Result<SessionId> {
        self.spawn_tracked(
            cwd, prompt, None, rows, cols, on_output, None, None, on_exit,
        )
    }

    /// Tells every pane started from now on about the control channel (see [`set_pane_env`]). Only the first call
    /// counts.
    pub fn set_control(&self, control: ControlEnv) {
        let _ = self.control.set(control);
    }

    /// Like [`spawn`](Self::spawn), running `command` directly instead of the shell when given (its exit ends the
    /// session as a shell's does), and with `on_cwd` follows the shell's working directory and
    /// repository: first the folder it starts in, then OSC 7 from the shell on every platform and,
    /// on macOS and Linux, the shell process's working directory about once a second. An OSC 7
    /// naming another host makes the pane remote until a local one arrives or, on macOS and Linux,
    /// the shell is back in front. With
    /// `on_command` it follows what runs in the pane: titles from OSC 0 and 2 and, on macOS and
    /// Linux, the foreground process about once a second.
    #[allow(clippy::too_many_arguments)]
    pub fn spawn_tracked(
        &self,
        cwd: Option<&Path>,
        prompt: &str,
        command: Option<&PaneCommand>,
        rows: u16,
        cols: u16,
        on_output: SessionOutputFn,
        on_cwd: Option<SessionCwdFn>,
        on_command: Option<SessionCommandFn>,
        on_exit: SessionExitFn,
    ) -> io::Result<SessionId> {
        self.spawn_restored(
            cwd, prompt, command, None, rows, cols, on_output, on_cwd, on_command, on_exit,
        )
    }

    /// Like [`spawn_tracked`](Self::spawn_tracked); with `history`, a shell with tiili's zsh, bash or PowerShell
    /// integration starts with that line as the newest entry of its history, so Up then Enter runs it again.
    #[allow(clippy::too_many_arguments)]
    pub fn spawn_restored(
        &self,
        cwd: Option<&Path>,
        prompt: &str,
        command: Option<&PaneCommand>,
        history: Option<&str>,
        rows: u16,
        cols: u16,
        mut on_output: SessionOutputFn,
        on_cwd: Option<SessionCwdFn>,
        on_command: Option<SessionCommandFn>,
        on_exit: SessionExitFn,
    ) -> io::Result<SessionId> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let tracker = on_cwd.map(|mut on_cwd| {
            Arc::new(Mutex::new(CwdTracker::new(Box::new(move |c| {
                on_cwd(id, c)
            }))))
        });
        let output_tracker = tracker.clone();
        let commands = on_command.map(|mut on_command| {
            let name = command
                .and_then(|c| c.argv.first())
                .and_then(|program| Path::new(program).file_name())
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(crate::command::shell_name);
            Arc::new(Mutex::new(CommandTracker::new(
                name,
                Box::new(move |c| on_command(id, c)),
            )))
        });
        let output_commands = commands.clone();
        // Filled once the session exists; output before then finds nobody in front yet.
        let reader: Arc<OnceLock<ForegroundReader>> = Arc::new(OnceLock::new());
        let output_reader = Arc::clone(&reader);
        let alive = Arc::new(AtomicBool::new(true));
        let exit_alive = Arc::clone(&alive);
        let (mut cmd, redraws) = pane_command(id, cwd, prompt, command, self.control.get());
        // The integration deletes the file once read; one a shell without it leaves goes when the session ends.
        let history = match (
            history.filter(|l| command.is_none() && !l.trim().is_empty()),
            self.history_dir.get(),
        ) {
            (Some(line), Some(dir)) => Some(history_file(dir, id, line)?),
            _ => None,
        };
        if let Some(path) = &history {
            cmd.env(RESTORE_HISTORY_VAR, path);
        }
        let exit_history = history.clone();
        let lines = Arc::new(Mutex::new(CommandLineScanner::default()));
        let output_lines = Arc::clone(&lines);
        let session = PtySession::spawn_integrated(
            cmd,
            redraws,
            rows,
            cols,
            Box::new(move |data| {
                if let Some(Ok(mut tracker)) = output_tracker.as_ref().map(|t| t.lock()) {
                    tracker.feed_output(data, || output_reader.get().and_then(|r| r.read()));
                }
                if let Some(Ok(mut commands)) = output_commands.as_ref().map(|t| t.lock()) {
                    commands.feed_output(data, || output_reader.get().and_then(|r| r.read()));
                }
                if let Ok(mut lines) = output_lines.lock() {
                    lines.feed(data);
                }
                on_output(id, data)
            }),
            Box::new(move |code| {
                exit_alive.store(false, Ordering::Relaxed);
                if let Some(path) = &exit_history {
                    let _ = std::fs::remove_file(path);
                }
                on_exit(id, code)
            }),
        )
        .inspect_err(|_| {
            if let Some(path) = &history {
                let _ = std::fs::remove_file(path);
            }
        })?;
        let _ = reader.set(session.foreground_reader());
        let mut ticks: Vec<Box<dyn FnMut() + Send>> = Vec::new();
        if let Some(tracker) = tracker {
            // Where the platform cannot read the shell's folder, the pane keeps this one until OSC 7.
            let start = cwd
                .filter(|d| d.is_dir())
                .map(Path::to_path_buf)
                .or_else(home_dir);
            let pid = session.pid();
            if let Ok(mut t) = tracker.lock() {
                // The shell leads its session, so its process group id is its pid.
                if let Some(pgid) = pid.and_then(|p| i32::try_from(p).ok()) {
                    t.set_shell_pgid(pgid);
                }
                if let Some(dir) = start {
                    t.report_polled(dir);
                }
            }
            if let Some(pid) = pid {
                let reader = session.foreground_reader();
                ticks.push(Box::new(move || {
                    // Who is in front first: a remote report ends once the shell is back there.
                    let foreground = reader.read();
                    let dir = crate::cwd::process_cwd(pid);
                    if let Ok(mut tracker) = tracker.lock() {
                        tracker.report_foreground(foreground.as_ref());
                        if let Some(dir) = dir {
                            tracker.report_polled(dir);
                        }
                    }
                }));
            }
        }
        if let Some(commands) = commands {
            let reader = session.foreground_reader();
            ticks.push(Box::new(move || {
                let foreground = reader.read();
                if let Ok(mut commands) = commands.lock() {
                    commands.report_foreground(foreground);
                }
            }));
        }
        poll(ticks, alive)?;
        self.lines.lock().map_err(to_io)?.insert(id, lines);
        self.sessions.lock().map_err(to_io)?.insert(id, session);
        Ok(id)
    }

    fn with<T>(
        &self,
        id: SessionId,
        f: impl FnOnce(&PtySession) -> io::Result<T>,
    ) -> io::Result<T> {
        let sessions = self.sessions.lock().map_err(to_io)?;
        f(sessions.get(&id).ok_or_else(|| unknown(id))?)
    }

    /// Queues input for session `id`'s shell.
    pub fn write(&self, id: SessionId, data: &[u8]) -> io::Result<()> {
        self.with(id, |s| s.write(data))
    }

    /// Tells session `id`'s shell its terminal now has `rows` x `cols`.
    pub fn resize(&self, id: SessionId, rows: u16, cols: u16) -> io::Result<()> {
        self.with(id, |s| s.resize(rows, cols))
    }

    /// Removes session `id`, killing its shell if it still runs. Closing an unknown id does nothing.
    pub fn close(&self, id: SessionId) -> io::Result<()> {
        self.lines.lock().map_err(to_io)?.remove(&id);
        let removed = self.sessions.lock().map_err(to_io)?.remove(&id);
        // Dropped outside the lock: killing the shell must not hold up the other sessions.
        drop(removed);
        Ok(())
    }

    /// What runs in session `id`: the command line its shell reported, and the foreground program's name when
    /// that is not the shell itself (macOS and Linux).
    pub fn running(&self, id: SessionId) -> io::Result<Running> {
        let command = self
            .lines
            .lock()
            .map_err(to_io)?
            .get(&id)
            .and_then(|l| l.lock().ok()?.line().map(str::to_string));
        self.with(id, |s| {
            let shell = s.pid().and_then(|p| i32::try_from(p).ok());
            let program = s
                .foreground_reader()
                .read()
                .filter(|f| Some(f.pgid) != shell)
                .map(|f| f.name);
            Ok(Running { command, program })
        })
    }

    /// The working directory of session `id`'s shell, where the platform can read it.
    pub fn cwd(&self, id: SessionId) -> io::Result<Option<PathBuf>> {
        self.with(id, |s| Ok(s.pid().and_then(crate::cwd::process_cwd)))
    }

    /// Makes `prompt` the current choice for every integrated shell, open ones included (see [`set_prompt`]).
    pub fn set_prompt(&self, prompt: &str) -> io::Result<()> {
        let sessions = self.sessions.lock().map_err(to_io)?;
        set_prompt(prompt, sessions.values())
    }

    /// How many sessions are open.
    pub fn len(&self) -> usize {
        self.sessions.lock().map(|s| s.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    #[cfg(unix)]
    #[test]
    fn restored_history_is_written_privately_and_never_through_a_planted_link() {
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(format!("tiili-history-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let dir = root.join("history");
        let target = root.join("target");
        let planted = dir.join(format!("{}-1", std::process::id()));
        // (name, plant a link at the file's name first)
        for (name, plant) in [("fresh folder", false), ("planted link", true)] {
            if plant {
                std::fs::remove_file(&planted).unwrap();
                std::fs::write(&target, "kept").unwrap();
                std::os::unix::fs::symlink(&target, &planted).unwrap();
            }
            let path = super::history_file(&dir, 1, "npm run dev").unwrap();
            assert_eq!(
                std::fs::read_to_string(&path).unwrap(),
                "npm run dev",
                "{name}"
            );
            assert!(
                !std::fs::symlink_metadata(&path)
                    .unwrap()
                    .file_type()
                    .is_symlink(),
                "{name}"
            );
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600,
                "{name}"
            );
            assert_eq!(
                std::fs::metadata(&dir).unwrap().permissions().mode() & 0o777,
                0o700,
                "{name}"
            );
            if plant {
                assert_eq!(std::fs::read_to_string(&target).unwrap(), "kept", "{name}");
            }
        }
        std::fs::remove_dir_all(&root).unwrap();
    }
}
