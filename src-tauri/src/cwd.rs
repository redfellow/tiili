//! Follows each shell's working directory: reads another process's working directory (so a new
//! pane can start where the focused one is and panes follow `cd` on macOS and Linux), and picks up
//! the OSC 7 reports shells send on every platform.

use std::path::PathBuf;
use std::time::Duration;

use crate::repo::{find_repo, Repo};

/// How often a shell's working directory is read on macOS and Linux.
pub const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// OSC 7's introducer: `ESC ] 7 ;`.
const OSC7: &[u8] = b"\x1b]7;";
/// An unterminated OSC 7 longer than this is dropped rather than buffered.
const MAX_OSC7: usize = 4096;

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = |b: u8| (b as char).to_digit(16);
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// The folder an OSC 7 report names: `file://host/path`, percent-decoded. A Windows drive path
/// (`/C:/x`, or `/C:\x` from cmd's prompt) becomes `C:\x`. `None` for anything but a `file://` URL.
pub fn osc7_path(uri: &str) -> Option<String> {
    let rest = uri.strip_prefix("file://")?;
    let path = percent_decode(&rest[rest.find('/')?..]);
    let b = path.as_bytes();
    if b.len() >= 3 && b[1].is_ascii_alphabetic() && b[2] == b':' {
        let mut windows = path[1..].replace('/', "\\");
        if windows.len() == 2 {
            windows.push('\\');
        }
        return Some(windows);
    }
    Some(path)
}

/// Finds OSC 7 reports in a shell's output, including ones split across chunks.
#[derive(Default)]
pub struct Osc7Scanner {
    /// The unfinished end of the previous chunk: an OSC 7 still waiting for its terminator, or
    /// bytes that may start one.
    carry: Vec<u8>,
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

impl Osc7Scanner {
    /// Scans the next chunk of output and returns the folder of the last complete OSC 7 in it.
    pub fn feed(&mut self, data: &[u8]) -> Option<String> {
        if self.carry.is_empty() && !data.contains(&0x1b) {
            return None;
        }
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(data);
        let mut found = None;
        let mut pos = 0;
        while let Some(start) = find(&buf[pos..], OSC7).map(|i| pos + i) {
            let body = start + OSC7.len();
            // Ends at BEL or ESC \\; any other escape abandons it.
            let Some(end) = buf[body..].iter().position(|&b| b == 0x07 || b == 0x1b) else {
                if buf.len() - start <= MAX_OSC7 {
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
                if let Some(path) = std::str::from_utf8(&buf[body..end])
                    .ok()
                    .and_then(osc7_path)
                {
                    found = Some(path);
                }
            }
            pos = end + terminator;
        }
        // Keep a tail that could be the start of an introducer split off by the chunk boundary.
        let tail = &buf[pos..];
        let keep = (1..OSC7.len())
            .rev()
            .find(|&k| tail.ends_with(&OSC7[..k]))
            .unwrap_or(0);
        self.carry = tail[tail.len() - keep..].to_vec();
        found
    }
}

/// Where a pane's shell is: its working directory and the repository that holds it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PaneCwd {
    pub cwd: PathBuf,
    pub repo: Option<Repo>,
}

/// Called whenever a pane's working directory or repository changes.
pub type CwdFn = Box<dyn FnMut(&PaneCwd) + Send>;

/// One shell's working directory, from OSC 7 and from polling. Once the shell has sent OSC 7,
/// polled values are ignored: OSC 7 wins.
pub struct CwdTracker {
    scanner: Osc7Scanner,
    from_osc7: bool,
    last: Option<PaneCwd>,
    on_change: CwdFn,
}

impl CwdTracker {
    pub fn new(on_change: CwdFn) -> Self {
        Self {
            scanner: Osc7Scanner::default(),
            from_osc7: false,
            last: None,
            on_change,
        }
    }

    /// Scans the shell's output for OSC 7.
    pub fn feed_output(&mut self, data: &[u8]) {
        if let Some(path) = self.scanner.feed(data) {
            self.from_osc7 = true;
            self.update(PathBuf::from(path));
        }
    }

    /// A working directory read from the shell process (or the folder it started in).
    pub fn report_polled(&mut self, cwd: PathBuf) {
        if !self.from_osc7 {
            self.update(cwd);
        }
    }

