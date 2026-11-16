// @harvaaja-test-tier: host
//! Drives a real default shell through `PtySession`.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::pty::{set_colour_env, PtySession};
use tiili_lib::shell_integration::{command_for, write_highlight, write_prompt};

const TIMEOUT: Duration = Duration::from_secs(20);

/// The output with the shell's command marks (`ESC ] 1337;TiiliCmd=... BEL` or `... ESC \`) dropped, so a pattern
/// like `"\nhi"` matches what the command printed. Other marks, such as the folder's OSC 7, are kept.
fn without_command_marks(seen: &[u8]) -> String {
    const MARK: &str = "\x1b]1337;TiiliCmd=";
    let mut rest = String::from_utf8_lossy(seen).into_owned();
    let mut visible = String::with_capacity(rest.len());
    while let Some(start) = rest.find(MARK) {
        visible.push_str(&rest[..start]);
        let body = &rest[start + MARK.len()..];
        // An unfinished mark is dropped to the end; it completes with later output.
        let end = match (body.find('\x07'), body.find("\x1b\\")) {
            (Some(bel), Some(st)) if st < bel => st + 2,
            (Some(bel), _) => bel + 1,
            (None, Some(st)) => st + 2,
            (None, None) => body.len(),
        };
        rest = body[end..].to_string();
    }
    visible.push_str(&rest);
    visible
}

/// Collects output until `pattern` appears or the timeout passes.
fn wait_for(output: &mpsc::Receiver<Vec<u8>>, seen: &mut Vec<u8>, pattern: &str) -> bool {
    let deadline = Instant::now() + TIMEOUT;
    while Instant::now() < deadline {
        if without_command_marks(seen).contains(pattern) {
            return true;
        }
        if let Ok(chunk) = output.recv_timeout(Duration::from_millis(100)) {
            seen.extend(chunk);
        }
    }
    without_command_marks(seen).contains(pattern)
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

/// Starts `shell` through the integration with Off, `rc` (file name and text) in a fresh home that sets the prompt
/// `hl> ` and the `highlight` file holding #3C6680, and waits for the prompt. None when `shell` is missing.
#[cfg(unix)]
fn highlighted_shell(
    shell: &str,
    tag: &str,
    rc: &[(&str, &str)],
) -> Option<(PtySession, mpsc::Receiver<Vec<u8>>, Vec<u8>)> {
    if !std::path::Path::new(shell).exists() {
        eprintln!("{shell} is missing; skipped");
        return None;
    }
    let home = temp_dir(&format!("home-highlight-{tag}"));
    for (name, text) in rc {
        std::fs::write(home.join(name), text).expect("rc file");
    }
    let scripts = temp_dir(&format!("scripts-highlight-{tag}"));
    write_highlight(&scripts, "#3C6680").expect("highlight file");
    let mut cmd = command_for(shell, "off", &scripts).expect("zsh and bash have an integration");
    set_colour_env(&mut cmd);
    cmd.env("HOME", &home);
    cmd.env_remove("TIILI_USER_ZDOTDIR");
    cmd.env_remove("INPUTRC");
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
    assert!(
        wait_for(&out_rx, &mut seen, "hl> "),
        "{tag}: no prompt: {:?}",
        String::from_utf8_lossy(&seen)
    );
    Some((session, out_rx, seen))
}

/// Pastes `pasted` into `session` as a bracketed paste and asserts the shell draws it right after `sgr`.
#[cfg(unix)]
fn assert_paste_drawn(
    tag: &str,
    session: &PtySession,
    out_rx: &mpsc::Receiver<Vec<u8>>,
    seen: &mut Vec<u8>,
    sgr: &str,
) {
    session.write(b"\x1b[200~pasted\x1b[201~").expect("paste");
    let drawn = format!("{sgr}pasted");
    assert!(
        wait_for(out_rx, seen, &drawn),
        "{tag}: the paste was not drawn as {drawn:?}: {:?}",
        String::from_utf8_lossy(seen)
    );
}

/// 0x3C6680 is 60;102;128: the paste on that truecolour background.
const ON_HIGHLIGHT: &str = "\x1b[48;2;60;102;128m";

/// Pasted text in the theme's colour: an integrated zsh draws a bracketed paste on the background in the integration
/// folder's `highlight` file, not in reverse video, and keeps a paste highlight the user's .zshrc set itself.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn pasted_text_in_zsh_takes_the_highlight_file_colour() {
    let cases: &[(&str, &str, &str)] = &[
        ("zsh-default", "", "\nhl:paste:bg=#3C6680,region:bg=#3C6680"),
        (
            "zsh-own",
            "zle_highlight=(paste:none)\n",
            "\nhl:paste:none,region:bg=#3C6680",
        ),
    ];
    for &(tag, rc, expected) in cases {
        let rc = format!("{rc}PROMPT='hl> '\n");
        let Some((session, out_rx, mut seen)) =
            highlighted_shell("/bin/zsh", tag, &[(".zshrc", &rc)])
        else {
            return;
        };
        session
            .write(b"print -r -- \"hl:${(j:,:)zle_highlight}\"\r")
            .expect("type the command");
        assert!(
            wait_for(&out_rx, &mut seen, expected),
            "{tag}: zle_highlight was not {expected:?}: {:?}",
            String::from_utf8_lossy(&seen)
        );
        if tag == "zsh-default" {
            assert_paste_drawn(tag, &session, &out_rx, &mut seen, ON_HIGHLIGHT);
        }
    }
}

