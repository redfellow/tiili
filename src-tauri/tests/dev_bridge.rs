// @harvaaja-test-tier: integration
//! Starts the `dev-bridge` binary and drives a real default shell through it over a WebSocket.

use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Error, Message, WebSocket};

const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef";
const TIMEOUT: Duration = Duration::from_secs(20);

/// The bridge process, killed when the test ends.
struct Bridge {
    child: Child,
    addr: String,
}

impl Drop for Bridge {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn start(token: Option<&str>) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_dev-bridge"));
    cmd.env("TIILI_BRIDGE_PORT", "0")
        .env_remove("TIILI_BRIDGE_TOKEN")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(token) = token {
        cmd.env("TIILI_BRIDGE_TOKEN", token);
    }
    cmd
}

fn bridge() -> Bridge {
    let mut child = start(Some(TOKEN)).spawn().expect("bridge starts");
    let mut line = String::new();
    BufReader::new(child.stdout.take().expect("stdout"))
        .read_line(&mut line)
        .expect("bridge prints its address");
    let addr = line
        .trim()
        .strip_prefix("listening on ")
        .expect("address line")
        .to_string();
    assert!(addr.starts_with("127.0.0.1:"), "{addr}");
    Bridge { child, addr }
}

fn connect(bridge: &Bridge, token: &str) -> Result<WebSocket<MaybeTlsStream<TcpStream>>, Error> {
    let url = format!(
        "ws://{}/pty?rows=24&cols=80&prompt=off&token={token}",
        bridge.addr
    );
    let (mut ws, _) = tungstenite::connect(url)?;
    if let MaybeTlsStream::Plain(stream) = ws.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_millis(100)))
            .unwrap();
    }
    Ok(ws)
}

fn send(ws: &mut WebSocket<MaybeTlsStream<TcpStream>>, data: &str) {
    let msg = serde_json::json!({ "type": "input", "data": data }).to_string();
    ws.send(Message::text(msg)).expect("input sent");
}

/// Reads until `done` says so from the output seen and the text messages received, or the timeout passes.
fn read_until(
    ws: &mut WebSocket<MaybeTlsStream<TcpStream>>,
    output: &mut Vec<u8>,
    texts: &mut Vec<String>,
    done: impl Fn(&[u8], &[String]) -> bool,
) -> bool {
    let deadline = Instant::now() + TIMEOUT;
    while Instant::now() < deadline {
        if done(output, texts) {
            return true;
        }
        match ws.read() {
            Ok(Message::Binary(bytes)) => output.extend_from_slice(&bytes),
            Ok(Message::Text(text)) => texts.push(text.as_str().to_string()),
            Ok(_) => {}
            Err(Error::Io(e))
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(_) => break,
        }
    }
    done(output, texts)
}

#[test]
fn bridge_refuses_to_start_without_a_token() {
    for token in [None, Some("short")] {
        let status = start(token).status().expect("bridge runs");
        assert!(!status.success(), "{token:?}");
    }
}

#[test]
fn wrong_token_the_bridge_refuses_the_handshake() {
    let bridge = bridge();
    for token in ["", "0123456789abcdef0123456789abcdef0123456789abcdee"] {
        match connect(&bridge, token) {
            Err(Error::Http(response)) => assert_eq!(response.status(), 403, "{token}"),
            Err(other) => panic!("unexpected error for {token:?}: {other}"),
            Ok(_) => panic!("handshake accepted with {token:?}"),
        }
    }
}

// @harvaaja-test-tier: host
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn shell_in_the_browser_output_is_shown_then_exit_is_reported() {
    let bridge = bridge();
    let mut ws = connect(&bridge, TOKEN).expect("handshake accepted");
    let (mut output, mut texts) = (Vec::new(), Vec::new());

    // The shell echoes what is typed, so the expected text only appears once the shell ran it.
    send(&mut ws, "echo hi-$((20+22))\r");
    assert!(
        read_until(&mut ws, &mut output, &mut texts, |out, _| {
            String::from_utf8_lossy(out).contains("hi-42")
        }),
        "output: {}",
        String::from_utf8_lossy(&output)
    );

    send(&mut ws, "exit\r");
    assert!(
        read_until(&mut ws, &mut output, &mut texts, |_, texts| {
            texts.iter().any(|t| {
                serde_json::from_str::<serde_json::Value>(t)
                    .is_ok_and(|v| v["type"] == "exit" && v["code"].is_number())
            })
        }),
        "texts: {texts:?}"
    );
}
