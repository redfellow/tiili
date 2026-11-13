// @harvaaja-test-tier: host
//! Drives a real default shell through `PtySession`.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::{set_colour_env, PtySession};
use tiili_lib::shell_integration::command_for;

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
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn typing_reaches_the_shell_and_output_is_shown_then_exit_is_reported() {
    let (out_tx, out_rx) = mpsc::channel();
    let (exit_tx, exit_rx) = mpsc::channel();
    let session = PtySession::spawn(
        "off",
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

    // Truecolour advertised: every shell is told the terminal shows 24-bit colour.
    #[cfg(unix)]
    {
        session
            .write(b"echo \"colour=$COLORTERM\"\r")
            .expect("echo reaches the shell");
        assert!(
            wait_for(&out_rx, &mut seen, "\ncolour=truecolor"),
            "COLORTERM was not truecolor: {:?}",
            String::from_utf8_lossy(&seen)
        );
    }

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

/// A fresh folder under the temp folder, for a home or the integration scripts.
#[cfg(unix)]
fn temp_dir(name: &str) -> std::path::PathBuf {
    // Tests run in parallel threads of one process, so the process id alone would let them share folders.
    static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let unique = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "tiili-prompt-{}-{unique}-{name}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp folder");
    dir
}

/// Starts `shell` with the Classic prompt and a home holding only `rc` (if any) in `rc_name`, and returns what it
/// printed until `pattern` showed or the timeout passed, and whether it showed. With `then`, once `pattern` showed
/// it types the command and waits for that pattern too.
#[cfg(unix)]
fn classic_shell(
    shell: &str,
    rc: Option<(&str, &str)>,
    pattern: &str,
    then: Option<(&str, &str)>,
) -> (bool, String) {
    let tag = format!(
        "{}-{}",
        tiili_lib::command::program_name(shell),
        rc.is_some()
    );
    let home = temp_dir(&format!("home-{tag}"));
    if let Some((name, text)) = rc {
        std::fs::write(home.join(name), text).expect("rc file");
    }
    let mut cmd = command_for(shell, "classic", &temp_dir(&format!("scripts-{tag}")))
        .expect("zsh and bash have an integration");
    set_colour_env(&mut cmd);
    cmd.env("HOME", &home);
    cmd.env_remove("TIILI_USER_ZDOTDIR");
    cmd.env_remove("ZDOTDIR");
    cmd.env("BASH_SILENCE_DEPRECATION_WARNING", "1");
    let (out_tx, out_rx) = mpsc::channel();
    let session = PtySession::spawn_command(
        cmd,
        24,
        80,
        Box::new(move |data| {
            let _ = out_tx.send(data.to_vec());
        }),
        Box::new(|_| {}),
    )
    .expect("shell starts");
    let mut seen = Vec::new();
    let mut found = wait_for(&out_rx, &mut seen, pattern);
    if let (true, Some((command, next))) = (found, then) {
        session
            .write(format!("{command}\r").as_bytes())
            .expect("type the command");
        found = wait_for(&out_rx, &mut seen, next);
    }
    (found, String::from_utf8_lossy(&seen).into_owned())
}

/// Default zsh gets the chosen prompt / User's own prompt wins: with Classic, a zsh or bash whose config sets no
/// prompt shows Classic's coloured `user@host:path`, and one whose config sets PROMPT or PS1 keeps it.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn classic_prompt_applies_only_where_the_users_config_left_the_default() {
    // Classic's host part: the default colour after the user name, `@`, then green (ANSI slot 2).
    const CLASSIC: &str = "\x1b[39m@\x1b[32m";
    let cases: &[(&str, &str, &str)] = &[
        ("/bin/zsh", ".zshrc", "PROMPT='mine-zsh> '\n"),
        ("/bin/bash", ".bash_profile", "PS1='mine-bash> '\n"),
    ];
    for &(shell, rc_name, rc) in cases {
        if !std::path::Path::new(shell).exists() {
            eprintln!("{shell} is missing; skipped");
            continue;
        }
        let (found, seen) = classic_shell(shell, None, CLASSIC, None);
        assert!(found, "{shell} without a prompt of its own: {seen:?}");

        let mine = if shell.ends_with("zsh") {
            "mine-zsh> "
        } else {
            "mine-bash> "
        };
        let (found, seen) = classic_shell(shell, Some((rc_name, rc)), mine, None);
        assert!(
            found,
            "{shell} with its own prompt never showed it: {seen:?}"
        );
        assert!(
            !seen.contains(CLASSIC),
            "{shell} showed Classic over the user's prompt: {seen:?}"
        );
    }
}

/// History stays the user's: with Classic, a zsh whose /etc/zshrc puts HISTFILE in ZDOTDIR (macOS) keeps the history
/// in the user's home, not in tiili's integration folder.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn classic_zsh_keeps_the_users_history_file() {
    let sets_histfile = std::fs::read_to_string("/etc/zshrc")
        .is_ok_and(|text| text.contains("HISTFILE=${ZDOTDIR:-$HOME}/.zsh_history"));
    if !std::path::Path::new("/bin/zsh").exists() || !sets_histfile {
        eprintln!("no zsh whose /etc/zshrc sets HISTFILE from ZDOTDIR; skipped");
        return;
    }
    // The typed command shows `${HISTFILE#$HOME/}` literally, so only its output matches.
    let (found, seen) = classic_shell(
        "/bin/zsh",
        None,
        "\x1b[39m@\x1b[32m",
        Some((
            "print -r -- \"hist:${HISTFILE#$HOME/}\"",
            "\nhist:.zsh_history",
        )),
    );
    assert!(found, "HISTFILE is not the home's .zsh_history: {seen:?}");
}
