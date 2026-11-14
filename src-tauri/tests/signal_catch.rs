// @harvaaja-test-tier: integration
//! Reads whether real processes catch SIGUSR1, the check that keeps tiili from signalling a process the signal
//! would end.
#![cfg(any(target_os = "linux", target_os = "macos"))]

use std::process::{Child, Command};
use std::time::{Duration, Instant};

use tiili_lib::command::catches_signal;

/// Polls until `pid`'s answer is `want` or a few seconds pass, and returns the last answer.
fn settle(pid: u32, want: Option<bool>) -> Option<bool> {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let got = catches_signal(pid, libc::SIGUSR1);
        if got == want || Instant::now() > deadline {
            return got;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn processes_that_catch_sigusr1_are_told_apart_from_those_it_would_end() {
    let start = |script: &str| -> Child {
        Command::new("/bin/sh")
            .args(["-c", script])
            .spawn()
            .expect("sh starts")
    };
    let cases: [(&str, &str, bool); 2] = [
        ("a program without a handler", "exec sleep 30", false),
        (
            "a shell with a handler",
            "trap : USR1; while :; do sleep 1; done",
            true,
        ),
    ];
    for (name, script, catches) in cases {
        let mut child = start(script);
        let got = settle(child.id(), Some(catches));
        let _ = child.kill();
        let _ = child.wait();
        assert_eq!(got, Some(catches), "{name}");
    }
    // A process that no longer exists cannot be read, so it is never signalled.
    let mut gone = start("exit 0");
    let pid = gone.id();
    let _ = gone.wait();
    assert_eq!(catches_signal(pid, libc::SIGUSR1), None, "an ended process");
}
