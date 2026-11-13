//! Shells on pseudo-terminals (ConPTY on Windows), one per pane, free of Tauri types so tests can
//! drive them.

use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

use crate::command::{CommandTracker, Foreground};
use crate::cwd::{CwdTracker, PaneCwd};

/// Called with each chunk the shell writes.
pub type OutputFn = Box<dyn FnMut(&[u8]) + Send>;
/// Called once after the shell has exited and its last output was delivered, with its exit code.
pub type ExitFn = Box<dyn FnOnce(u32) + Send>;

/// How long the exit notice waits for the shell's last output after the shell has exited. A
/// background job that outlives the shell keeps the pseudo-terminal open, so the reader may never
/// see end of file.
const LAST_OUTPUT_WAIT: Duration = Duration::from_millis(500);

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

/// A running shell. Dropping the session kills the shell.
pub struct PtySession {
    master: SharedMaster,
    /// Queue to the writer thread; `None` once the shell has exited.
    input: Arc<Mutex<Option<Sender<Vec<u8>>>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    pid: Option<u32>,
}

fn size(rows: u16, cols: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// What every shell tiili starts is told about the terminal: 256 colours in `TERM`, 24-bit colour in
/// `COLORTERM`, and which terminal this is.
pub fn set_colour_env(cmd: &mut CommandBuilder) {
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "tiili");
    cmd.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));
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
    /// shell starts in the home folder. With a `prompt` other than `off`, zsh, bash and PowerShell
    /// start through tiili's shell integration, which sets that prompt where the user's own startup
    /// files left the default one. Every shell gets `TERM=xterm-256color`, `COLORTERM=truecolor`,
    /// `TERM_PROGRAM=tiili` and `TERM_PROGRAM_VERSION`.
    pub fn spawn_in(
        cwd: Option<&Path>,
        prompt: &str,
        rows: u16,
        cols: u16,
        on_output: OutputFn,
        on_exit: ExitFn,
    ) -> io::Result<Self> {
        let dir = if prompt == crate::shell_integration::PROMPT_OFF {
            None
        } else {
            crate::shell_integration::default_dir()
        };
        let mut cmd = crate::shell_integration::shell_command(prompt, dir.as_deref());
        set_colour_env(&mut cmd);
        // portable-pty starts the default shell in the home folder when no cwd is set or the
        // given one is not a folder.
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        Self::spawn_command(cmd, rows, cols, on_output, on_exit)
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

        let waiter_master = Arc::clone(&master);
        let waiter_input = Arc::clone(&input);
        thread::Builder::new()
            .name("pty-waiter".into())
            .spawn(move || {
                let code = child.wait().map(|s| s.exit_code()).unwrap_or(1);
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
        })
    }

    /// Queues input for the shell, in order; never blocks on the shell. Fails once the shell has exited.
    pub fn write(&self, data: &[u8]) -> io::Result<()> {
        let guard = self.input.lock().map_err(to_io)?;
        let input = guard.as_ref().ok_or_else(gone)?;
        input.send(data.to_vec()).map_err(|_| gone())
    }

    /// The shell's process id, when the platform reports one.
    pub fn pid(&self) -> Option<u32> {
        self.pid
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
    fn drop(&mut self) {
        let _ = self.killer.kill();
    }
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
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self::default()
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
        self.spawn_tracked(cwd, prompt, rows, cols, on_output, None, None, on_exit)
    }

    /// Like [`spawn`](Self::spawn), and with `on_cwd` follows the shell's working directory and
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
            Arc::new(Mutex::new(CommandTracker::new(
                crate::command::shell_name(),
                Box::new(move |c| on_command(id, c)),
            )))
        });
        let output_commands = commands.clone();
        // Filled once the session exists; output before then finds nobody in front yet.
        let reader: Arc<OnceLock<ForegroundReader>> = Arc::new(OnceLock::new());
        let output_reader = Arc::clone(&reader);
        let alive = Arc::new(AtomicBool::new(true));
        let exit_alive = Arc::clone(&alive);
        let session = PtySession::spawn_in(
            cwd,
            prompt,
            rows,
            cols,
            Box::new(move |data| {
                if let Some(Ok(mut tracker)) = output_tracker.as_ref().map(|t| t.lock()) {
                    tracker.feed_output(data, || output_reader.get().and_then(|r| r.read()));
                }
                if let Some(Ok(mut commands)) = output_commands.as_ref().map(|t| t.lock()) {
                    commands.feed_output(data, || output_reader.get().and_then(|r| r.read()));
                }
                on_output(id, data)
            }),
            Box::new(move |code| {
                exit_alive.store(false, Ordering::Relaxed);
                on_exit(id, code)
            }),
        )?;
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
        let removed = self.sessions.lock().map_err(to_io)?.remove(&id);
        // Dropped outside the lock: killing the shell must not hold up the other sessions.
        drop(removed);
        Ok(())
    }

    /// The working directory of session `id`'s shell, where the platform can read it.
    pub fn cwd(&self, id: SessionId) -> io::Result<Option<PathBuf>> {
        self.with(id, |s| Ok(s.pid().and_then(crate::cwd::process_cwd)))
    }

    /// How many sessions are open.
    pub fn len(&self) -> usize {
        self.sessions.lock().map(|s| s.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}
