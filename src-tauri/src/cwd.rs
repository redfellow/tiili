//! Follows each shell's working directory: reads another process's working directory (so a new
//! pane can start where the focused one is and panes follow `cd` on macOS and Linux), and picks up
//! the OSC 7 reports shells send on every platform.

use std::path::PathBuf;
use std::time::Duration;

use crate::command::Foreground;
use crate::repo::{find_repo, Repo};

/// How often a shell's working directory is read on macOS and Linux.
pub const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// An OSC's introducer: `ESC ]`.
const OSC: &[u8] = b"\x1b]";
/// An OSC 7 body starts with this.
const OSC7: &[u8] = b"7;";
/// A user variable report's body starts with this (iTerm2's and WezTerm's `SetUserVar`).
const USER_VAR: &[u8] = b"1337;SetUserVar=";
/// The user variable a remote shell names its git root with.
const REPO_VAR: &str = "tiili_repo";
/// A report longer than this is ignored, and an unterminated one dropped rather than buffered.
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

/// `text` without C0 and C1 control characters, so a shell's report can only be displayed.
fn clean(text: &str) -> String {
    text.chars().filter(|c| !c.is_control()).collect()
}

/// What an OSC 7 report names: the host (percent-decoded, empty for `file:///path`) and the folder.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Osc7 {
    pub host: String,
    pub path: String,
}

/// Whether `path`, as [`parse_osc7`] returns it, starts with a Windows drive (`C:`).
fn has_drive(path: &str) -> bool {
    let b = path.as_bytes();
    b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':'
}

/// Parses an OSC 7 report, `file://host/path`, percent-decoded and without control characters. A
/// Windows drive path (`/C:/x`, or `/C:\x` from cmd's prompt) becomes `C:\x`. `None` for anything
/// but a `file://` URL.
pub fn parse_osc7(uri: &str) -> Option<Osc7> {
    let rest = uri.strip_prefix("file://")?;
    let slash = rest.find('/')?;
    let host = clean(&percent_decode(&rest[..slash]));
    let path = clean(&percent_decode(&rest[slash..]));
    if has_drive(&path[1..]) {
        let mut windows = path[1..].replace('/', "\\");
        if windows.len() == 2 {
            windows.push('\\');
        }
        return Some(Osc7 {
            host,
            path: windows,
        });
    }
    Some(Osc7 { host, path })
}

/// Decodes standard base64, with or without padding; `None` when `text` is not base64.
fn base64_decode(text: &str) -> Option<Vec<u8>> {
    let digits = text.trim_end_matches('=').as_bytes();
    if text.len() - digits.len() > 2 || digits.len() % 4 == 1 {
        return None;
    }
    let value = |c: u8| -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32)
    };
    let mut out = Vec::with_capacity(digits.len() * 3 / 4);
    for group in digits.chunks(4) {
        let mut bits = 0u32;
        for (i, &c) in group.iter().enumerate() {
            bits |= value(c)? << (18 - 6 * i);
        }
        let bytes = bits.to_be_bytes();
        out.extend_from_slice(&bytes[1..group.len()]);
    }
    Some(out)
}

/// The repository root a `SetUserVar` body (`name=base64`) reports: `Some(None)` for an empty
/// `tiili_repo`, `None` for other variables and values that are not base64.
fn parse_repo_var(body: &str) -> Option<Option<String>> {
    let value = body.strip_prefix(REPO_VAR)?.strip_prefix('=')?;
    let root = clean(&String::from_utf8_lossy(&base64_decode(value)?));
    Some((!root.is_empty()).then_some(root))
}

/// A report a shell sends about where it is.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Report {
    /// OSC 7: the shell's host and folder.
    Cwd(Osc7),
    /// `tiili_repo`: the remote repository's root, `None` outside any.
    Repo(Option<String>),
}

fn report_of(body: &[u8]) -> Option<Report> {
    if body.len() > MAX_OSC7 {
        return None;
    }
    if let Some(uri) = body.strip_prefix(OSC7) {
        return parse_osc7(std::str::from_utf8(uri).ok()?).map(Report::Cwd);
    }
    let var = body.strip_prefix(USER_VAR)?;
    parse_repo_var(std::str::from_utf8(var).ok()?).map(Report::Repo)
}

