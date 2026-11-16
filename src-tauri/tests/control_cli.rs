// @harvaaja-test-tier: host
//! Runs the `tiili` binary in command-line mode: outside a pane, with bad arguments, and (on the host) against a
//! test listener that records what reaches it.

use std::path::PathBuf;
use std::process::{Command, Output};

const TIILI: &str = env!("CARGO_BIN_EXE_tiili");

/// Environment variables `tiili` runs with, by name.
type Vars<'a> = &'a [(&'a str, &'a str)];

fn tiili(args: &[&str], env: &[(&str, &str)]) -> Output {
    let mut cmd = Command::new(TIILI);
    cmd.args(args)
        .env_remove("TIILI_SOCKET")
        .env_remove("TIILI_TOKEN")
        .env_remove("TIILI_PANE");
    for (name, value) in env {
        cmd.env(name, value);
    }
    cmd.output().expect("tiili runs")
}

/// Outside a pane with a hint, Unknown command, Missing command, Help from a pane, Version, Describe outside a
/// pane, Prompt fragment: a failure exits with its code, prints nothing on stdout and a message and a hint on stderr;
/// help, version, describe and prompt print on stdout and exit 0 without a pane or the app.
#[test]
fn outside_tiili_and_bad_arguments_fail_with_a_code() {
    let nowhere = std::env::temp_dir()
        .join(format!("tiili-cli-nowhere-{}.sock", std::process::id()))
        .to_string_lossy()
        .into_owned();
    let inside = [
        ("TIILI_SOCKET", nowhere.as_str()),
        ("TIILI_TOKEN", "00"),
        ("TIILI_PANE", "1"),
    ];
    // Arguments, variables, the exit code expected.
    let cases: &[(&[&str], Vars, i32)] = &[
        (&["open", "--", "ls"], &[], 3),
        (&["list"], &[], 3),
        (&["attention", "hi"], &[], 3),
        (&["close", "8"], &[], 3),
        (&["open"], &inside, 2),
        (&["open", "--key", "", "--", "ls"], &inside, 2),
        (&["attention", "--clear", "hi"], &inside, 2),
        (&["close", "abc"], &inside, 2),
        (&["prompt", "now"], &[], 2),
        (&["open", "--"], &inside, 2),
        (&["list", "extra"], &inside, 2),
        (&["frobnicate"], &[], 2),
        (&["describe", "frobnicate"], &[], 2),
        // Inside a pane whose app has gone.
        (&["list"], &inside, 4),
        (&["--help"], &[], 0),
        (&["-h"], &[], 0),
        (&["help", "open"], &[], 0),
        (&["--version"], &[], 0),
        (&["describe"], &[], 0),
        (&["describe", "open"], &[], 0),
        (&["prompt"], &[], 0),
    ];
    for (args, env, code) in cases {
        let out = tiili(args, env);
        assert_eq!(out.status.code(), Some(*code), "{args:?} {env:?}");
        let stderr = String::from_utf8_lossy(&out.stderr);
        if *code == 0 {
            assert!(!out.stdout.is_empty(), "{args:?} printed nothing");
            assert!(stderr.is_empty(), "{args:?} said {stderr}");
        } else {
            assert!(out.stdout.is_empty(), "{args:?} printed {:?}", out.stdout);
            let lines: Vec<&str> = stderr.lines().collect();
            assert_eq!(lines.len(), 2, "{args:?}: {stderr}");
            assert!(lines[0].starts_with("tiili: "), "{args:?}: {stderr}");
            assert!(lines[1].starts_with("hint: "), "{args:?}: {stderr}");
        }
    }
    // Outside a pane: with --json the error envelope is on stdout as well, with the same exit code.
    let out = tiili(&["list", "--json"], &[]);
    assert_eq!(out.status.code(), Some(3));
    let envelope: serde_json::Value = serde_json::from_slice(&out.stdout).expect("JSON on stdout");
    assert_eq!(
        envelope,
        serde_json::json!({
            "ok": false,
            "code": "not_in_pane",
            "error": "not inside a tiili pane (TIILI_SOCKET is not set)",
            "suggestion": "run tiili from a pane of the running tiili app",
        })
    );
    assert_eq!(String::from_utf8_lossy(&out.stderr).lines().count(), 2);
    // Describe is the same on every run.
    assert_eq!(
        tiili(&["describe"], &[]).stdout,
        tiili(&["describe"], &[]).stdout
    );
}

