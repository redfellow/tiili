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
use tiili_lib::control_server::{bind, respond, Handler};
use tiili_lib::pty::SessionId;

const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/// What reached the handler, in order: the caller and the op it carried out.
type Seen = Vec<(SessionId, Op)>;

#[derive(Default)]
struct Recorder(Mutex<Seen>);

impl Handler for Recorder {
    fn open(
        &self,
        caller: SessionId,
        cwd: Option<String>,
        title: Option<String>,
        command: Vec<String>,
        path: Option<String>,
    ) -> Result<SessionId, String> {
        self.0.lock().unwrap().push((
            caller,
            Op::Open {
                cwd,
                title,
                command,
                path,
            },
        ));
        Ok(caller + 40)
    }

    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
        self.0.lock().unwrap().push((caller, Op::List));
        if caller == 99 {
            return Err("pane 99 is in no window".into());
        }
        Ok(vec![tmp_pane(caller)])
    }
}

/// The pane the recorder lists: every field of the record set, so all of it crosses the wire.
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
            Ok(Reply::Opened(42)),
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
                },
            ),
            Ok(Reply::Opened(45)),
            2,
        ),
        (request_line(TOKEN, 99, &list), Err("list_failed"), 3),
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
