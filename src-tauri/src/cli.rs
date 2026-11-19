//! `tiili <command>`: the app's binary in command-line mode, with the commands of [`crate::control::COMMANDS`].
//! `open`, `list`, `attention` and `close` run from inside a pane: they find the app through `TIILI_SOCKET`,
//! `TIILI_TOKEN` and `TIILI_PANE`, send one request (see [`crate::control`]) and print the answer. `help`,
//! `--version`, `describe`, `prompt` and `install-claude-skill` work anywhere without the app.

use std::ffi::OsString;
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::control::{
    describe, error_envelope, help_text, list_lines, listed_reply, opened_reply, parse_args,
    parse_reply, request_line, version_line, wants_json, CliCommand, CliError, Op, Reply, PANE_VAR,
    SOCKET_VAR, TOKEN_VAR,
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

/// Runs `tiili ARGS` and exits with its code. An argument that is not valid UTF-8 is a usage error.
pub fn main(raw: &[OsString]) -> ! {
    attach_console();
    let args = lossy(raw);
    let (out, err) = (&mut io::stdout().lock(), &mut io::stderr().lock());
    let code = if raw.iter().any(|a| a.to_str().is_none()) {
        let error = CliError::Usage("arguments must be valid UTF-8".to_string());
        fail(&args, &error, out, err)
    } else {
        run(
            &args,
            &|name| std::env::var_os(name),
            std::env::current_dir().ok().as_deref(),
            out,
            err,
        )
    };
    std::process::exit(code)
}

/// The arguments as text, with a byte sequence that is not UTF-8 replaced by U+FFFD.
pub fn lossy(raw: &[OsString]) -> Vec<String> {
    raw.iter()
        .map(|a| a.to_string_lossy().into_owned())
        .collect()
}

/// Runs `tiili ARGS` (without the program name) with the variables `env` reads, from folder `cwd`, printing to
/// `out` and `err`; returns the exit code. A failure prints `tiili: <message>` and `hint: <suggestion>` on `err`
/// and exits with its [`CliError`] code; asked for JSON, it also prints the error as JSON on `out`.
pub fn run(
    args: &[String],
    env: &dyn Fn(&str) -> Option<OsString>,
    cwd: Option<&Path>,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> i32 {
    match execute(args, env, cwd, out) {
        Ok(()) => 0,
        Err(error) => fail(args, &error, out, err),
    }
}

/// Reports `error` from a run of `tiili ARGS`: as JSON on `out` as well when ARGS ask for it. Returns its exit code.
fn fail(args: &[String], error: &CliError, out: &mut dyn Write, err: &mut dyn Write) -> i32 {
    if wants_json(args) {
        let _ = writeln!(out, "{}", error_envelope(error));
    }
    report(error, err)
}

/// Prints `error` as `tiili: <message>` and `hint: <suggestion>` (the app's own suggestion for an error it replied
/// with) and returns its exit code.
fn report(error: &CliError, err: &mut dyn Write) -> i32 {
    let _ = writeln!(
        err,
        "tiili: {}\nhint: {}",
        error.message(),
        error.suggestion()
    );
    error.exit()
}

fn execute(
    args: &[String],
    env: &dyn Fn(&str) -> Option<OsString>,
    cwd: Option<&Path>,
    out: &mut dyn Write,
) -> Result<(), CliError> {
    let (op, json) = match parse_args(args)? {
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
        CliCommand::Prompt => {
            let _ = write!(out, "{}", crate::intents::render_prompt());
            return Ok(());
        }
        CliCommand::List { json } => (Op::List, json),
        CliCommand::Attention { message, clear } => (Op::Attention { message, clear }, false),
        CliCommand::Close(target) => (Op::Close { target }, false),
        CliCommand::Open {
            cwd: dir,
            title,
            key,
            command,
            json,
        } => (
            Op::Open {
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
                key,
            },
            json,
        ),
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
    let keyed = matches!(op, Op::Open { key: Some(_), .. });
    let _ = match (parse_reply(&line)?, json) {
        (Reply::Opened { pane, reused }, true) => writeln!(out, "{}", opened_reply(pane, reused)),
        // With a key the caller learns whether it got a new pane; without one the line stays the bare id.
        (Reply::Opened { pane, reused }, false) if keyed => {
            writeln!(out, "{} {pane}", if reused { "reused" } else { "opened" })
        }
        (Reply::Opened { pane, .. }, false) => writeln!(out, "{pane}"),
        (Reply::Listed(panes), false) => write!(out, "{}", list_lines(&panes)),
        (Reply::Listed(panes), true) => writeln!(out, "{}", listed_reply(&panes)),
        (Reply::Done, _) => Ok(()),
    };
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
            (&["list", "--json"], true),
            (&["attention", "hi"], true),
            (&["close", "8"], true),
            (&["prompt"], true),
            (&["install-claude-skill"], true),
            (&["describe"], true),
            (&["help"], true),
            (&["--help"], true),
            (&["-h"], true),
            (&["--version"], true),
            (&["frobnicate"], true),
            (&[], false),
            (&["-psn_0_12345"], false),
            // The jump list's and the desktop action's New Window.
            (&["--new-window"], false),
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
            (&["attention", "hi"], nothing, 3),
            (&["attention", "--clear"], socket_only, 3),
            (&["close", "8"], nothing, 3),
            (&["open"], nothing, 2),
            (&["attention", "--clear", "hi"], socket_only, 2),
            (&["close", "abc"], socket_only, 2),
            (&["close"], socket_only, 2),
            (&["open", "--key", "", "--", "ls"], socket_only, 2),
            (&["prompt", "now"], nothing, 2),
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

    /// Outside a pane: with --json a failure also prints the error envelope on stdout, with the same message and
    /// hint on stderr and the same exit code.
    #[test]
    fn outside_a_pane_with_json_prints_the_error_envelope() {
        let nothing = |_: &str| None;
        let cases: &[(&[&str], i32, &str)] = &[
            (&["list", "--json"], 3, "not_in_pane"),
            (&["open", "--json", "--", "npm", "test"], 3, "not_in_pane"),
            (&["list", "--json", "extra"], 2, "usage"),
            (&["open", "--json"], 2, "usage"),
        ];
        for (argv, code, error) in cases {
            let (mut out, mut err) = (Vec::new(), Vec::new());
            assert_eq!(
                run(&args(argv), &nothing, None, &mut out, &mut err),
                *code,
                "{argv:?}"
            );
            let out: serde_json::Value = serde_json::from_slice(&out).expect("one JSON object");
            let err = String::from_utf8(err).unwrap();
            let (message, hint) = err.split_once('\n').unwrap();
            assert_eq!(
                out,
                serde_json::json!({
                    "ok": false,
                    "code": error,
                    "error": message.strip_prefix("tiili: ").unwrap(),
                    "suggestion": hint.trim_end().strip_prefix("hint: ").unwrap(),
                }),
                "{argv:?}"
            );
        }
    }

    /// Refused request carries a code: the CLI prints the suggestion the app's reply carries, not its own.
    #[test]
    fn refused_request_carries_a_code_the_cli_prints_the_apps_suggestion() {
        let reply = r#"{"ok":false,"code":"bad_token","error":"wrong or missing token","suggestion":"reopen the pane"}"#;
        let error = parse_reply(reply).unwrap_err();
        let mut err = Vec::new();
        assert_eq!(report(&error, &mut err), 1);
        let err = String::from_utf8(err).unwrap();
        assert_eq!(err.lines().nth(1), Some("hint: reopen the pane"), "{err}");
    }

    /// Help from a pane, Version, Describe outside a pane, Prompt fragment: they answer with no tiili variables set
    /// and exit 0.
    #[test]
    fn help_version_and_describe_answer_without_a_pane() {
        let nothing = |_: &str| None;
        let cases: &[(&[&str], String)] = &[
            (&["--help"], help_text(None).unwrap()),
            (&["-h"], help_text(None).unwrap()),
            (&["help"], help_text(None).unwrap()),
            (&["help", "open"], help_text(Some("open")).unwrap()),
            (&["--version"], format!("{}\n", version_line())),
            (&["prompt"], crate::intents::render_prompt()),
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
