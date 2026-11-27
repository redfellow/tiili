// @harvaaja-test-tier: host
//! Talks to a real control socket bound in a temporary folder, with a handler that records what reaches it.
#![cfg(unix)]

use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tiili_lib::control::{
    parse_reply, request_line, AttentionRecord, CliError, Op, PaneInfo, Reply, RunningRecord,
};
use tiili_lib::control_server::{bind, respond, Handler, OpenRequest};
use tiili_lib::pty::SessionId;

const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/// What reached the handler, in order: the caller and the op it carried out.
type Seen = Vec<(SessionId, Op)>;

#[derive(Default)]
struct Recorder(Mutex<Seen>);

impl Handler for Recorder {
    fn open(&self, caller: SessionId, request: OpenRequest) -> Result<(SessionId, bool), String> {
        let OpenRequest {
            cwd,
            title,
            command,
            path,
            key,
            minimized,
        } = request;
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
                minimized,
            },
        ));
        Ok((caller + 40, reused))
    }

    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
        self.0.lock().unwrap().push((caller, Op::List));
        if caller == 99 {
            return Err("pane 99 is in no window".into());
        }
        Ok(vec![tmp_pane(caller)])
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
        if caller == 99 {
            return Err("pane 99 is in no window".into());
        }
        Ok(())
    }

    fn close(&self, caller: SessionId, target: SessionId) -> Result<(), CliError> {
        self.0.lock().unwrap().push((caller, Op::Close { target }));
        // Pane 5 stands for one the caller did not open, pane 6 for one that is gone.
        match target {
            5 => Err(CliError::NotOpenedByYou(
                "pane 5 was not opened by this pane".into(),
            )),
            6 => Err(CliError::NoSuchPane("there is no pane 6".into())),
            _ => Ok(()),
        }
    }

    fn minimize(
        &self,
        caller: SessionId,
        target: Option<SessionId>,
        minimize: bool,
    ) -> Result<(), CliError> {
        let op = if minimize {
            Op::Minimize { target }
        } else {
            Op::Restore { target }
        };
        self.0.lock().unwrap().push((caller, op));
        // Pane 5 stands for one the caller did not open; pane 7 is its tab's only visible pane.
        match (target, minimize) {
            (Some(5), _) => Err(CliError::NotOpenedByYou(
                "pane 5 was not opened by this pane".into(),
            )),
            (None, true) if caller == 7 => Err(CliError::LastVisiblePane(
                "pane 7 is the only pane showing in its tab".into(),
            )),
            _ => Ok(()),
        }
    }

    fn panes(&self) -> Result<Vec<PaneInfo>, String> {
        self.0.lock().unwrap().push((0, Op::Panes));
        Ok(vec![PaneInfo {
            is_self: false,
            key: None,
            opened_by_you: false,
            ..tmp_pane(3)
        }])
    }
}

/// The pane the recorder lists: every field of the record set, minimized too, so all of it crosses the wire.
fn tmp_pane(id: SessionId) -> PaneInfo {
    PaneInfo {
        id,
        is_self: true,
        window: "main".into(),
        cwd: "/tmp".into(),
        host: None,
        repo: None,
        title: Some("logs".into()),
        label: "tmp".into(),
        running: Some(RunningRecord {
            command: Some("tail -f x.log".into()),
            program: Some("tail".into()),
        }),
        attention: Some(AttentionRecord {
            message: Some("done".into()),
        }),
        tab: Some(1),
        key: Some("dev".into()),
        opened_by_you: true,
        minimized: true,
    }
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("tiili-cs-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn ask(socket: &Path, line: &str) -> Result<Reply, CliError> {
    let mut stream = UnixStream::connect(socket).expect("socket accepts");
    stream
        .write_all(format!("{line}\n").as_bytes())
        .expect("request sent");
    let mut reply = String::new();
    BufReader::new(stream)
        .read_line(&mut reply)
        .expect("reply read");
    parse_reply(&reply)
}

/// Local control endpoint: the socket is 0600 in a 0700 folder and goes away with the server.
#[test]
#[ignore = "host: binds a Unix socket, which the sandbox refuses; the cargo-test-host release check runs it"]
fn local_control_endpoint_is_private_to_the_user() {
    let dir = temp_dir("private");
    let server = bind(&dir, TOKEN.into(), Arc::new(Recorder::default())).expect("binds");
    let socket = PathBuf::from(server.endpoint());
    assert_eq!(socket.parent(), Some(dir.as_path()));
    let mode = |p: &Path| std::fs::metadata(p).expect("exists").permissions().mode() & 0o777;
    assert_eq!(mode(&socket), 0o600);
    assert_eq!(mode(&dir), 0o700);
    drop(server);
    assert!(!socket.exists(), "the socket is removed with the server");
    let _ = std::fs::remove_dir_all(&dir);
}

/// A folder someone opened up is closed again before the socket goes in.
#[test]
#[ignore = "host: binds a Unix socket, which the sandbox refuses; the cargo-test-host release check runs it"]
fn local_control_endpoint_tightens_an_open_folder() {
    let dir = temp_dir("open");
    std::fs::create_dir_all(&dir).expect("folder");
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).expect("chmod");
    let server = bind(&dir, TOKEN.into(), Arc::new(Recorder::default())).expect("binds");
    let mode = std::fs::metadata(&dir)
        .expect("exists")
        .permissions()
        .mode()
        & 0o777;
    assert_eq!(mode, 0o700);
    drop(server);
    let _ = std::fs::remove_dir_all(&dir);
}

