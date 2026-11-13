// @harvaaja-test-tier: host
//! Drives several real default shells through `SessionRegistry`.

use std::collections::HashMap;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::{SessionId, SessionRegistry};

const TIMEOUT: Duration = Duration::from_secs(20);

/// Output per session, gathered from the registry's shared output callback.
struct Outputs {
    rx: mpsc::Receiver<(SessionId, Vec<u8>)>,
    seen: HashMap<SessionId, Vec<u8>>,
}

impl Outputs {
    fn text(&self, id: SessionId) -> String {
        String::from_utf8_lossy(self.seen.get(&id).map(Vec::as_slice).unwrap_or_default())
            .into_owned()
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
