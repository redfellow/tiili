//! Follows what runs in each pane: the title a program sets itself (OSC 0 or 2) and, on macOS
//! and Linux, the name of the pseudo-terminal's foreground process. A title counts only while the
//! foreground process that was in front when it arrived stays there, so a stale title never lingers.

/// An OSC's introducer: `ESC ]`.
const OSC: &[u8] = b"\x1b]";
/// An unterminated OSC longer than this is dropped rather than buffered.
const MAX_OSC: usize = 4096;

/// Finds window titles (OSC 0 and OSC 2) in a program's output, including ones split across chunks.
#[derive(Default)]
pub struct TitleScanner {
    /// The unfinished end of the previous chunk: an OSC still waiting for its terminator, or an
    /// `ESC` that may start one.
    carry: Vec<u8>,
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// The title an OSC's body sets, for `0;title` and `2;title`; `None` for every other OSC.
fn title_of(body: &[u8]) -> Option<String> {
    let rest = body
        .strip_prefix(b"0;")
        .or_else(|| body.strip_prefix(b"2;"))?;
    Some(String::from_utf8_lossy(rest).into_owned())
}

impl TitleScanner {
    /// Scans the next chunk of output and returns the last complete title in it.
    pub fn feed(&mut self, data: &[u8]) -> Option<String> {
        if self.carry.is_empty() && !data.contains(&0x1b) {
            return None;
        }
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(data);
        let mut found = None;
        let mut pos = 0;
        while let Some(start) = find(&buf[pos..], OSC).map(|i| pos + i) {
            let body = start + OSC.len();
            // Ends at BEL or ESC \\; any other escape abandons it.
            let Some(end) = buf[body..].iter().position(|&b| b == 0x07 || b == 0x1b) else {
                if buf.len() - start <= MAX_OSC {
                    self.carry = buf[start..].to_vec();
                }
                return found;
            };
            let end = body + end;
            let terminator = match (buf[end], buf.get(end + 1)) {
                (0x07, _) => 1,
                (_, Some(b'\\')) => 2,
                (_, None) => {
                    self.carry = buf[start..].to_vec();
                    return found;
                }
                (_, Some(_)) => 0,
            };
            if terminator > 0 {
                if let Some(title) = title_of(&buf[body..end]) {
                    found = Some(title);
                }
            }
            pos = end + terminator;
        }
        // Keep a trailing ESC that could start an introducer split off by the chunk boundary.
        if buf[pos..].ends_with(b"\x1b") {
            self.carry = vec![0x1b];
        }
        found
    }
}

/// The pseudo-terminal's foreground process group and the name of its leader.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Foreground {
    pub pgid: i32,
    pub name: String,
}

/// Called whenever a pane's command changes.
pub type CommandFn = Box<dyn FnMut(&str) + Send>;

/// One pane's command: the title the foreground program set, else the foreground process's name,
/// else the shell's name.
pub struct CommandTracker {
    scanner: TitleScanner,
    shell: String,
    foreground: Option<Foreground>,
    /// The latest title, with the foreground process group that was in front when it arrived
    /// (`None` when that could not be read).
    title: Option<(Option<i32>, String)>,
    last: Option<String>,
    on_change: CommandFn,
}

impl CommandTracker {
    /// A tracker for a pane running `shell`; reports the shell's name at once.
    pub fn new(shell: String, on_change: CommandFn) -> Self {
        let mut tracker = Self {
            scanner: TitleScanner::default(),
            shell,
            foreground: None,
            title: None,
            last: None,
            on_change,
        };
        tracker.update();
        tracker
    }

    /// Scans the program's output for titles; `foreground` reads who is in front when one arrives.
    pub fn feed_output(&mut self, data: &[u8], foreground: impl FnOnce() -> Option<Foreground>) {
        let Some(title) = self.scanner.feed(data) else {
            return;
        };
        self.set_foreground(foreground());
        let pgid = self.foreground.as_ref().map(|f| f.pgid);
        // An empty title is how programs hand the title back.
        self.title = (!title.is_empty()).then_some((pgid, title));
        self.update();
    }