/// Request with the right token, Request without the token is refused, Malformed request.
#[test]
#[ignore = "host: binds a Unix socket, which the sandbox refuses; the cargo-test-host release check runs it"]
fn request_with_the_right_token_reaches_the_handler_and_others_are_refused() {
    let dir = temp_dir("requests");
    let recorder = Arc::new(Recorder::default());
    let server = bind(&dir, TOKEN.into(), recorder.clone()).expect("binds");
    let socket = PathBuf::from(server.endpoint());
    let open = Op::Open {
        cwd: Some("/tmp".into()),
        title: Some("logs".into()),
        command: vec!["tail".into(), "-f".into(), "x.log".into()],
        path: Some("/opt/bin:/usr/bin".into()),
        key: None,
        minimized: false,
    };
    let wrong = "f".repeat(64);
    // The line sent, the reply expected (an error just has to be one), and what the handler then holds.
    let cases: Vec<(String, Result<Reply, ()>, Seen)> = vec![
        (request_line(&wrong, 3, &Op::List), Err(()), vec![]),
        (request_line(&wrong, 3, &open), Err(()), vec![]),
        (r#"{"pane":3,"op":"list"}"#.into(), Err(()), vec![]),
        ("garbage".into(), Err(()), vec![]),
        (
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"open","command":[]}}"#),
            Err(()),
            vec![],
        ),
        (
            request_line(TOKEN, 3, &Op::List),
            Ok(Reply::Listed(vec![tmp_pane(3)])),
            vec![(3, Op::List)],
        ),
        (
            request_line(TOKEN, 2, &open),
            Ok(Reply::Opened {
                pane: 42,
                reused: false,
            }),
            vec![(3, Op::List), (2, open.clone())],
        ),
        // A failure in the handler comes back as an error.
        (
            request_line(TOKEN, 99, &Op::List),
            Err(()),
            vec![(3, Op::List), (2, open.clone()), (99, Op::List)],
        ),
    ];
    for (line, reply, seen) in cases {
        assert_eq!(ask(&socket, &line).map_err(|_| ()), reply, "{line}");
        assert_eq!(*recorder.0.lock().unwrap(), seen, "{line}");
    }
    drop(server);
    let _ = std::fs::remove_dir_all(&dir);
}

