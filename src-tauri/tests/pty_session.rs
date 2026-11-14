// @harvaaja-test-tier: host
//! Drives a real default shell through `PtySession`.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::{set_colour_env, PtySession};
use tiili_lib::shell_integration::{command_for, write_prompt};

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
/// it types the command and waits for each of those patterns too.
fn classic_shell(
    shell: &str,
    rc: Option<(&str, &str)>,
    pattern: &str,
    then: Option<(&str, &[&str])>,
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
        found = next.iter().all(|p| wait_for(&out_rx, &mut seen, p));
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
            &["\nhist:.zsh_history"],
        )),
    );
    assert!(found, "HISTFILE is not the home's .zsh_history: {seen:?}");
}

/// Folder reported at every prompt: with Classic, zsh and bash, with and without their own prompt, send OSC 7 naming
/// this machine for `/tmp` before the prompt after `cd /tmp`, and the user's prompt hooks still run.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn folder_reported_at_every_prompt_zsh_and_bash_send_osc7() {
    const CLASSIC: &str = "\x1b[39m@\x1b[32m";
    let osc7 = format!("\x1b]7;file://{}/tmp\x07", tiili_lib::cwd::local_hostname());
    let cases: &[(&str, &str, &str, &str)] = &[
        (
            "/bin/zsh",
            ".zshrc",
            "PROMPT='mine-zsh> '\nprecmd() { print -n \"hook:$PWD\" }\n",
            "mine-zsh> ",
        ),
        (
            "/bin/bash",
            ".bash_profile",
            "PS1='mine-bash> '\nPROMPT_COMMAND='printf \"hook:%s\" \"$PWD\"'\n",
            "mine-bash> ",
        ),
    ];
    for &(shell, rc_name, rc, mine) in cases {
        if !std::path::Path::new(shell).exists() {
            eprintln!("{shell} is missing; skipped");
            continue;
        }
        let (found, seen) =
            classic_shell(shell, None, CLASSIC, Some(("cd /tmp", &[osc7.as_str()])));
        assert!(
            found,
            "{shell} with Classic sent no OSC 7 for /tmp: {seen:?}"
        );

        let (found, seen) = classic_shell(
            shell,
            Some((rc_name, rc)),
            mine,
            Some(("cd /tmp", &[osc7.as_str(), "hook:/tmp"])),
        );
        assert!(
            found,
            "{shell} with its own prompt and hook sent no OSC 7 for /tmp or lost its hook: {seen:?}"
        );
    }
}

/// Folder reported at every prompt on Windows: with Classic, PowerShell sends OSC 7 naming this machine and the
/// drive folder with forward slashes before the prompt after `cd C:\Windows`.
#[cfg(windows)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn folder_reported_at_every_prompt_powershell_sends_osc7() {
    let osc7 = format!("]7;file://{}/C:/Windows", tiili_lib::cwd::local_hostname());
    let (found, seen) = classic_shell(
        "powershell.exe",
        None,
        "]7;file://",
        Some((r"cd C:\Windows", &[osc7.as_str()])),
    );
    assert!(found, "PowerShell sent no OSC 7 for C:\\Windows: {seen:?}");
}

/// Open panes switch: a zsh and a bash whose config sets no prompt, started with Off, show the Classic prompt once
/// the prompt file says Classic and a newline is sent, without restarting.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn open_panes_switch_off_shells_show_classic_after_the_choice_changes() {
    const CLASSIC: &str = "\x1b[39m@\x1b[32m";
    for shell in ["/bin/zsh", "/bin/bash"] {
        if !std::path::Path::new(shell).exists() {
            eprintln!("{shell} is missing; skipped");
            continue;
        }
        let tag = format!("switch-{}", tiili_lib::command::program_name(shell));
        let home = temp_dir(&format!("home-{tag}"));
        let scripts = temp_dir(&format!("scripts-{tag}"));
        write_prompt(&scripts, "off").expect("prompt file");
        let mut cmd =
            command_for(shell, "off", &scripts).expect("zsh and bash start integrated with Off");
        set_colour_env(&mut cmd);
        cmd.env("HOME", &home);
        cmd.env_remove("TIILI_USER_ZDOTDIR");
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
        // The integration reports the folder before its first prompt.
        assert!(
            wait_for(&out_rx, &mut seen, "\x1b]7;file://"),
            "{shell} with Off never reached its prompt: {:?}",
            String::from_utf8_lossy(&seen)
        );
        assert!(
            !String::from_utf8_lossy(&seen).contains(CLASSIC),
            "{shell} with Off showed Classic: {:?}",
            String::from_utf8_lossy(&seen)
        );
        write_prompt(&scripts, "classic").expect("prompt file");
        session.write(b"\r").expect("send a newline");
        assert!(
            wait_for(&out_rx, &mut seen, CLASSIC),
            "{shell} did not switch to Classic: {:?}",
            String::from_utf8_lossy(&seen)
        );
    }
}