/// Finds OSC 7 and `tiili_repo` reports in a shell's output, including ones split across chunks.
#[derive(Default)]
pub struct Osc7Scanner {
    /// The unfinished end of the previous chunk: an OSC still waiting for its terminator, or an
    /// `ESC` that may start one.
    carry: Vec<u8>,
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

impl Osc7Scanner {
    /// Scans the next chunk of output and returns its complete reports, in order.
    pub fn feed(&mut self, data: &[u8]) -> Vec<Report> {
        let mut found = Vec::new();
        if self.carry.is_empty() && !data.contains(&0x1b) {
            return found;
        }
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(data);
        let mut pos = 0;
        while let Some(start) = find(&buf[pos..], OSC).map(|i| pos + i) {
            let body = start + OSC.len();
            // Ends at BEL or ESC \; any other escape abandons it.
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
                found.extend(report_of(&buf[body..end]));
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

/// Whether `host` is this machine, named `local`: empty, `localhost`, or `local` case-insensitively,
/// in full or by its first dot-separated label (`mac.local` = `mac`).
pub fn is_local_host(host: &str, local: &str) -> bool {
    let first = |name: &str| name.split('.').next().unwrap_or("").to_lowercase();
    host.is_empty()
        || host.eq_ignore_ascii_case("localhost")
        || host.to_lowercase() == local.to_lowercase()
        || (!first(host).is_empty() && first(host) == first(local))
}

/// The host a report makes the pane remote on, or `None` when the pane is local. On Windows a
/// path without a drive letter is never local: it is WSL's, labelled `WSL` when its host is this
/// machine.
pub fn remote_host(report: &Osc7, local: &str, windows: bool) -> Option<String> {
    let local_host = is_local_host(&report.host, local);
    match (local_host, windows && !has_drive(&report.path)) {
        (true, false) => None,
        (true, true) => Some("WSL".to_string()),
        (false, _) => Some(report.host.clone()),
    }
}

/// This machine's hostname, read once (`gethostname` on Unix, `COMPUTERNAME` on Windows).
pub fn local_hostname() -> &'static str {
    static NAME: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    NAME.get_or_init(read_hostname)
}

#[cfg(unix)]
fn read_hostname() -> String {
    let mut buf = [0u8; 256];
    // SAFETY: the buffer is valid for its length, and gethostname writes at most that many bytes.
    let ok = unsafe { libc::gethostname(buf.as_mut_ptr().cast(), buf.len()) } == 0;
    if !ok {
        return String::new();
    }
    let len = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
    String::from_utf8_lossy(&buf[..len]).into_owned()
}

#[cfg(not(unix))]
fn read_hostname() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_default()
}

/// A remote repository named after its root's last folder (`/` or `\` separated).
fn remote_repo(root: String) -> Repo {
    let name = root
        .split(['/', '\\'])
        .rfind(|s| !s.is_empty())
        .unwrap_or(&root)
        .to_string();
    Repo {
        root: PathBuf::from(root),
        name,
    }
}

/// Where a pane's shell is: its working directory, the repository that holds it, and the host
/// it is on (`None` for this machine).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PaneCwd {
    pub cwd: PathBuf,
    pub repo: Option<Repo>,
    pub host: Option<String>,
}

/// Called whenever a pane's working directory or repository changes.
pub type CwdFn = Box<dyn FnMut(&PaneCwd) + Send>;

/// The latest OSC 7: its folder, the remote host it names, and the foreground process group that
/// was in front when it arrived (`None` when that could not be read).
struct Osc7State {
    path: PathBuf,
    host: Option<String>,
    pgid: Option<i32>,
}

/// One shell's working directory, from OSC 7 and from polling. While the latest OSC 7 stands,
/// polled values are ignored: OSC 7 wins. An OSC 7 that came from a program other than the shell
/// stands until the shell is back in front.
pub struct CwdTracker {
    scanner: Osc7Scanner,
    local_host: String,
    windows: bool,
    shell_pgid: Option<i32>,
    osc7: Option<Osc7State>,
    /// The repository a remote shell reported with `tiili_repo`.
    remote_repo: Option<Repo>,
    last: Option<PaneCwd>,
    on_change: CwdFn,
}

impl CwdTracker {
    pub fn new(on_change: CwdFn) -> Self {
        Self::for_host(local_hostname(), cfg!(windows), on_change)
    }