    /// The foreground process read from the pseudo-terminal, `None` where it cannot be read.
    pub fn report_foreground(&mut self, foreground: Option<Foreground>) {
        self.set_foreground(foreground);
        self.update();
    }

    fn set_foreground(&mut self, next: Option<Foreground>) {
        let Some(next) = next else {
            return;
        };
        if let Some((pgid, _)) = &mut self.title {
            match (*pgid, &self.foreground) {
                // A title seen before the foreground was first known belongs to the first one.
                (None, None) => *pgid = Some(next.pgid),
                (Some(seen), _) if seen != next.pgid => self.title = None,
                _ => {}
            }
        }
        self.foreground = Some(next);
    }

    /// What the pane runs now.
    pub fn current(&self) -> String {
        let pgid = self.foreground.as_ref().map(|f| f.pgid);
        match (&self.title, &self.foreground) {
            (Some((seen, title)), _) if *seen == pgid => title.clone(),
            (_, Some(fg)) if !fg.name.is_empty() => fg.name.clone(),
            _ => self.shell.clone(),
        }
    }

    fn update(&mut self) {
        let next = self.current();
        if self.last.as_ref() != Some(&next) {
            (self.on_change)(&next);
            self.last = Some(next);
        }
    }
}

/// The name a program goes by: the last part of `path`, without a leading `-` (login shells) or,
/// on Windows, its `.exe`.
pub fn program_name(path: &str) -> String {
    let base = path.rsplit(['/', '\\']).next().unwrap_or(path);
    let base = base.strip_prefix('-').unwrap_or(base);
    let lower = base.to_ascii_lowercase();
    if lower.ends_with(".exe") {
        base[..base.len() - 4].to_string()
    } else {
        base.to_string()
    }
}

/// The name of the user's default shell (`$SHELL`, or `%COMSPEC%` on Windows).
pub fn shell_name() -> String {
    let var = if cfg!(windows) { "COMSPEC" } else { "SHELL" };
    std::env::var(var)
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| program_name(&s))
        .unwrap_or_else(|| if cfg!(windows) { "cmd" } else { "sh" }.to_string())
}

/// The name of process `pid`, or `None` when it cannot be read.
#[cfg(target_os = "macos")]
pub fn process_name(pid: i32) -> Option<String> {
    libproc::libproc::proc_pid::name(pid)
        .ok()
        .map(|n| program_name(&n))
        .filter(|n| !n.is_empty())
}

/// The name of process `pid`, or `None` when it cannot be read.
#[cfg(target_os = "linux")]
pub fn process_name(pid: i32) -> Option<String> {
    std::fs::read_to_string(format!("/proc/{pid}/comm"))
        .ok()
        .map(|n| program_name(n.trim_end()))
        .filter(|n| !n.is_empty())
}

/// The name of process `pid`: never readable here, so panes show the shell's name.
#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub fn process_name(_pid: i32) -> Option<String> {
    None
}

/// Whether the `SigCgt` (caught signals) mask in a `/proc/<pid>/status` text has `signal` set; `None` when the
/// text has no readable mask.
pub fn sigcgt_catches(status: &str, signal: i32) -> Option<bool> {
    let bit = u32::try_from(signal).ok()?.checked_sub(1)?;
    let mask = status
        .lines()
        .find_map(|line| line.strip_prefix("SigCgt:"))
        .and_then(|hex| u64::from_str_radix(hex.trim(), 16).ok())?;
    Some(mask.checked_shr(bit)? & 1 == 1)
}

/// Whether process `pid` has a handler for `signal` (so the signal does not end it), or `None` when that cannot be
/// read.
#[cfg(target_os = "linux")]
pub fn catches_signal(pid: u32, signal: i32) -> Option<bool> {
    sigcgt_catches(
        &std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?,
        signal,
    )
}