/// Pasted text in the theme's colour: an integrated bash 5.1 or later draws a bracketed paste on the `highlight`
/// file's background, and keeps a region colour the user's inputrc set itself. Runs on the bash 5 that is installed
/// (Homebrew's, or the system's on Linux); macOS's bash 3.2 highlights nothing.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn pasted_text_in_bash_takes_the_highlight_file_colour() {
    let Some(bash) = [
        "/opt/homebrew/bin/bash",
        "/usr/local/bin/bash",
        "/bin/bash",
        "/usr/bin/bash",
    ]
    .into_iter()
    .find(|bash| {
        std::process::Command::new(bash)
            .args([
                "-c",
                "(( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) ))",
            ])
            .status()
            .is_ok_and(|status| status.success())
    }) else {
        eprintln!("no bash 5.1 or later; skipped");
        return;
    };
    // Each case: its tag, the user's .inputrc, and how the paste must be drawn.
    let cases: &[(&str, Option<&str>, &str)] = &[
        ("bash-default", None, ON_HIGHLIGHT),
        (
            "bash-own",
            Some("set active-region-start-color \"\\e[4m\"\n"),
            "\x1b[4m",
        ),
    ];
    for &(tag, inputrc, sgr) in cases {
        let mut rc = vec![(".bash_profile", "PS1='hl> '\n")];
        rc.extend(inputrc.map(|text| (".inputrc", text)));
        let Some((session, out_rx, mut seen)) = highlighted_shell(bash, tag, &rc) else {
            return;
        };
        assert_paste_drawn(tag, &session, &out_rx, &mut seen, sgr);
    }
}

