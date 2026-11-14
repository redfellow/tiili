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

/// Outside tiili, Missing command: `tiili` exits non-zero, prints nothing on stdout and says why on stderr.
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
        (&["open", "--", "ls"], &[], 1),
        (&["list"], &[], 1),
        (&["open"], &inside, 2),
        (&["open", "--"], &inside, 2),
        (&["list", "extra"], &inside, 2),
        // Inside a pane whose app has gone.
        (&["list"], &inside, 1),
    ];
    for (args, env, code) in cases {
        let out = tiili(args, env);
        assert_eq!(out.status.code(), Some(*code), "{args:?} {env:?}");
        assert!(out.stdout.is_empty(), "{args:?} printed {:?}", out.stdout);
        assert!(!out.stderr.is_empty(), "{args:?} said nothing");
    }
}

#[cfg(unix)]
mod listener {
    use std::sync::{Arc, Mutex};

    use tiili_lib::control::{Op, PaneInfo};
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
        ) -> Result<SessionId, String> {
            let failing = command.first().map(String::as_str) == Some("fail");
            self.0.lock().unwrap().push((
                caller,
                Op::Open {
                    cwd,
                    title,
                    command,
                    path,
                },
            ));
            if failing {
                return Err("no such program".into());
            }
            Ok(caller + 40)
        }

        fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
            self.0.lock().unwrap().push((caller, Op::List));
            Ok(vec![
                PaneInfo {
                    id: caller,
                    cwd: "/work/app".into(),
                    title: "app".into(),
                },
                PaneInfo {
                    id: caller + 1,
                    cwd: "/tmp".into(),
                    title: "logs".into(),
                },
            ])
        }
    }

    /// Open a command pane, Open in a folder, Open with a title, List panes, Wrong token: what `tiili` prints and
    /// exits with, and what reaches the app.
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
            assert_eq!(out.stderr.is_empty(), code == 0, "{args:?}");
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