    fn update(&mut self, cwd: PathBuf) {
        let next = PaneCwd {
            repo: find_repo(&cwd),
            cwd,
        };
        if self.last.as_ref() != Some(&next) {
            (self.on_change)(&next);
            self.last = Some(next);
        }
    }
}

/// The working directory of process `pid`, or `None` when it cannot be read (always on Windows,
/// where ConPTY gives no way to read a child's working directory).
#[cfg(target_os = "linux")]
pub fn process_cwd(pid: u32) -> Option<PathBuf> {
    std::fs::read_link(format!("/proc/{pid}/cwd")).ok()
}

/// `proc_pidinfo`'s vnode path flavour, whose `pvi_cdir` is the process's working directory.
/// (libproc's own `pidcwd` is not implemented on macOS.)
#[cfg(target_os = "macos")]
struct VnodePathInfo(libc::proc_vnodepathinfo);

#[cfg(target_os = "macos")]
impl libproc::libproc::proc_pid::PIDInfo for VnodePathInfo {
    fn flavor() -> libproc::libproc::proc_pid::PidInfoFlavor {
        libproc::libproc::proc_pid::PidInfoFlavor::VNodePathInfo
    }
}

/// The working directory of process `pid`, or `None` when it cannot be read.
#[cfg(target_os = "macos")]
pub fn process_cwd(pid: u32) -> Option<PathBuf> {
    use std::os::unix::ffi::OsStringExt;

    let info: VnodePathInfo =
        libproc::libproc::proc_pid::pidinfo(i32::try_from(pid).ok()?, 0).ok()?;
    let path: Vec<u8> = info
        .0
        .pvi_cdir
        .vip_path
        .iter()
        .flatten()
        .take_while(|&&c| c != 0)
        .map(|&c| c as u8)
        .collect();
    (!path.is_empty()).then(|| PathBuf::from(std::ffi::OsString::from_vec(path)))
}

/// The working directory of process `pid`: never readable here, so new panes start in the home folder.
#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub fn process_cwd(_pid: u32) -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn osc7_paths() {
        let cases = [
            ("file://mac.local/Users/red/code", Some("/Users/red/code")),
            ("file:///home/red", Some("/home/red")),
            (
                "file://host/Users/red/My%20Code/%C3%A4",
                Some("/Users/red/My Code/ä"),
            ),
            ("file://host/odd%zz%2", Some("/odd%zz%2")),
            ("file://PC/C:/Users/red/code", Some(r"C:\Users\red\code")),
            ("file://PC/C:\\Users\\red", Some(r"C:\Users\red")),
            ("file://PC/D:", Some(r"D:\")),
            ("file://PC/c%3A/x", Some(r"c:\x")),
            ("http://host/x", None),
            ("file://host", None),
        ];
        for (uri, expected) in cases {
            assert_eq!(osc7_path(uri).as_deref(), expected, "{uri}");
        }
    }

    /// Chunks of output, and the folder reported after each chunk.
    type OutputCase = (
        &'static str,
        &'static [&'static [u8]],
        &'static [Option<&'static str>],
    );

    #[test]
    fn osc7_in_output() {
        let cases: [OutputCase; 7] = [
            ("bel", &[b"$ \x1b]7;file://h/a\x07ls\r\n"], &[Some("/a")]),
            ("st", &[b"\x1b]7;file://h/a\x1b\\"], &[Some("/a")]),
            (
                "last wins",
                &[b"\x1b]7;file://h/a\x07\x1b]7;file://h/b\x07"],
                &[Some("/b")],
            ),
            (
                "split body",
                &[b"x\x1b]7;file://h/lo", b"ng/path\x07"],
                &[None, Some("/long/path")],
            ),
            (
                "split introducer",
                &[b"x\x1b]", b"7;file://h/a\x07"],
                &[None, Some("/a")],
            ),
            (
                "split terminator",
                &[b"\x1b]7;file://h/a\x1b", b"\\"],
                &[None, Some("/a")],
            ),
            (
                "other escapes",
                &[b"\x1b[0m\x1b]0;title\x07\x1b]7;file://h/a\x1b[m"],
                &[None],
            ),
        ];
        for (name, chunks, expected) in cases {
            let mut scanner = Osc7Scanner::default();
            let got: Vec<Option<String>> = chunks.iter().map(|c| scanner.feed(c)).collect();
            let want: Vec<Option<String>> = expected.iter().map(|e| e.map(String::from)).collect();
            assert_eq!(got, want, "{name}");
        }
    }

    #[test]
    fn osc7_wins_over_polling() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let mut tracker = CwdTracker::new(Box::new(move |c: &PaneCwd| {
            sink.lock().unwrap().push(c.cwd.clone());
        }));
        tracker.report_polled(PathBuf::from("/start"));
        tracker.report_polled(PathBuf::from("/start"));
        tracker.feed_output(b"\x1b]7;file://h/osc\x07");
        tracker.report_polled(PathBuf::from("/polled"));
        assert_eq!(
            *seen.lock().unwrap(),
            vec![PathBuf::from("/start"), PathBuf::from("/osc")]
        );
    }

    #[test]
    fn cwd_of_this_process() {
        let found = process_cwd(std::process::id());
        if cfg!(any(target_os = "linux", target_os = "macos")) {
            let expected = std::env::current_dir().expect("current dir");
            assert_eq!(
                found.map(|p| p.canonicalize().expect("canonical")),
                Some(expected.canonicalize().expect("canonical"))
            );
        } else {
            assert_eq!(found, None);
        }
    }
}
