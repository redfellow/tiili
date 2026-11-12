//! One shell on a pseudo-terminal (ConPTY on Windows), free of Tauri types so tests can drive it.

use std::io::{self, Read, Write};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

/// Called with each chunk the shell writes.
pub type OutputFn = Box<dyn FnMut(&[u8]) + Send>;
/// Called once after the shell has exited and its last output was delivered, with its exit code.
pub type ExitFn = Box<dyn FnOnce(u32) + Send>;

/// How long the exit notice waits for the shell's last output after the shell has exited. A
/// background job that outlives the shell keeps the pseudo-terminal open, so the reader may never
/// see end of file.
const LAST_OUTPUT_WAIT: Duration = Duration::from_millis(500);

/// A running shell. Dropping the session kills the shell.
pub struct PtySession {
    master: Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>,
    /// Queue to the writer thread; `None` once the shell has exited.
    input: Arc<Mutex<Option<Sender<Vec<u8>>>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

fn size(rows: u16, cols: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn to_io(err: impl std::fmt::Display) -> io::Error {
    io::Error::other(err.to_string())
}

fn gone() -> io::Error {
    io::Error::new(io::ErrorKind::BrokenPipe, "the shell has exited")
}

impl PtySession {
    /// Starts the user's default shell (`$SHELL` or `%COMSPEC%`) with `TERM=xterm-256color`.
    pub fn spawn(rows: u16, cols: u16, on_output: OutputFn, on_exit: ExitFn) -> io::Result<Self> {
        let mut cmd = CommandBuilder::new_default_prog();
        cmd.env("TERM", "xterm-256color");
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
        })
    }

    /// Queues input for the shell, in order; never blocks on the shell. Fails once the shell has exited.
    pub fn write(&self, data: &[u8]) -> io::Result<()> {
        let guard = self.input.lock().map_err(to_io)?;
        let input = guard.as_ref().ok_or_else(gone)?;
        input.send(data.to_vec()).map_err(|_| gone())
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