/// Up re-runs: a zsh and a bash started with a restored history line run it on Up then Enter and delete its file,
/// and report a typed command line while it runs, cleared once the prompt is back, but not one kept out of their
/// history by a leading space; bash with a user PROMPT_COMMAND ending in `; ` too.
#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn up_re_runs_zsh_and_bash_seed_history_and_report_the_typed_command() {
    use std::sync::{Arc, Mutex};
    use tiili_lib::command::CommandLineScanner;
    use tiili_lib::pty::RESTORE_HISTORY_VAR;

    const CLASSIC: &str = "\x1b[39m@\x1b[32m";
    for shell in ["/bin/zsh", "/bin/bash"] {
        if !std::path::Path::new(shell).exists() {
            eprintln!("{shell} is missing; skipped");
            continue;
        }
        let tag = format!("restore-{}", tiili_lib::command::program_name(shell));
        let home = temp_dir(&format!("home-{tag}"));
        let history = home.join("restore-line");
        std::fs::write(&history, "echo restored-$((40 + 2))").expect("history file");
        // A PROMPT_COMMAND ending in `; `, as `history -a; $PROMPT_COMMAND` leaves, must still run.
        std::fs::write(
            home.join(".bash_profile"),
            "PROMPT_COMMAND='history -a; '\n",
        )
        .expect("bash profile");
        let mut cmd = command_for(shell, "classic", &temp_dir(&format!("scripts-{tag}")))
            .expect("zsh and bash have an integration");
        set_colour_env(&mut cmd);
        cmd.env("HOME", &home);
        cmd.env_remove("TIILI_USER_ZDOTDIR");
        cmd.env("BASH_SILENCE_DEPRECATION_WARNING", "1");
        cmd.env(RESTORE_HISTORY_VAR, &history);
        let scanner = Arc::new(Mutex::new(CommandLineScanner::default()));
        let sink = Arc::clone(&scanner);
        let (out_tx, out_rx) = mpsc::channel();
        let session = PtySession::spawn_command(
            cmd,
            24,
            80,
            Box::new(move |data| {
                sink.lock().unwrap().feed(data);
                let _ = out_tx.send(data.to_vec());
            }),
            Box::new(|_| {}),
        )
        .expect("shell starts");
        let mut seen = Vec::new();
        assert!(
            wait_for(&out_rx, &mut seen, CLASSIC),
            "{shell} showed no prompt: {:?}",
            String::from_utf8_lossy(&seen)
        );

        session.write(b"\x1b[A\r").expect("Up then Enter");
        assert!(
            wait_for(&out_rx, &mut seen, "\nrestored-42"),
            "{shell} did not run the restored line on Up: {:?}",
            String::from_utf8_lossy(&seen)
        );
        assert!(!history.exists(), "{shell} left the history file behind");

        let line = |scanner: &Mutex<CommandLineScanner>| {
            scanner.lock().unwrap().line().map(str::to_string)
        };
        let mut poll = |want: Option<&str>| {
            let deadline = Instant::now() + TIMEOUT;
            while Instant::now() < deadline && line(&scanner).as_deref() != want {
                while let Ok(chunk) = out_rx.try_recv() {
                    seen.extend(chunk);
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            line(&scanner)
        };
        session.write(b"sleep 2\r").expect("type the command");
        assert_eq!(
            poll(Some("sleep 2")).as_deref(),
            Some("sleep 2"),
            "{shell} never reported sleep 2"
        );
        assert_eq!(
            poll(None),
            None,
            "{shell} kept reporting a command at the prompt"
        );

        // Under the ignore-space and ignore-dups options, a line repeating the newest entry is still reported, and
        // a line the shell keeps out of its history (a leading space) is not reported while it runs.
        let ignore = if shell.ends_with("zsh") {
            "setopt hist_ignore_space hist_ignore_dups\r"
        } else {
            "HISTCONTROL=ignoreboth\r"
        };
        session.write(ignore.as_bytes()).expect("set the options");
        assert_eq!(poll(None), None, "{shell} did not come back to the prompt");
        for run in ["first", "repeated"] {
            session.write(b"sleep 2\r").expect("type the command");
            assert_eq!(
                poll(Some("sleep 2")).as_deref(),
                Some("sleep 2"),
                "{shell} never reported the {run} sleep 2"
            );
            assert_eq!(poll(None), None, "{shell} did not come back to the prompt");
        }
        session
            .write(b" sleep 1; echo hidden-$((40 + 3))\r")
            .expect("type the hidden command");
        let deadline = Instant::now() + TIMEOUT;
        while Instant::now() < deadline && !String::from_utf8_lossy(&seen).contains("hidden-43") {
            assert_eq!(
                line(&scanner),
                None,
                "{shell} reported a line kept out of its history"
            );
            while let Ok(chunk) = out_rx.try_recv() {
                seen.extend(chunk);
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(
            String::from_utf8_lossy(&seen).contains("hidden-43"),
            "{shell} did not run the hidden command"
        );
    }
}

#[cfg(unix)]
#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn dropping_a_session_ends_a_shell_that_ignores_the_hangup() {
    let mut cmd = portable_pty::CommandBuilder::new("sh");
    cmd.args(["-c", "trap '' HUP; echo ready; sleep 30"]);
    let (out_tx, out_rx) = mpsc::channel();
    let (exit_tx, exit_rx) = mpsc::channel();
    let session = PtySession::spawn_command(
        cmd,
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
    let mut seen = Vec::new();
    assert!(
        wait_for(&out_rx, &mut seen, "ready"),
        "the trap was not set"
    );
    drop(session);
    assert!(
        exit_rx.recv_timeout(Duration::from_secs(5)).is_ok(),
        "the shell still ran 5 s after the session was dropped"
    );
}
