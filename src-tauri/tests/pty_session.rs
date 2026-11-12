// @harvaaja-test-tier: integration
//! Drives a real default shell through `PtySession`.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::PtySession;

const TIMEOUT: Duration = Duration::from_secs(20);

/// Collects output until `pattern` appears or the timeout passes.
fn wait_for(output: &mpsc::Receiver<Vec<u8>>, seen: &mut Vec<u8>, pattern: &str) -> bool {
    let deadline = Instant::now() + TIMEOUT;
    while Instant::now() < deadline {
        if String::from_utf8_lossy(seen).contains(pattern) {
            return true;
        }
        if let Ok(chunk) = output.recv_timeout(Duration::from_millis(100)) {
            seen.extend(chunk);
        }
    }
    String::from_utf8_lossy(seen).contains(pattern)
}

#[test]
fn typing_reaches_the_shell_and_output_is_shown_then_exit_is_reported() {
    let (out_tx, out_rx) = mpsc::channel();
    let (exit_tx, exit_rx) = mpsc::channel();
    let session = PtySession::spawn(
        24,
        80,
        Box::new(move |data| {
            let _ = out_tx.send(data.to_vec());
        }),
        Box::new(move |code| {
            let _ = exit_tx.send(code);
        }),
    )
    .expect("shell starts");

    session
        .write(b"echo tiili-ok\r")
        .expect("write reaches the shell");
    let mut seen = Vec::new();
    // The typed line echoes `echo tiili-ok`; the command's own output starts a new line.
    assert!(
        wait_for(&out_rx, &mut seen, "\ntiili-ok"),
        "shell output never showed tiili-ok: {:?}",
        String::from_utf8_lossy(&seen)
    );

    session.resize(40, 120).expect("resize is accepted");
    // Resize is sent to the shell: the shell sees the new rows and columns.
    #[cfg(unix)]
    {
        session
            .write(b"stty size\r")
            .expect("stty reaches the shell");
        assert!(
            wait_for(&out_rx, &mut seen, "40 120"),
            "shell never saw 40 rows and 120 columns: {:?}",
            String::from_utf8_lossy(&seen)
        );
    }

    session.write(b"exit\r").expect("exit reaches the shell");
    exit_rx.recv_timeout(TIMEOUT).expect("exit is reported");
    assert!(
        session.write(b"echo late\r").is_err(),
        "writing after exit fails"
    );
}
