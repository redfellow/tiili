// @harvaaja-test-tier: host
//! Drives several real default shells through `SessionRegistry`.

use std::collections::HashMap;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::{pane_command, ControlEnv, PaneCommand, SessionId, SessionRegistry};

const TIMEOUT: Duration = Duration::from_secs(20);

/// Output per session, gathered from the registry's shared output callback.
struct Outputs {
    rx: mpsc::Receiver<(SessionId, Vec<u8>)>,
    seen: HashMap<SessionId, Vec<u8>>,
}

impl Outputs {
    /// The visible text: shell-integration marks (`ESC ] ... BEL` or `ESC ] ... ESC \`) are dropped.
    fn text(&self, id: SessionId) -> String {
        let raw =
            String::from_utf8_lossy(self.seen.get(&id).map(Vec::as_slice).unwrap_or_default())
                .into_owned();
        let mut visible = String::with_capacity(raw.len());
        let mut chars = raw.chars().peekable();
        while let Some(c) = chars.next() {
            if c == '\u{1b}' && chars.peek() == Some(&']') {
                // An unfinished mark is dropped to the end; it completes with later output.
                while let Some(d) = chars.next() {
                    if d == '\u{7}' || (d == '\u{1b}' && chars.peek() == Some(&'\\')) {
                        if d != '\u{7}' {
                            chars.next();
                        }
                        break;
                    }
                }
            } else {
                visible.push(c);
            }
        }
        visible
    }

    /// Collects output until `pattern` appears in session `id`'s output or the timeout passes.
    fn wait_for(&mut self, id: SessionId, pattern: &str) -> bool {
        let deadline = Instant::now() + TIMEOUT;
        while Instant::now() < deadline {
            if self.text(id).contains(pattern) {
                return true;
            }
            if let Ok((from, chunk)) = self.rx.recv_timeout(Duration::from_millis(100)) {
                self.seen.entry(from).or_default().extend(chunk);
            }
        }
        self.text(id).contains(pattern)
    }
}

fn spawn(
    registry: &SessionRegistry,
    tx: &mpsc::Sender<(SessionId, Vec<u8>)>,
    cwd: Option<&std::path::Path>,
) -> SessionId {
    let tx = tx.clone();
    registry
        .spawn(
            cwd,
            "off",
            24,
            80,
            Box::new(move |id, data| {
                let _ = tx.send((id, data.to_vec()));
            }),
            Box::new(|_, _| {}),
        )
        .expect("shell starts")
}