/// Usage errors, JSON errors: an argument that is not valid UTF-8 is refused with a usage error, not a crash, by the
/// app's binary and by the console `tiili-cli` alike; asked for JSON, the error envelope is on stdout as well.
#[cfg(unix)]
#[test]
fn a_non_utf8_argument_is_a_usage_error() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;

    let bad = OsStr::from_bytes(b"bad\xff");
    let plain = [OsStr::new("attention"), bad];
    let json = [
        OsStr::new("open"),
        OsStr::new("--json"),
        OsStr::new("--title"),
        bad,
        OsStr::new("--"),
        OsStr::new("ls"),
    ];
    for binary in [TIILI, env!("CARGO_BIN_EXE_tiili-cli")] {
        for args in [&plain[..], &json[..]] {
            let out = Command::new(binary)
                .args(args)
                .env_remove("TIILI_SOCKET")
                .env_remove("TIILI_TOKEN")
                .env_remove("TIILI_PANE")
                .output()
                .expect("tiili runs");
            assert_eq!(out.status.code(), Some(2), "{binary} {args:?}");
            let stderr = String::from_utf8_lossy(&out.stderr);
            assert_eq!(
                stderr.lines().next(),
                Some("tiili: arguments must be valid UTF-8"),
                "{binary} {args:?}: {stderr}"
            );
            if args.contains(&OsStr::new("--json")) {
                let envelope: serde_json::Value =
                    serde_json::from_slice(&out.stdout).expect("JSON on stdout");
                assert_eq!(envelope["ok"], false, "{envelope}");
                assert_eq!(envelope["code"], "usage", "{envelope}");
            } else {
                assert!(out.stdout.is_empty(), "{binary} {args:?}");
            }
        }
    }
}

#[cfg(unix)]
mod listener {
    use std::sync::{Arc, Mutex};

    use tiili_lib::control::{CliError, Op, PaneInfo, RunningRecord};
    use tiili_lib::control_server::{bind, Handler};
    use tiili_lib::pty::SessionId;

    use super::*;

    /// The call the app should have recorded last, if the request reached it.
    type Reached = Option<(SessionId, Op)>;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[derive(Default)]
    struct Recorder(Mutex<Vec<(SessionId, Op)>>);

    impl Handler for Recorder {
        fn open(
            &self,
            caller: SessionId,
            cwd: Option<String>,
            title: Option<String>,
            command: Vec<String>,
            path: Option<String>,
            key: Option<String>,
        ) -> Result<(SessionId, bool), String> {
            let failing = command.first().map(String::as_str) == Some("fail");
            // The key "again" stands for one already open.
            let reused = key.as_deref() == Some("again");
            self.0.lock().unwrap().push((
                caller,
                Op::Open {
                    cwd,
                    title,
                    command,
                    path,
                    key,
                },
            ));
            if failing {
                return Err("no such program".into());
            }
            Ok((caller + 40, reused))
        }

        fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
            self.0.lock().unwrap().push((caller, Op::List));
            Ok(panes(caller))
        }

        fn attention(
            &self,
            caller: SessionId,
            message: Option<String>,
            clear: bool,
        ) -> Result<(), String> {
            self.0
                .lock()
                .unwrap()
                .push((caller, Op::Attention { message, clear }));
            Ok(())
        }

