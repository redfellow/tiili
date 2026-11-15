//! `tiili <command>`: the app's binary in command-line mode, with the commands of [`crate::control::COMMANDS`].
//! `open` and `list` run from inside a pane: they find the app through `TIILI_SOCKET`, `TIILI_TOKEN` and
//! `TIILI_PANE`, send one request (see [`crate::control`]) and print the answer. `help`, `--version`, `describe`
//! and `install-claude-skill` work anywhere without the app.

use std::ffi::OsString;
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::control::{
    describe, help_text, list_lines, parse_args, parse_reply, request_line, version_line,
    CliCommand, CliError, Op, Reply, PANE_VAR, SOCKET_VAR, TOKEN_VAR,
};

/// How long `tiili` waits for the answer; an open waits up to 10 seconds for the window.
const REPLY_WAIT: Duration = Duration::from_secs(15);

/// Whether the arguments after the program name ask for command-line mode rather than the app: a command, the help
/// or version flags, or any other bare word (an unknown command, refused with a usage error). No arguments, or a
/// dash-prefixed one the OS passes (`-psn_0_123` on macOS), start the app.
pub fn is_cli(args: &[String]) -> bool {
    match args.first().map(String::as_str) {
        Some("--help" | "-h" | "--version") => true,
        Some(first) => !first.starts_with('-'),
        None => false,
    }
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
/// `out` and `err`; returns the exit code. A failure prints `tiili: <message>` and `hint: <suggestion>` on `err`
/// and exits with its [`CliError`] code.
pub fn run(
    args: &[String],
    env: &dyn Fn(&str) -> Option<OsString>,
    cwd: Option<&Path>,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> i32 {
    match execute(args, env, cwd, out) {
        Ok(()) => 0,
        Err(error) => {
            let _ = writeln!(
                err,
                "tiili: {}\nhint: {}",
                error.message(),
                error.suggestion()
            );
            error.exit()
        }
    }
}

fn execute(
    args: &[String],
    env: &dyn Fn(&str) -> Option<OsString>,
    cwd: Option<&Path>,
    out: &mut dyn Write,
) -> Result<(), CliError> {
    let op = match parse_args(args)? {
        // Help, version and describe answer here, before anything reaches for the app.
        CliCommand::Help(cmd) => {
            let _ = write!(out, "{}", help_text(cmd.as_deref())?);
            return Ok(());
        }
        CliCommand::Version => {
            let _ = writeln!(out, "{}", version_line());
            return Ok(());
        }
        CliCommand::Describe(cmd) => {
            let json = serde_json::to_string_pretty(&describe(cmd.as_deref())?)
                .expect("describe serializes");
            let _ = writeln!(out, "{json}");
            return Ok(());
        }
        CliCommand::InstallClaudeSkill => {
            let path = crate::claude_skill::install_from_env(env)?;
            let _ = writeln!(out, "Installed the tiili-tiles skill to {}", path.display());
            return Ok(());
        }
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
    let socket = env(SOCKET_VAR)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| CliError::NotInPane(format!("{SOCKET_VAR} is not set")))?;
    let pane = match env(PANE_VAR) {
        None => return Err(CliError::NotInPane(format!("{PANE_VAR} is not set"))),
        Some(value) => value
            .to_str()
            .and_then(|p| p.parse().ok())
            .ok_or_else(|| CliError::NotInPane(format!("{PANE_VAR} is not a pane id")))?,
    };
    let token = env(TOKEN_VAR)
        .map(|t| t.to_string_lossy().into_owned())
        .unwrap_or_default();
    let line = ask(Path::new(&socket), &request_line(&token, pane, &op))
        .map_err(|e| CliError::Unreachable(format!("{}: {e}", socket.to_string_lossy())))?;
    match parse_reply(&line)? {
        Reply::Opened(id) => {
            let _ = writeln!(out, "{id}");
        }
        Reply::Listed(panes) => {
            let _ = write!(out, "{}", list_lines(&panes));
        }
    }
    Ok(())
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
/// shell that ran it, unless it was redirected. Every `tiili <command>` path calls this before writing output.
pub fn attach_console() {
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

    /// Launch arguments still start the app: commands, help and version flags and bare words run the CLI;
    /// nothing, or another dash-prefixed argument, starts the app.
    #[test]
    fn commands_flags_and_bare_words_run_the_cli() {
        let cases: &[(&[&str], bool)] = &[
            (&["open", "--", "ls"], true),
            (&["list"], true),
            (&["install-claude-skill"], true),
            (&["describe"], true),
            (&["help"], true),
            (&["--help"], true),
            (&["-h"], true),
            (&["--version"], true),
            (&["frobnicate"], true),
            (&[], false),
            (&["-psn_0_12345"], false),
            (&["--", "open"], false),
            (&["--frobnicate"], false),
        ];
        for (argv, cli) in cases {
            assert_eq!(is_cli(&args(argv)), *cli, "{argv:?}");
        }
    }

    /// Outside a pane with a hint, Unknown command, Missing command: none reaches the app, each prints its
    /// message and a hint, and exits with its code.
    #[test]
    fn outside_a_pane_and_bad_arguments_fail_with_a_hint_and_a_code() {
        let socket_only = |name: &str| (name == SOCKET_VAR).then(|| OsString::from("/nowhere"));
        let nothing = |_: &str| None;
        let bad_pane = |name: &str| match name {
            SOCKET_VAR => Some(OsString::from("/nowhere")),
            PANE_VAR => Some(OsString::from("abc")),
            _ => None,
        };
        type Env = fn(&str) -> Option<OsString>;
        let cases: &[(&[&str], Env, i32)] = &[
            (&["open", "--", "ls"], nothing, 3),
            (&["list"], nothing, 3),
            // TIILI_PANE missing too.
            (&["list"], socket_only, 3),
            // TIILI_PANE set but not a pane id.
            (&["list"], bad_pane, 3),
            (&["open"], nothing, 2),
            (&["open", "--"], socket_only, 2),
            (&["list", "extra"], socket_only, 2),
            (&["frobnicate"], nothing, 2),
            (&["help", "frobnicate"], nothing, 2),
            (&["describe", "frobnicate"], nothing, 2),
        ];
        for (argv, env, code) in cases {
            let (mut out, mut err) = (Vec::new(), Vec::new());
            assert_eq!(
                run(&args(argv), env, None, &mut out, &mut err),
                *code,
                "{argv:?}"
            );
            assert!(out.is_empty(), "{argv:?} printed {out:?}");
            let err = String::from_utf8(err).unwrap();
            let lines: Vec<&str> = err.lines().collect();
            assert_eq!(lines.len(), 2, "{argv:?}: {err}");
            assert!(lines[0].starts_with("tiili: "), "{argv:?}: {err}");
            assert!(lines[1].starts_with("hint: "), "{argv:?}: {err}");
        }
    }

    /// Help from a pane, Version, Describe outside a pane: they answer with no tiili variables set and exit 0.
    #[test]
    fn help_version_and_describe_answer_without_a_pane() {
        let nothing = |_: &str| None;
        let cases: &[(&[&str], String)] = &[
            (&["--help"], help_text(None).unwrap()),
            (&["-h"], help_text(None).unwrap()),
            (&["help"], help_text(None).unwrap()),
            (&["help", "open"], help_text(Some("open")).unwrap()),
            (&["--version"], format!("{}\n", version_line())),
            (
                &["describe"],
                serde_json::to_string_pretty(&describe(None).unwrap()).unwrap() + "\n",
            ),
            (
                &["describe", "open"],
                serde_json::to_string_pretty(&describe(Some("open")).unwrap()).unwrap() + "\n",
            ),
        ];
        for (argv, expected) in cases {
            let (mut out, mut err) = (Vec::new(), Vec::new());
            assert_eq!(
                run(&args(argv), &nothing, None, &mut out, &mut err),
                0,
                "{argv:?}"
            );
            assert_eq!(String::from_utf8(out).unwrap(), *expected, "{argv:?}");
            assert!(err.is_empty(), "{argv:?}");
        }
    }
}