/// Each session its own size, Independent sessions, Inherit directory.
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn sessions_keep_their_own_size_input_and_directory() {
    let registry = SessionRegistry::new();
    let (tx, rx) = mpsc::channel();
    let mut out = Outputs {
        rx,
        seen: HashMap::new(),
    };

    let ids: Vec<SessionId> = (0..3).map(|_| spawn(&registry, &tx, None)).collect();
    assert_eq!(registry.len(), 3);

    // Independent sessions: input typed into one session only shows in that session.
    for (n, &id) in ids.iter().enumerate() {
        registry
            .write(id, format!("echo tiili-{n}-ok\r").as_bytes())
            .expect("write reaches the shell");
    }
    for (n, &id) in ids.iter().enumerate() {
        assert!(
            out.wait_for(id, &format!("\ntiili-{n}-ok")),
            "session {id} never showed its output: {:?}",
            out.text(id)
        );
    }
    for (n, &id) in ids.iter().enumerate() {
        for other in (0..3).filter(|&m| m != n) {
            assert!(
                !out.text(id).contains(&format!("tiili-{other}-ok")),
                "session {id} showed another session's output"
            );
        }
    }

    #[cfg(unix)]
    {
        // Each session its own size: every shell reports the rows and columns sent to it.
        let sizes = [(30u16, 90u16), (40, 120), (50, 150)];
        for (&id, &(rows, cols)) in ids.iter().zip(&sizes) {
            registry.resize(id, rows, cols).expect("resize is accepted");
        }
        for (&id, &(rows, cols)) in ids.iter().zip(&sizes) {
            registry
                .write(id, b"stty size\r")
                .expect("stty reaches the shell");
            assert!(
                out.wait_for(id, &format!("\n{rows} {cols}")),
                "session {id} never saw {rows} rows and {cols} columns: {:?}",
                out.text(id)
            );
        }

        // Inherit directory: a session started in another's working directory prints it with pwd.
        let dir = std::env::temp_dir()
            .canonicalize()
            .expect("temp dir exists");
        registry
            .write(ids[0], format!("cd '{}'\r", dir.display()).as_bytes())
            .expect("cd reaches the shell");
        let deadline = Instant::now() + TIMEOUT;
        let mut cwd = None;
        while Instant::now() < deadline {
            cwd = registry.cwd(ids[0]).expect("session is open");
            if cwd
                .as_deref()
                .and_then(|p| p.canonicalize().ok())
                .as_deref()
                == Some(dir.as_path())
            {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let cwd = cwd.expect("the shell's directory can be read");
        let child = spawn(&registry, &tx, Some(&cwd));
        registry
            .write(child, b"pwd\r")
            .expect("pwd reaches the shell");
        assert!(
            out.wait_for(child, &format!("\n{}", cwd.display())),
            "new session did not start in {}: {:?}",
            cwd.display(),
            out.text(child)
        );
        registry.close(child).expect("close");
    }

    // Closing one session leaves the others running.
    registry.close(ids[1]).expect("close");
    assert_eq!(registry.len(), 2);
    assert!(
        registry.write(ids[1], b"echo gone\r").is_err(),
        "a closed session takes no input"
    );
    for &id in [ids[0], ids[2]].iter() {
        registry
            .write(id, b"echo still-here\r")
            .expect("write reaches the shell");
        assert!(
            out.wait_for(id, "\nstill-here"),
            "session {id} stopped after another closed: {:?}",
            out.text(id)
        );
    }
}

fn control() -> ControlEnv {
    ControlEnv {
        socket: "/run/tiili/tiili-1.sock".into(),
        token: "f00d".repeat(16),
        bin_dir: std::env::temp_dir().join("tiili-test-bin"),
    }
}

fn joined(dirs: &[std::path::PathBuf]) -> std::ffi::OsString {
    std::env::join_paths(dirs).expect("joinable")
}

/// Shell sees the variables, Command found on the caller's PATH: what a pane is started with, without starting it.
#[test]
fn shell_sees_the_variables_and_commands_get_the_callers_path() {
    let control = control();
    let bin = control.bin_dir.clone();
    let caller = [
        std::path::PathBuf::from("/opt/tools/bin"),
        "/usr/bin".into(),
    ];
    let app_path: Vec<std::path::PathBuf> = std::env::var_os("PATH")
        .map(|p| {
            std::env::split_paths(&p)
                .filter(|d| !d.as_os_str().is_empty())
                .collect()
        })
        .unwrap_or_default();
    let with_bin = |rest: &[std::path::PathBuf]| {
        joined(
            &std::iter::once(bin.clone())
                .chain(rest.iter().cloned())
                .collect::<Vec<_>>(),
        )
    };
    let npm = PaneCommand {
        argv: vec!["npm".into(), "run".into(), "dev".into()],
        path: Some(joined(&caller)),
    };
    let ls = PaneCommand {
        argv: vec!["ls".into()],
        path: None,
    };
    // tiili's folder already on the caller's PATH is not repeated.
    let again = PaneCommand {
        argv: vec!["ls".into()],
        path: Some(joined(&[caller[0].clone(), bin.clone()])),
    };
    struct Case<'a> {
        id: SessionId,
        command: Option<&'a PaneCommand>,
        control: Option<&'a ControlEnv>,
        argv: Option<Vec<&'a str>>,
        path: Option<std::ffi::OsString>,
    }
    let cases = [
        Case {
            id: 4,
            command: None,
            control: Some(&control),
            argv: None,
            path: Some(with_bin(&app_path)),
        },
        Case {
            id: 5,
            command: Some(&npm),
            control: Some(&control),
            argv: Some(vec!["npm", "run", "dev"]),
            path: Some(with_bin(&caller)),
        },
        Case {
            id: 6,
            command: Some(&ls),
            control: Some(&control),
            argv: Some(vec!["ls"]),
            path: Some(with_bin(&app_path)),
        },
        Case {
            id: 7,
            command: Some(&again),
            control: Some(&control),
            argv: Some(vec!["ls"]),
            path: Some(with_bin(&caller[..1])),
        },
        Case {
            id: 8,
            command: Some(&npm),
            control: None,
            argv: Some(vec!["npm", "run", "dev"]),
            path: Some(joined(&caller)),
        },
    ];
    for case in cases {
        let (cmd, redraws) = pane_command(
            case.id,
            Some(std::path::Path::new("/tmp")),
            "off",
            case.command,
            case.control,
        );
        let var = |name: &str| cmd.get_env(name).map(|v| v.to_os_string());
        assert_eq!(
            var("TIILI_PANE"),
            Some(case.id.to_string().into()),
            "pane {}",
            case.id
        );
        assert_eq!(
            var("TIILI_SOCKET"),
            case.control.map(|c| c.socket.clone()),
            "pane {}",
            case.id
        );
        assert_eq!(
            var("TIILI_TOKEN"),
            case.control.map(|c| c.token.clone().into()),
            "pane {}",
            case.id
        );
        assert_eq!(var("PATH"), case.path, "pane {}", case.id);
        assert_eq!(
            var("TERM"),
            Some("xterm-256color".into()),
            "pane {}",
            case.id
        );
        assert_eq!(
            cmd.get_cwd(),
            Some(&std::ffi::OsString::from("/tmp")),
            "pane {}",
            case.id
        );
        if let Some(argv) = case.argv {
            let got: Vec<_> = cmd
                .get_argv()
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            assert_eq!(got, argv, "pane {}", case.id);
            assert!(!redraws, "pane {}", case.id);
        } else {
            assert!(
                cmd.is_default_prog() || !cmd.get_argv().is_empty(),
                "pane {} starts a shell",
                case.id
            );
        }
    }
}

/// Command found on the caller's PATH, Command exits: a command started in a pane finds its program on the
/// caller's PATH, sees its variables, and its exit is reported with its code.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn command_found_on_the_callers_path_runs_with_the_variables_and_its_exit_is_reported() {
    use std::os::unix::fs::PermissionsExt;

    let tools = std::env::temp_dir().join(format!("tiili-pty-tools-{}", std::process::id()));
    std::fs::create_dir_all(&tools).expect("tools folder");
    let probe = tools.join("tiili-probe");
    std::fs::write(
        &probe,
        "#!/bin/sh\necho \"seen:$TIILI_PANE|$TIILI_SOCKET|$TIILI_TOKEN|${PATH%%:*}|$1\"\nexit 3\n",
    )
    .expect("probe written");
    std::fs::set_permissions(&probe, std::fs::Permissions::from_mode(0o755)).expect("probe runs");

    let control = control();
    let registry = SessionRegistry::new();
    registry.set_control(control.clone());
    let (tx, rx) = mpsc::channel();
    let (exit_tx, exit_rx) = mpsc::channel();
    let mut out = Outputs {
        rx,
        seen: HashMap::new(),
    };
    let command = PaneCommand {
        argv: vec!["tiili-probe".into(), "arg one".into()],
        path: Some(joined(&[tools.clone(), "/usr/bin".into(), "/bin".into()])),
    };
    let id = registry
        .spawn_tracked(
            None,
            "off",
            Some(&command),
            24,
            80,
            Box::new(move |id, data| {
                let _ = tx.send((id, data.to_vec()));
            }),
            None,
            None,
            Box::new(move |id, code| {
                let _ = exit_tx.send((id, code));
            }),
        )
        .expect("command starts");
    let expected = format!(
        "seen:{id}|{}|{}|{}|arg one",
        control.socket.to_string_lossy(),
        control.token,
        control.bin_dir.display()
    );
    assert!(
        out.wait_for(id, &expected),
        "the command saw something else: {:?}",
        out.text(id)
    );
    assert_eq!(exit_rx.recv_timeout(TIMEOUT), Ok((id, 3)));
    let _ = std::fs::remove_dir_all(&tools);
}