/// Whether process `pid` has a handler for `signal` (so the signal does not end it), or `None` when that cannot be
/// read: `kp_proc.p_sigcatch` of its `kinfo_proc` from sysctl.
#[cfg(target_os = "macos")]
pub fn catches_signal(pid: u32, signal: i32) -> Option<bool> {
    // libc has no kinfo_proc for Apple: its size and the offsets used, the same on arm64 and x86_64 (LP64).
    const SIZE: usize = 648;
    const PID_AT: usize = 40;
    const SIGCATCH_AT: usize = 236;
    let pid = libc::c_int::try_from(pid).ok()?;
    let bit = u32::try_from(signal).ok()?.checked_sub(1)?;
    let mut mib = [libc::CTL_KERN, libc::KERN_PROC, libc::KERN_PROC_PID, pid];
    let mut buf = [0u8; SIZE];
    let mut len = SIZE;
    // SAFETY: buf holds `len` writable bytes; sysctl writes at most that many and reports how many.
    let ok = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            4,
            buf.as_mut_ptr().cast(),
            &mut len,
            std::ptr::null_mut(),
            0,
        )
    } == 0;
    let word = |at: usize| buf[at..at + 4].try_into().ok().map(u32::from_ne_bytes);
    // A missing process gives no record; a record for another pid means the layout is not the one assumed.
    if !ok || len != SIZE || word(PID_AT)? != pid as u32 {
        return None;
    }
    Some(word(SIGCATCH_AT)?.checked_shr(bit)? & 1 == 1)
}

/// Whether process `pid` has a handler for `signal`: never readable here.
#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub fn catches_signal(_pid: u32, _signal: i32) -> Option<bool> {
    None
}

#[cfg(test)]
mod tests {
    #[test]
    fn caught_signals_read_from_the_sigcgt_mask() {
        // SIGUSR1 is 10 on Linux: bit 9, 0x200.
        let cases = [
            ("Name:\tzsh\nSigCgt:\t0000000000000200\n", 10, Some(true)),
            ("SigCgt:\t0000000000010002\n", 10, Some(false)),
            ("SigCgt:\t0000000000010002\n", 2, Some(true)),
            ("SigCgt:\t8000000000000000\n", 64, Some(true)),
            ("Name:\tsleep\n", 10, None),
            ("SigCgt:\tzz\n", 10, None),
            ("SigCgt:\t0000000000000200\n", 0, None),
        ];
        for (status, signal, caught) in cases {
            assert_eq!(
                super::sigcgt_catches(status, signal),
                caught,
                "{status:?} {signal}"
            );
        }
    }

    use super::*;
    use std::sync::{Arc, Mutex};

