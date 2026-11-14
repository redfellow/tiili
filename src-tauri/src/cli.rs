//! `tiili open` and `tiili list`: the app's binary in command-line mode, run from inside a pane. It finds the app
//! through `TIILI_SOCKET`, `TIILI_TOKEN` and `TIILI_PANE`, sends one request (see [`crate::control`]) and prints
//! the answer.

use std::ffi::OsString;
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::control::{
    list_lines, parse_args, parse_reply, request_line, CliCommand, Op, Reply, PANE_VAR, SOCKET_VAR,
    TOKEN_VAR, USAGE,
};

/// Exit code for a request that failed or could not be sent.
pub const FAILED: i32 = 1;
/// Exit code for arguments `tiili` does not understand.
pub const USAGE_ERROR: i32 = 2;

/// How long `tiili` waits for the answer; an open waits up to 10 seconds for the window.
const REPLY_WAIT: Duration = Duration::from_secs(15);

/// Whether the arguments after the program name ask for command-line mode rather than the app.
pub fn is_cli(args: &[String]) -> bool {
    matches!(args.first().map(String::as_str), Some("open" | "list"))
}

/// Runs `tiili ARGS` and exits with its code.
pub fn main(args: &[String]) -> ! {
    attach_console();
    let code = run(
        args,
        &|name| std::env::var_os(name),
        std::env::current_dir().ok().as_deref(),
        &mut io::stdout().lock(),
        &mut io::stderr().lock(),
    );
    std::process::exit(code)
}

/// Runs `tiili ARGS` (without the program name) with the variables `env` reads, from folder `cwd`, printing to
/// `out` and `err`; returns the exit code.
pub fn run(
    args: &[String],
    env: &dyn Fn(&str) -> Option<OsString>,
    cwd: Option<&Path>,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> i32 {
    let command = match parse_args(args) {
        Ok(command) => command,
        Err(why) => {
            let _ = writeln!(err, "tiili: {why}\n{USAGE}");
            return USAGE_ERROR;
        }
    };
    let Some(socket) = env(SOCKET_VAR).filter(|s| !s.is_empty()) else {
        let _ = writeln!(
            err,
            "tiili: not inside a tiili pane ({SOCKET_VAR} is not set)"
        );
        return FAILED;
    };
    let Some(pane) = env(PANE_VAR).and_then(|p| p.to_str()?.parse().ok()) else {
        let _ = writeln!(
            err,
            "tiili: not inside a tiili pane ({PANE_VAR} is not set)"
        );
        return FAILED;
    };
    let token = env(TOKEN_VAR)
        .map(|t| t.to_string_lossy().into_owned())
        .unwrap_or_default();
    let op = match command {
        CliCommand::List => Op::List,
        CliCommand::Open {
            cwd: dir,
            title,
            command,
        } => Op::Open {
            cwd: dir
                .map(PathBuf::from)
                .map(|dir| match cwd {
                    Some(here) if dir.is_relative() => here.join(dir),
                    _ => dir,
                })
                .or_else(|| cwd.map(Path::to_path_buf))
                .map(|dir| dir.to_string_lossy().into_owned()),
            title,
            command,
            path: env("PATH").map(|p| p.to_string_lossy().into_owned()),
        },
    };
    let reply = ask(Path::new(&socket), &request_line(&token, pane, &op))
        .map_err(|e| format!("could not reach tiili at {}: {e}", socket.to_string_lossy()))
        .and_then(|line| parse_reply(&line));
    match reply {
        Ok(Reply::Opened(id)) => {
            let _ = writeln!(out, "{id}");
            0
        }
        Ok(Reply::Listed(panes)) => {
            let _ = write!(out, "{}", list_lines(&panes));
            0
        }
        Err(why) => {
            let _ = writeln!(err, "tiili: {why}");
            FAILED
        }
    }
}

/// Sends request `line` to the endpoint and reads the answer line.
fn ask(endpoint: &Path, line: &str) -> io::Result<String> {
    let stream = connect(endpoint)?;
    let mut writer = &stream;
    writer.write_all(format!("{line}\n").as_bytes())?;
    writer.flush()?;
    let mut reply = String::new();
    BufReader::new(&stream).read_line(&mut reply)?;
    if reply.is_empty() {
        return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "no answer"));
    }
    Ok(reply)
}

#[cfg(unix)]
fn connect(endpoint: &Path) -> io::Result<std::os::unix::net::UnixStream> {
    let stream = std::os::unix::net::UnixStream::connect(endpoint)?;
    stream.set_read_timeout(Some(REPLY_WAIT))?;
    Ok(stream)
}

#[cfg(windows)]
fn connect(endpoint: &Path) -> io::Result<std::fs::File> {
    // ERROR_PIPE_BUSY: every instance is taken for a moment; the server makes another at once.
    const PIPE_BUSY: i32 = 231;
    let deadline = std::time::Instant::now() + REPLY_WAIT;
    loop {
        match std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(endpoint)
        {
            Err(e)
                if e.raw_os_error() == Some(PIPE_BUSY) && std::time::Instant::now() < deadline =>
            {
                std::thread::sleep(Duration::from_millis(50))
            }
            result => return result,
        }
    }
}

/// A release build on Windows is a GUI program with no console of its own: its output goes to the console of the
/// shell that ran it, unless it was redirected.
fn attach_console() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Console::{
            AttachConsole, GetStdHandle, ATTACH_PARENT_PROCESS, STD_OUTPUT_HANDLE,
        };
        // SAFETY: both calls only read or set this process's console handles.
        unsafe {
            if GetStdHandle(STD_OUTPUT_HANDLE).is_null() {
                AttachConsole(ATTACH_PARENT_PROCESS);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|a| a.to_string()).collect()
    }

    #[test]
    fn only_open_and_list_run_the_cli() {
        let cases: &[(&[&str], bool)] = &[
            (&["open", "--", "ls"], true),
            (&["list"], true),
            (&[], false),
            (&["-psn_0_12345"], false),
            (&["--", "open"], false),
        ];
        for (argv, cli) in cases {
            assert_eq!(is_cli(&args(argv)), *cli, "{argv:?}");
        }
    }

    /// Outside tiili, Missing command: neither reaches the app.
    #[test]
    fn outside_tiili_and_missing_command_fail_without_a_request() {
        let socket_only = |name: &str| (name == SOCKET_VAR).then(|| OsString::from("/nowhere"));
        let nothing = |_: &str| None;
        type Env = fn(&str) -> Option<OsString>;
        let cases: &[(&[&str], Env, i32)] = &[
            (&["open", "--", "ls"], nothing, FAILED),
            (&["list"], nothing, FAILED),
            // TIILI_PANE missing too.
            (&["list"], socket_only, FAILED),
            (&["open"], nothing, USAGE_ERROR),
            (&["open", "--"], socket_only, USAGE_ERROR),
            (&["list", "extra"], socket_only, USAGE_ERROR),
        ];
        for (argv, env, code) in cases {
            let (mut out, mut err) = (Vec::new(), Vec::new());
            assert_eq!(
                run(&args(argv), env, None, &mut out, &mut err),
                *code,
                "{argv:?}"
            );
            assert!(out.is_empty(), "{argv:?} printed {out:?}");
            assert!(!err.is_empty(), "{argv:?} said nothing");
        }
    }
}