        fn close(&self, caller: SessionId, target: SessionId) -> Result<(), CliError> {
            self.0.lock().unwrap().push((caller, Op::Close { target }));
            // Pane 5 stands for one the caller did not open.
            match target {
                5 => Err(CliError::NotOpenedByYou(
                    "pane 5 was not opened by this pane".into(),
                )),
                _ => Ok(()),
            }
        }
    }

    /// The panes the recorder lists for `caller`: its own, and a dev server it opened with key dev.
    fn panes(caller: SessionId) -> Vec<PaneInfo> {
        vec![
            PaneInfo {
                id: caller,
                is_self: true,
                window: "main".into(),
                cwd: "/work/app".into(),
                label: "app".into(),
                tab: Some(1),
                ..PaneInfo::default()
            },
            PaneInfo {
                id: caller + 1,
                window: "main".into(),
                cwd: "/tmp".into(),
                title: Some("logs".into()),
                label: "tmp".into(),
                running: Some(RunningRecord {
                    command: Some("npm run dev".into()),
                    program: None,
                }),
                tab: Some(1),
                key: Some("dev".into()),
                opened_by_you: true,
                ..PaneInfo::default()
            },
        ]
    }

    /// Open a pane, Open in another folder with a title, List panes, Request without the token is refused, Second
    /// call reuses, Own and opened panes, Agent asks for the user, Agent clears, Close own pane, Refuse another
    /// pane: what `tiili` prints and exits with, and what reaches the app.
    #[test]
    #[ignore = "host: binds a Unix socket, which the sandbox refuses; the cargo-test-host release check runs it"]
    fn open_and_list_reach_the_app_and_print_its_answer() {
        let dir = std::env::temp_dir().join(format!("tiili-cli-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let recorder = Arc::new(Recorder::default());
        let server = bind(&dir, TOKEN.into(), recorder.clone()).expect("binds");
        let socket = PathBuf::from(server.endpoint())
            .to_string_lossy()
            .into_owned();
        let here = std::env::current_dir()
            .expect("cwd")
            .to_string_lossy()
            .into_owned();
        let path = std::env::var("PATH").unwrap_or_default();
        let env = |token: &'static str| {
            vec![
                ("TIILI_SOCKET", socket.clone()),
                ("TIILI_TOKEN", token.to_string()),
                ("TIILI_PANE", "2".to_string()),
            ]
        };
        let open = |cwd: Option<&str>, title: Option<&str>, command: &[&str]| Op::Open {
            cwd: cwd.map(String::from),
            title: title.map(String::from),
            command: command.iter().map(|c| c.to_string()).collect(),
            path: Some(path.clone()),
            key: None,
        };
        let keyed = |key: &str, command: &[&str]| match open(Some(&here), None, command) {
            Op::Open {
                cwd,
                title,
                command,
                path,
                ..
            } => Op::Open {
                cwd,
                title,
                command,
                path,
                key: Some(key.to_string()),
            },
            other => other,
        };
        // Arguments, token, exit code, stdout, and what the app has seen by then.
        let cases: Vec<(&[&str], &'static str, i32, &str, Reached)> = vec![
            (
                &["open", "--", "tail", "-f", "x.log"],
                TOKEN,
                0,
                "42\n",
                Some((2, open(Some(&here), None, &["tail", "-f", "x.log"]))),
            ),
            (
                &["open", "--cwd", "/tmp", "--title", "logs", "--", "top"],
                TOKEN,
                0,
                "42\n",
                Some((2, open(Some("/tmp"), Some("logs"), &["top"]))),
            ),
            (
                &["list"],
                TOKEN,
                0,
                "2\t/work/app\tapp\n3\t/tmp\tlogs\n",
                Some((2, Op::List)),
            ),
            // Open as JSON.
            (
                &["open", "--json", "--", "npm", "test"],
                TOKEN,
                0,
                "{\"ok\":true,\"protocol\":1,\"pane\":42}\n",
                Some((2, open(Some(&here), None, &["npm", "test"]))),
            ),
            // Own pane and a dev server.
            (
                &["list", "--json"],
                TOKEN,
                0,
                concat!(
                    r#"{"ok":true,"protocol":1,"panes":["#,
                    r#"{"id":2,"self":true,"window":"main","cwd":"/work/app","host":null,"repo":null,"#,
                    r#""title":null,"label":"app","running":null,"attention":null,"#,
                    r#""tab":1,"key":null,"opened_by_you":false},"#,
                    r#"{"id":3,"self":false,"window":"main","cwd":"/tmp","host":null,"repo":null,"#,
                    r#""title":"logs","label":"tmp","running":{"command":"npm run dev","program":null},"#,
                    r#""attention":null,"tab":1,"key":"dev","opened_by_you":true}]}"#,
                    "\n"
                ),
                Some((2, Op::List)),
            ),
            (
                &["open", "--key", "dev", "--", "npm", "run", "dev"],
                TOKEN,
                0,
                "opened 42\n",
                Some((2, keyed("dev", &["npm", "run", "dev"]))),
            ),
            (
                &["open", "--key", "again", "--", "npm", "run", "dev"],
                TOKEN,
                0,
                "reused 42\n",
                Some((2, keyed("again", &["npm", "run", "dev"]))),
            ),
            // Second call reuses, as JSON.
            (
                &[
                    "open", "--key", "again", "--json", "--", "npm", "run", "dev",
                ],
                TOKEN,
                0,
                "{\"ok\":true,\"protocol\":1,\"pane\":42,\"reused\":true}\n",
                Some((2, keyed("again", &["npm", "run", "dev"]))),
            ),
            (
                &["attention", "Review ready"],
                TOKEN,
                0,
                "",
                Some((
                    2,
                    Op::Attention {
                        message: Some("Review ready".into()),
                        clear: false,
                    },
                )),
            ),
            (
                &["attention", "--clear"],
                TOKEN,
                0,
                "",
                Some((
                    2,
                    Op::Attention {
                        message: None,
                        clear: true,
                    },
                )),
            ),
            (
                &["close", "3"],
                TOKEN,
                0,
                "",
                Some((2, Op::Close { target: 3 })),
            ),
            (
                &["close", "5"],
                TOKEN,
                1,
                "",
                Some((2, Op::Close { target: 5 })),
            ),
            (
                &["open", "--", "fail"],
                TOKEN,
                1,
                "",
                Some((2, open(Some(&here), None, &["fail"]))),
            ),
            (
                &["list"],
                "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                1,
                "",
                None,
            ),
        ];
        for (args, token, code, stdout, seen) in cases {
            let before = recorder.0.lock().unwrap().len();
            let vars = env(token);
            let vars: Vec<(&str, &str)> = vars.iter().map(|(n, v)| (*n, v.as_str())).collect();
            let out = tiili(args, &vars);
            assert_eq!(out.status.code(), Some(code), "{args:?}");
            assert_eq!(String::from_utf8_lossy(&out.stdout), stdout, "{args:?}");
            // Attention and close print nothing on success.
            assert_eq!(out.stderr.is_empty(), code == 0, "{args:?}");
            if code != 0 {
                // Refused request carries a code: the CLI prints the app's suggestion.
                assert!(
                    String::from_utf8_lossy(&out.stderr).contains("\nhint: "),
                    "{args:?}"
                );
            }
            let recorded = recorder.0.lock().unwrap();
            assert_eq!(recorded.len(), before + seen.is_some() as usize, "{args:?}");
            if let Some(seen) = seen {
                assert_eq!(recorded.last(), Some(&seen), "{args:?}");
            }
        }
        drop(server);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