    /// Chunks of output, and the title found after each chunk.
    type TitleCase = (
        &'static str,
        &'static [&'static [u8]],
        &'static [Option<&'static str>],
    );

    #[test]
    fn titles_in_output() {
        let cases: [TitleCase; 9] = [
            (
                "osc 0 bel",
                &[b"$ \x1b]0;vim a.txt\x07"],
                &[Some("vim a.txt")],
            ),
            (
                "osc 2 st",
                &[b"\x1b]2;red@mac: ~\x1b\\"],
                &[Some("red@mac: ~")],
            ),
            ("osc 1 is the icon", &[b"\x1b]1;icon\x07"], &[None]),
            ("osc 7 is a folder", &[b"\x1b]7;file://h/a\x07"], &[None]),
            (
                "last wins",
                &[b"\x1b]0;a\x07\x1b]7;file://h/x\x07\x1b]2;b\x07"],
                &[Some("b")],
            ),
            (
                "split body",
                &[b"x\x1b]2;lo", b"ng title\x07"],
                &[None, Some("long title")],
            ),
            (
                "split introducer",
                &[b"x\x1b", b"]0;t\x07"],
                &[None, Some("t")],
            ),
            (
                "split terminator",
                &[b"\x1b]0;t\x1b", b"\\"],
                &[None, Some("t")],
            ),
            ("abandoned", &[b"\x1b]0;t\x1b[m\x1b]2;"], &[None]),
        ];
        for (name, chunks, expected) in cases {
            let mut scanner = TitleScanner::default();
            let got: Vec<Option<String>> = chunks.iter().map(|c| scanner.feed(c)).collect();
            let want: Vec<Option<String>> = expected.iter().map(|e| e.map(String::from)).collect();
            assert_eq!(got, want, "{name}");
        }
    }

    fn fg(pgid: i32, name: &str) -> Option<Foreground> {
        Some(Foreground {
            pgid,
            name: name.into(),
        })
    }

    /// One step: a foreground report, or output with the foreground in front when it is read.
    enum Step {
        Poll(Option<Foreground>),
        Output(&'static [u8], Option<Foreground>),
    }

    #[test]
    fn command_follows_foreground_and_titles() {
        use Step::*;
        let cases: Vec<(&str, Vec<Step>, Vec<&str>)> = vec![
            ("idle shell", vec![Poll(fg(1, "zsh"))], vec!["zsh"]),
            (
                "Program running: top then back to the shell",
                vec![Poll(fg(1, "zsh")), Poll(fg(2, "top")), Poll(fg(1, "zsh"))],
                vec!["zsh", "top", "zsh"],
            ),
            (
                "Program sets its own title: until the foreground process changes",
                vec![
                    Poll(fg(1, "zsh")),
                    Output(b"\x1b]2;vim notes.md\x07", fg(2, "vim")),
                    Poll(fg(2, "vim")),
                    Poll(fg(1, "zsh")),
                ],
                vec!["zsh", "vim notes.md", "zsh"],
            ),
            (
                "shell's own title counts while it is in front",
                vec![
                    Output(b"\x1b]0;red@mac: ~\x07", None),
                    Poll(fg(1, "zsh")),
                    Poll(fg(2, "top")),
                ],
                vec!["zsh", "red@mac: ~", "top"],
            ),
            (
                "empty title hands back to the process name",
                vec![
                    Poll(fg(2, "vim")),
                    Output(b"\x1b]2;notes\x07", fg(2, "vim")),
                    Output(b"\x1b]2;\x07", fg(2, "vim")),
                ],
                vec!["zsh", "vim", "notes", "vim"],
            ),
            (
                "foreground unreadable: shell name, then titles",
                vec![Poll(None), Output(b"\x1b]0;C:\\Users\x07", None)],
                vec!["zsh", "C:\\Users"],
            ),
        ];
        for (name, steps, expected) in cases {
            let seen = Arc::new(Mutex::new(Vec::new()));
            let sink = Arc::clone(&seen);
            let mut tracker = CommandTracker::new(
                "zsh".into(),
                Box::new(move |c: &str| sink.lock().unwrap().push(c.to_string())),
            );
            for step in steps {
                match step {
                    Poll(f) => tracker.report_foreground(f),
                    Output(data, f) => tracker.feed_output(data, || f),
                }
            }
            assert_eq!(*seen.lock().unwrap(), expected, "{name}");
        }
    }

    #[test]
    fn program_names() {
        let cases = [
            ("/bin/zsh", "zsh"),
            ("-zsh", "zsh"),
            (r"C:\Windows\System32\cmd.exe", "cmd"),
            ("pwsh.EXE", "pwsh"),
            ("top", "top"),
        ];
        for (path, expected) in cases {
            assert_eq!(program_name(path), expected, "{path}");
        }
    }

    #[test]
    fn name_of_this_process() {
        let found = process_name(std::process::id() as i32);
        if cfg!(any(target_os = "linux", target_os = "macos")) {
            assert!(found.is_some_and(|n| !n.is_empty()));
        } else {
            assert_eq!(found, None);
        }
    }
}
