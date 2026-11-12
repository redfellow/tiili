//! One shell on a pseudo-terminal (ConPTY on Windows), free of Tauri types so tests can drive it.

use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

/// Called with each chunk the shell writes.
pub type OutputFn = Box<dyn FnMut(&[u8]) + Send>;
/// Called once after the shell has exited and its last output was delivered, with its exit code.
pub type ExitFn = Box<dyn FnOnce(u32) + Send>;

struct Pty {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

/// A running shell. Dropping the session kills the shell.
pub struct PtySession {
    pty: Arc<Mutex<Option<Pty>>>,
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
        let writer = pair.master.take_writer().map_err(to_io)?;
        let pty = Arc::new(Mutex::new(Some(Pty {
            master: pair.master,
            writer,
        })));

        let reader_thread = thread::Builder::new()
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
            })?;

        let waiter_pty = Arc::clone(&pty);
        thread::Builder::new()
            .name("pty-waiter".into())
            .spawn(move || {
                let code = child.wait().map(|s| s.exit_code()).unwrap_or(1);
                // Closing the pseudo-terminal lets the reader finish (ConPTY only ends its output then).
                drop(waiter_pty.lock().ok().and_then(|mut p| p.take()));
                let _ = reader_thread.join();
                on_exit(code);
            })?;

        Ok(Self { pty, killer })
    }

    /// Sends input to the shell.
    pub fn write(&self, data: &[u8]) -> io::Result<()> {
        let mut guard = self.pty.lock().map_err(to_io)?;
        let pty = guard.as_mut().ok_or_else(gone)?;
        pty.writer.write_all(data)?;
        pty.writer.flush()
    }

    /// Tells the shell the terminal now has `rows` x `cols`.
    pub fn resize(&self, rows: u16, cols: u16) -> io::Result<()> {
        let guard = self.pty.lock().map_err(to_io)?;
        let pty = guard.as_ref().ok_or_else(gone)?;
        pty.master.resize(size(rows, cols)).map_err(to_io)
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        let _ = self.killer.kill();
    }
}