/// Request with the right token, Request without the token is refused, Malformed request: the answer a connection
/// gets, without the socket.
#[test]
fn request_with_the_right_token_is_answered_and_others_are_refused() {
    let recorder = Recorder::default();
    let list = Op::List;
    let wrong = "f".repeat(64);
    // The line, the reply expected (an error by its code) and how many calls reached the handler.
    let cases: Vec<(String, Result<Reply, &str>, usize)> = vec![
        (request_line(&wrong, 3, &list), Err("bad_token"), 0),
        (
            format!("{}\n", request_line(TOKEN, 3, &list)),
            Ok(Reply::Listed(vec![tmp_pane(3)])),
            1,
        ),
        ("{}".into(), Err("bad_token"), 1),
        (
            format!(r#"{{"token":"{TOKEN}","op":"list"}}"#),
            Err("malformed_request"),
            1,
        ),
        (
            request_line(
                TOKEN,
                5,
                &Op::Open {
                    cwd: None,
                    title: None,
                    command: vec!["top".into()],
                    path: None,
                    key: None,
                    minimized: false,
                },
            ),
            Ok(Reply::Opened {
                pane: 45,
                reused: false,
            }),
            2,
        ),
        (request_line(TOKEN, 99, &list), Err("list_failed"), 3),
        // Second call reuses: a keyed open the app already holds answers with the same pane, marked reused.
        (
            request_line(
                TOKEN,
                5,
                &Op::Open {
                    cwd: None,
                    title: None,
                    command: vec!["npm".into()],
                    path: None,
                    key: Some("again".into()),
                    minimized: false,
                },
            ),
            Ok(Reply::Opened {
                pane: 45,
                reused: true,
            }),
            4,
        ),
        // Empty key is malformed and never reaches the handler.
        (
            format!(r#"{{"token":"{TOKEN}","pane":5,"op":"open","command":["npm"],"key":""}}"#),
            Err("malformed_request"),
            4,
        ),
        // Agent asks for the user, Agent clears.
        (
            request_line(
                TOKEN,
                5,
                &Op::Attention {
                    message: Some("Review ready".into()),
                    clear: false,
                },
            ),
            Ok(Reply::Done),
            5,
        ),
        (
            request_line(
                TOKEN,
                5,
                &Op::Attention {
                    message: None,
                    clear: true,
                },
            ),
            Ok(Reply::Done),
            6,
        ),
        (
            format!(
                r#"{{"token":"{TOKEN}","pane":5,"op":"attention","message":"hi","clear":true}}"#
            ),
            Err("malformed_request"),
            6,
        ),
        (
            request_line(
                TOKEN,
                99,
                &Op::Attention {
                    message: Some("hi".into()),
                    clear: false,
                },
            ),
            Err("attention_failed"),
            7,
        ),
        // Close own pane, Refuse another pane, Close a pane that is gone: no_such_pane.
        (
            request_line(TOKEN, 2, &Op::Close { target: 3 }),
            Ok(Reply::Done),
            8,
        ),
        (
            request_line(TOKEN, 2, &Op::Close { target: 5 }),
            Err("not_opened_by_you"),
            9,
        ),
        (
            request_line(TOKEN, 2, &Op::Close { target: 6 }),
            Err("no_such_pane"),
            10,
        ),
    ];
    for (line, reply, calls) in cases {
        let answer = respond(&line, TOKEN, &recorder);
        assert!(!answer.contains('\n'), "one line: {answer}");
        assert_eq!(parse_reply(&answer).map_err(|e| e.code()), reply, "{line}");
        if reply.is_err() {
            let wire: serde_json::Value = serde_json::from_str(&answer).expect("json reply");
            assert!(
                wire["suggestion"].as_str().is_some_and(|s| !s.is_empty()),
                "{answer}"
            );
        }
        assert_eq!(recorder.0.lock().unwrap().len(), calls, "{line}");
    }
}

/// Minimize own pane, Restore an opened pane, Refuse another pane, Last visible pane: each `minimize` and `restore`
/// line reaches the handler as the op it names, and the handler's refusal comes back by its code.
#[test]
fn minimize_and_restore_reach_the_handler_as_sent() {
    // The caller, the op sent, and the reply expected (an error by its code).
    let cases: Vec<(SessionId, Op, Result<Reply, &str>)> = vec![
        (3, Op::Minimize { target: None }, Ok(Reply::Done)),
        (3, Op::Minimize { target: Some(8) }, Ok(Reply::Done)),
        (3, Op::Restore { target: None }, Ok(Reply::Done)),
        (3, Op::Restore { target: Some(8) }, Ok(Reply::Done)),
        (
            3,
            Op::Minimize { target: Some(5) },
            Err("not_opened_by_you"),
        ),
        (3, Op::Restore { target: Some(5) }, Err("not_opened_by_you")),
        (7, Op::Minimize { target: None }, Err("last_visible_pane")),
    ];
    for (caller, op, reply) in cases {
        let recorder = Recorder::default();
        let line = request_line(TOKEN, caller, &op);
        let answer = respond(&line, TOKEN, &recorder);
        assert_eq!(parse_reply(&answer).map_err(|e| e.code()), reply, "{line}");
        assert_eq!(*recorder.0.lock().unwrap(), vec![(caller, op)], "{line}");
    }
}

/// The token-free `panes` request: read-only, answered without a token or a pane, over the real socket.
#[test]
#[ignore = "host: binds a Unix socket, which the sandbox refuses; the cargo-test-host release check runs it"]
fn panes_are_listed_without_a_token() {
    let dir = temp_dir("panes");
    let recorder = Arc::new(Recorder::default());
    let server = bind(&dir, TOKEN.into(), recorder.clone()).expect("binds");
    let socket = PathBuf::from(server.endpoint());
    match ask(&socket, r#"{"protocol":1,"op":"panes"}"#) {
        Ok(Reply::Listed(panes)) => {
            assert_eq!(panes.len(), 1);
            assert_eq!(
                (panes[0].window.as_str(), panes[0].key.as_deref()),
                ("main", None)
            );
        }
        other => panic!("not listed: {other:?}"),
    }
    assert_eq!(*recorder.0.lock().unwrap(), vec![(0, Op::Panes)]);
    drop(server);
    let _ = std::fs::remove_dir_all(&dir);
}

/// The same through `respond`, which every endpoint uses: no token needed for `panes`, still needed for `list`.
#[test]
fn panes_need_no_token_but_list_still_does() {
    let recorder = Recorder::default();
    let listed = respond(r#"{"protocol":1,"op":"panes"}"#, TOKEN, &recorder);
    assert!(
        matches!(parse_reply(&listed), Ok(Reply::Listed(p)) if p.len() == 1),
        "{listed}"
    );
    let refused = respond(r#"{"protocol":1,"pane":3,"op":"list"}"#, TOKEN, &recorder);
    assert!(refused.contains(r#""code":"bad_token""#), "{refused}");
    assert_eq!(*recorder.0.lock().unwrap(), vec![(0, Op::Panes)]);
}