/// A started shell, its output, what it printed so far and its integration folder.
#[cfg(unix)]
type IdleShell = (
    PtySession,
    mpsc::Receiver<Vec<u8>>,
    Vec<u8>,
    std::path::PathBuf,
);

/// Starts an integrated zsh with Off and a home without startup files, the way tiili starts one that redraws on
/// SIGUSR1, and waits for its first prompt. `None` where there is no zsh.
#[cfg(unix)]
fn idle_off_zsh(tag: &str) -> Option<IdleShell> {
    let shell = "/bin/zsh";
    if !std::path::Path::new(shell).exists() {
        eprintln!("{shell} is missing; skipped");
        return None;
    }
    let home = temp_dir(&format!("home-{tag}"));
    let scripts = temp_dir(&format!("scripts-{tag}"));
    write_prompt(&scripts, "off").expect("prompt file");
    let mut cmd = command_for(shell, "off", &scripts).expect("zsh starts integrated with Off");
    set_colour_env(&mut cmd);
    cmd.env("HOME", &home);
    cmd.env_remove("TIILI_USER_ZDOTDIR");
    let (out_tx, out_rx) = mpsc::channel();
    let session = PtySession::spawn_integrated(
        cmd,
        true,
        24,
        80,
        Box::new(move |data| {
            let _ = out_tx.send(data.to_vec());
        }),
        Box::new(|_| {}),
    )
    .expect("shell starts");
    let mut seen = Vec::new();
    assert!(
        wait_for(&out_rx, &mut seen, "\x1b]7;file://"),
        "zsh with Off never reached its prompt: {:?}",
        String::from_utf8_lossy(&seen)
    );
    Some((session, out_rx, seen, scripts))
}

/// Open panes switch: a zsh started with Off and idle at its prompt redraws it as Classic once the prompt file says
/// Classic and the session is asked to redraw, with nothing typed into the shell.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn open_panes_switch_idle_zsh_redraws_classic_without_input() {
    const CLASSIC: &str = "\x1b[39m@\x1b[32m";
    let Some((session, out_rx, mut seen, scripts)) = idle_off_zsh("redraw") else {
        return;
    };
    write_prompt(&scripts, "classic").expect("prompt file");
    assert!(session.redraw_prompt(), "the idle zsh was not signalled");
    assert!(
        wait_for(&out_rx, &mut seen, CLASSIC),
        "the idle zsh did not redraw as Classic: {:?}",
        String::from_utf8_lossy(&seen)
    );
}

/// Open panes switch, never ending a pane: once the integrated zsh has `exec`'d a program without a SIGUSR1
/// handler, asking the session to redraw sends nothing and the program keeps running.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn open_panes_switch_zsh_replaced_by_exec_is_never_signalled() {
    let Some((session, _out_rx, _seen, scripts)) = idle_off_zsh("exec") else {
        return;
    };
    let pid = session.pid().expect("the shell's pid");
    session.write(b"exec sleep 30\r").expect("type exec");
    let deadline = Instant::now() + TIMEOUT;
    while tiili_lib::command::catches_signal(pid, libc::SIGUSR1) != Some(false) {
        assert!(Instant::now() < deadline, "zsh never exec'd sleep");
        std::thread::sleep(Duration::from_millis(50));
    }
    write_prompt(&scripts, "classic").expect("prompt file");
    assert!(!session.redraw_prompt(), "sleep was sent SIGUSR1");
    std::thread::sleep(Duration::from_millis(500));
    assert_eq!(
        tiili_lib::command::catches_signal(pid, libc::SIGUSR1),
        Some(false),
        "sleep is no longer running"
    );
}