    /// A tracker on a machine named `local_host`, with Windows' path rules when `windows`.
    pub fn for_host(local_host: &str, windows: bool, on_change: CwdFn) -> Self {
        Self {
            scanner: Osc7Scanner::default(),
            local_host: local_host.to_string(),
            windows,
            shell_pgid: None,
            osc7: None,
            remote_repo: None,
            last: None,
            on_change,
        }
    }

    /// The shell's own process group: its pid, as it leads its session.
    pub fn set_shell_pgid(&mut self, pgid: i32) {
        self.shell_pgid = Some(pgid);
    }

    /// Scans the shell's output for reports; `foreground` reads who is in front when one arrives.
    pub fn feed_output(&mut self, data: &[u8], foreground: impl FnOnce() -> Option<Foreground>) {
        let reports = self.scanner.feed(data);
        if reports.is_empty() {
            return;
        }
        let mut foreground = Some(foreground);
        let mut pgid = None;
        for report in reports {
            match report {
                Report::Cwd(osc7) => {
                    if let Some(read) = foreground.take() {
                        pgid = read().map(|f| f.pgid);
                    }
                    let host = remote_host(&osc7, &self.local_host, self.windows);
                    if self.osc7.as_ref().map(|o| &o.host) != Some(&host) {
                        // A pane going remote, or to another host, has no repository until one is reported.
                        self.remote_repo = None;
                    }
                    self.osc7 = Some(Osc7State {
                        path: PathBuf::from(osc7.path),
                        host,
                        pgid,
                    });
                }
                Report::Repo(root) => {
                    if self.osc7.as_ref().is_some_and(|o| o.host.is_some()) {
                        self.remote_repo = root.map(remote_repo);
                    }
                }
            }
        }
        if let Some(osc7) = &self.osc7 {
            let next = match &osc7.host {
                Some(host) => PaneCwd {
                    cwd: osc7.path.clone(),
                    repo: self.remote_repo.clone(),
                    host: Some(host.clone()),
                },
                None => local(osc7.path.clone()),
            };
            self.emit(next);
        }
    }

    /// Who is in front now. Once the shell is back in front, an OSC 7 another process group sent
    /// is dropped, and the pane follows its polled folder again.
    pub fn report_foreground(&mut self, foreground: Option<&Foreground>) {
        let (Some(front), Some(shell)) = (foreground, self.shell_pgid) else {
            return;
        };
        let from_other = self
            .osc7
            .as_ref()
            .and_then(|o| o.pgid)
            .is_some_and(|pgid| pgid != shell);
        if front.pgid == shell && from_other {
            self.osc7 = None;
            self.remote_repo = None;
        }
    }

    /// A working directory read from the shell process (or the folder it started in).
    pub fn report_polled(&mut self, cwd: PathBuf) {
        if self.osc7.is_none() {
            self.emit(local(cwd));
        }
    }

    fn emit(&mut self, next: PaneCwd) {
        if self.last.as_ref() != Some(&next) {
            (self.on_change)(&next);
            self.last = Some(next);
        }
    }
}

/// A local folder and the repository on this machine's disk that holds it.
fn local(cwd: PathBuf) -> PaneCwd {
    PaneCwd {
        repo: find_repo(&cwd),
        cwd,
        host: None,
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
            (
                "file://mac.local/Users/red/code",
                Some(("mac.local", "/Users/red/code")),
            ),
            ("file:///home/red", Some(("", "/home/red"))),
            ("file://build-box/x", Some(("build-box", "/x"))),
            ("file://localhost/x", Some(("localhost", "/x"))),
            ("file://build%2Dbox%20two/x", Some(("build-box two", "/x"))),
            (
                "file://host/Users/red/My%20Code/%C3%A4",
                Some(("host", "/Users/red/My Code/ä")),
            ),
            ("file://host/odd%zz%2", Some(("host", "/odd%zz%2"))),
            (
                "file://PC/C:/Users/red/code",
                Some(("PC", r"C:\Users\red\code")),
            ),
            ("file://PC/C:\\Users\\red", Some(("PC", r"C:\Users\red"))),
            ("file://PC/D:", Some(("PC", r"D:\"))),
            ("file://PC/c%3A/x", Some(("PC", r"c:\x"))),
            // Hostile host name: control characters go, markup stays as text.
            (
                "file://evil%1B%5B31m%07%C2%9B<b>/x%0Ay",
                Some(("evil[31m<b>", "/xy")),
            ),
            ("http://host/x", None),
            ("file://host", None),
        ];
        for (uri, expected) in cases {
            let want = expected.map(|(host, path)| Osc7 {
                host: host.to_string(),
                path: path.to_string(),
            });
            assert_eq!(parse_osc7(uri), want, "{uri}");
        }
    }

    fn cwd(host: &str, path: &str) -> Report {
        Report::Cwd(Osc7 {
            host: host.to_string(),
            path: path.to_string(),
        })
    }

    fn repo(root: Option<&str>) -> Report {
        Report::Repo(root.map(String::from))
    }

    /// A case's name, chunks of output, and the reports found after each chunk.
    type OutputCase<'a> = (&'a str, Vec<&'a [u8]>, Vec<Vec<Report>>);

    #[test]
    fn osc7_in_output() {
        let long = format!("\x1b]7;file://h/{}\x07", "a".repeat(MAX_OSC7));
        let cases: Vec<OutputCase> = vec![
            (
                "bel",
                vec![b"$ \x1b]7;file://h/a\x07ls\r\n"],
                vec![vec![cwd("h", "/a")]],
            ),
            (
                "st",
                vec![b"\x1b]7;file://h/a\x1b\\"],
                vec![vec![cwd("h", "/a")]],
            ),
            (
                "in order",
                vec![b"\x1b]7;file://h/a\x07\x1b]7;file://h/b\x07"],
                vec![vec![cwd("h", "/a"), cwd("h", "/b")]],
            ),
            (
                "split body",
                vec![b"x\x1b]7;file://h/lo", b"ng/path\x07"],
                vec![vec![], vec![cwd("h", "/long/path")]],
            ),
            (
                "split introducer",
                vec![b"x\x1b]", b"7;file://h/a\x07"],
                vec![vec![], vec![cwd("h", "/a")]],
            ),
            (
                "split escape",
                vec![b"x\x1b", b"]7;file://h/a\x07"],
                vec![vec![], vec![cwd("h", "/a")]],
            ),
            (
                "split terminator",
                vec![b"\x1b]7;file://h/a\x1b", b"\\"],
                vec![vec![], vec![cwd("h", "/a")]],
            ),
            (
                "other escapes",
                vec![b"\x1b[0m\x1b]0;title\x07\x1b]7;file://h/a\x1b[m"],
                vec![vec![]],
            ),
            ("too long", vec![long.as_bytes()], vec![vec![]]),
            (
                "repo bel",
                vec![b"\x1b]1337;SetUserVar=tiili_repo=L3Nydi9hcGk=\x07"],
                vec![vec![repo(Some("/srv/api"))]],
            ),
            (
                "repo st, no padding",
                vec![b"\x1b]1337;SetUserVar=tiili_repo=L3Nydi9hcGk\x1b\\"],
                vec![vec![repo(Some("/srv/api"))]],
            ),
            (
                "repo split",
                vec![
                    b"\x1b]1337;SetUser",
                    b"Var=tiili_repo=L3Nydi9h",
                    b"cGk=\x07",
                ],
                vec![vec![], vec![], vec![repo(Some("/srv/api"))]],
            ),
            (
                "repo empty",
                vec![b"\x1b]1337;SetUserVar=tiili_repo=\x07"],
                vec![vec![repo(None)]],
            ),
            (
                "other user var",
                vec![b"\x1b]1337;SetUserVar=other=L3Nydi9hcGk=\x07"],
                vec![vec![]],
            ),
            (
                "bad base64",
                vec![b"\x1b]1337;SetUserVar=tiili_repo=*not*\x07"],
                vec![vec![]],
            ),
            (
                "cwd then repo",
                vec![
                    b"\x1b]7;file://b/srv/api\x07\x1b]1337;SetUserVar=tiili_repo=L3Nydi9hcGk=\x07",
                ],
                vec![vec![cwd("b", "/srv/api"), repo(Some("/srv/api"))]],
            ),
        ];
        for (name, chunks, want) in cases {
            let mut scanner = Osc7Scanner::default();
            let got: Vec<Vec<Report>> = chunks.iter().map(|c| scanner.feed(c)).collect();
            assert_eq!(got, want, "{name}");
        }
    }

    #[test]
    fn base64_values() {
        let cases: [(&str, Option<&[u8]>); 6] = [
            ("", Some(b"")),
            ("YQ==", Some(b"a")),
            ("YWI", Some(b"ab")),
            ("YWJj", Some(b"abc")),
            ("Y", None),
            ("YW=I", None),
        ];
        for (text, want) in cases {
            assert_eq!(base64_decode(text).as_deref(), want, "{text}");
        }
    }

    #[test]
    fn local_and_remote_hosts() {
        // (host, path as parsed, local name, windows) -> remote host
        let cases = [
            ("", "/x", "mac", false, None),
            ("localhost", "/x", "mac", false, None),
            ("LocalHost", "/x", "mac", false, None),
            ("mac", "/x", "mac", false, None),
            ("MAC.local", "/x", "mac", false, None),
            ("mac", "/x", "Mac.local", false, None),
            ("build-box", "/x", "mac", false, Some("build-box")),
            ("macbook", "/x", "mac", false, Some("macbook")),
            ("PC", r"C:\x", "pc", true, None),
            ("PC", "/home/red", "pc", true, Some("WSL")),
            ("", "/home/red", "pc", true, Some("WSL")),
            ("ubuntu-box", "/home/red", "pc", true, Some("ubuntu-box")),
        ];
        for (host, path, local, windows, want) in cases {
            let report = Osc7 {
                host: host.to_string(),
                path: path.to_string(),
            };
            assert_eq!(
                remote_host(&report, local, windows).as_deref(),
                want,
                "{host} {path} on {local}"
            );
        }
    }

    #[test]
    fn this_machine_has_a_name() {
        assert!(!local_hostname().is_empty());
    }

    const SHELL: i32 = 100;
    const SSH: i32 = 200;

    fn fg(pgid: i32) -> Foreground {
        Foreground {
            pgid,
            name: String::new(),
        }
    }

    /// A tracker on a Unix machine named `mac` whose shell leads group [`SHELL`], and what it reported.
    fn tracker() -> (CwdTracker, Arc<Mutex<Vec<PaneCwd>>>) {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let mut tracker = CwdTracker::for_host(
            "mac",
            false,
            Box::new(move |c: &PaneCwd| sink.lock().unwrap().push(c.clone())),
        );
        tracker.set_shell_pgid(SHELL);
        (tracker, seen)
    }

    fn remote(host: &str, cwd: &str, root: Option<&str>) -> PaneCwd {
        PaneCwd {
            cwd: PathBuf::from(cwd),
            repo: root.map(|r| remote_repo(r.to_string())),
            host: Some(host.to_string()),
        }
    }

    fn here(cwd: &str) -> PaneCwd {
        PaneCwd {
            cwd: PathBuf::from(cwd),
            repo: None,
            host: None,
        }
    }

    const API: &[u8] = b"\x1b]7;file://build-box/srv/api/src\x07";
    /// `tiili_repo` with the base64 of `/srv/api`.
    const API_REPO: &[u8] = b"\x1b]1337;SetUserVar=tiili_repo=L3Nydi9hcGk=\x07";

    #[test]
    fn osc7_wins_over_polling() {
        let (mut tracker, seen) = tracker();
        tracker.report_polled(PathBuf::from("/start"));
        tracker.report_polled(PathBuf::from("/start"));
        tracker.feed_output(b"\x1b]7;file://mac/osc\x07", || Some(fg(SHELL)));
        tracker.report_polled(PathBuf::from("/polled"));
        assert_eq!(*seen.lock().unwrap(), vec![here("/start"), here("/osc")]);
    }

    #[test]
    fn remote_panes_and_their_repository() {
        // (name, outputs fed in turn, last report)
        let cases: [(&str, &[&[u8]], PaneCwd); 7] = [
            (
                "ssh with OSC 7: remote, no local lookup",
                &[API],
                remote("build-box", "/srv/api/src", None),
            ),
            (
                "Same path exists locally: still remote",
                &[b"\x1b]7;file://build-box/tmp\x07"],
                remote("build-box", "/tmp", None),
            ),
            (
                "Repository reported",
                &[API, API_REPO],
                remote("build-box", "/srv/api/src", Some("/srv/api")),
            ),
            (
                "Left the repository",
                &[
                    API,
                    API_REPO,
                    b"\x1b]7;file://build-box/tmp\x07\x1b]1337;SetUserVar=tiili_repo=\x07",
                ],
                remote("build-box", "/tmp", None),
            ),
            (
                "Local shell sends the variable: ignored",
                &[b"\x1b]7;file://mac/srv\x07", API_REPO],
                here("/srv"),
            ),
            (
                "Going remote starts without a repository",
                &[API, API_REPO, b"\x1b]7;file://staging/srv/api\x07"],
                remote("staging", "/srv/api", None),
            ),
            (
                "Same host keeps its repository until the next report",
                &[API, API_REPO, b"\x1b]7;file://build-box/srv/api\x07"],
                remote("build-box", "/srv/api", Some("/srv/api")),
            ),
        ];
        for (name, outputs, want) in cases {
            let (mut tracker, seen) = tracker();
            for output in outputs {
                tracker.feed_output(output, || Some(fg(SSH)));
            }
            assert_eq!(seen.lock().unwrap().last(), Some(&want), "{name}");
        }
    }

    #[test]
    fn remote_repository_is_named_after_its_last_folder() {
        let cases = [
            ("/srv/api", "api"),
            ("/srv/api/", "api"),
            (r"C:\code\tiili", "tiili"),
            ("/", "/"),
        ];
        for (root, name) in cases {
            assert_eq!(remote_repo(root.to_string()).name, name, "{root}");
        }
    }

    #[test]
    fn exit_ssh_on_macos_or_linux_returns_to_the_polled_folder() {
        let (mut tracker, seen) = tracker();
        tracker.report_polled(PathBuf::from("/home"));
        tracker.feed_output(API, || Some(fg(SSH)));
        tracker.feed_output(API_REPO, || Some(fg(SSH)));
        tracker.report_foreground(Some(&fg(SSH)));
        tracker.report_polled(PathBuf::from("/home"));
        assert_eq!(
            seen.lock().unwrap().last(),
            Some(&remote("build-box", "/srv/api/src", Some("/srv/api")))
        );
        tracker.report_foreground(Some(&fg(SHELL)));
        tracker.report_polled(PathBuf::from("/home"));
        assert_eq!(seen.lock().unwrap().last(), Some(&here("/home")));
    }

    #[test]
    fn local_shell_with_its_own_osc7_keeps_it_after_vim() {
        let (mut tracker, seen) = tracker();
        tracker.feed_output(b"\x1b]7;file://mac/fish\x07", || Some(fg(SHELL)));
        tracker.report_foreground(Some(&fg(SSH)));
        tracker.report_foreground(Some(&fg(SHELL)));
        tracker.report_polled(PathBuf::from("/polled"));
        assert_eq!(*seen.lock().unwrap(), vec![here("/fish")]);
    }

    #[test]
    fn without_a_foreground_remote_stays_until_a_local_osc7() {
        let (mut tracker, seen) = tracker();
        tracker.feed_output(API, || None);
        tracker.report_foreground(None);
        tracker.report_polled(PathBuf::from("/polled"));
        assert_eq!(
            seen.lock().unwrap().last(),
            Some(&remote("build-box", "/srv/api/src", None))
        );
        tracker.feed_output(b"\x1b]7;file://mac/back\x07", || None);
        assert_eq!(seen.lock().unwrap().last(), Some(&here("/back")));
    }

    #[test]
    fn wsl_on_windows_is_remote() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let mut tracker = CwdTracker::for_host(
            "PC",
            true,
            Box::new(move |c: &PaneCwd| sink.lock().unwrap().push(c.clone())),
        );
        tracker.feed_output(b"\x1b]7;file://PC/home/red\x07", || None);
        assert_eq!(
            seen.lock().unwrap().last(),
            Some(&remote("WSL", "/home/red", None))
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
