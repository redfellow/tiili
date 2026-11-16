// @harvaaja-test-tier: fast
//! Which URLs open and how, and which printed paths name existing files and folders.

use std::fs;
use std::path::{Path, PathBuf};

use tiili_lib::links::{classify_url_on, resolve_path_on, strip_line_suffix, Os, UrlRule};

/// Remote file host: UNC and look-alike hosts never open. Scheme rules: http, https and mailto open; forbidden schemes and file:// on another host never do; the rest ask.
#[test]
fn scheme_rules() {
    let cases = [
        ("https://example.com/a?b=c", UrlRule::Allow),
        ("HTTP://example.com", UrlRule::Allow),
        ("mailto:someone@example.com", UrlRule::Allow),
        ("vscode://file/tmp/x", UrlRule::Confirm),
        ("ssh://host", UrlRule::Confirm),
        ("file:///Users/me/notes.txt", UrlRule::Confirm),
        ("file://localhost/etc/hosts", UrlRule::Confirm),
        ("file://mac.local/etc/hosts", UrlRule::Confirm),
        ("file://MAC.local/etc/hosts", UrlRule::Confirm),
        ("file://mac/etc/hosts", UrlRule::Deny),
        ("file://mac.attacker.example/x", UrlRule::Deny),
        ("file:////attacker/share/x.exe", UrlRule::Deny),
        ("file://///attacker/share/x.exe", UrlRule::Deny),
        ("file://elsewhere/etc/hosts", UrlRule::Deny),
        ("javascript:alert(1)", UrlRule::Deny),
        ("JavaScript:alert(1)", UrlRule::Deny),
        ("data:text/html,<b>x</b>", UrlRule::Deny),
        ("blob:https://example.com/uuid", UrlRule::Deny),
        ("vbscript:msgbox", UrlRule::Deny),
        ("no scheme here", UrlRule::Deny),
        ("1http://x", UrlRule::Deny),
        ("https://example.com/\u{7}", UrlRule::Deny),
        ("", UrlRule::Deny),
    ];
    for (uri, rule) in cases {
        assert_eq!(classify_url_on(uri, "mac.local"), rule, "{uri}");
    }
}

#[test]
fn line_suffixes_are_dropped() {
    let cases = [
        ("src/main.ts:10", "src/main.ts"),
        ("src/main.ts:10:4", "src/main.ts"),
        ("src/main.ts(10,4)", "src/main.ts"),
        ("src/main.ts(10)", "src/main.ts"),
        ("src/main.ts", "src/main.ts"),
        ("C:\\x\\a.rs:3", "C:\\x\\a.rs"),
        ("notes(draft)", "notes(draft)"),
        ("a:b", "a:b"),
    ];
    for (text, path) in cases {
        assert_eq!(strip_line_suffix(text), path, "{text}");
    }
}

/// A fresh folder under the system temp folder, removed again when dropped.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("tiili-links-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn file(&self, rel: &str) -> PathBuf {
        let path = self.0.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "x").unwrap();
        path
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[cfg(unix)]
fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) {}

/// What a path resolves to: its absolute path, whether it is a folder, and whether it is reveal-only.
type Found = (String, bool, bool);

/// Missing path, existing files and folders, line suffixes and launchers: what each printed form resolves to.
#[test]
fn path_resolution() {
    let scratch = Scratch::new("resolve");
    let root = scratch.0.clone();
    let cwd = root.join("project");
    let home = root.join("home");
    scratch.file("project/src/main.ts");
    scratch.file("project/README.md");
    scratch.file("home/notes.txt");
    scratch.file("project/tool.exe");
    scratch.file("project/launch.desktop");
    scratch.file("project/notes.terminal");
    let script = scratch.file("project/build.sh");
    make_executable(&script);
    fs::create_dir_all(cwd.join("App.app")).unwrap();

    let os = Os::current();
    let abs = |rel: &str| root.join(rel).to_string_lossy().into_owned();
    let main_abs = abs("project/src/main.ts");
    // (text, os, expected: (absolute path, is_dir, reveal_only))
    let cases: Vec<(&str, Os, Option<Found>)> = vec![
        ("src/nope.ts:12", os, None),
        ("src/main.ts", os, Some((main_abs.clone(), false, false))),
        ("src/main.ts:10", os, Some((main_abs.clone(), false, false))),
        (
            "src/main.ts:10:4",
            os,
            Some((main_abs.clone(), false, false)),
        ),
        (
            "src/main.ts(10,4)",
            os,
            Some((main_abs.clone(), false, false)),
        ),
        ("./src/main.ts", os, Some((main_abs.clone(), false, false))),
        (
            "../project/README.md",
            os,
            Some((abs("project/README.md"), false, false)),
        ),
        ("src", os, Some((abs("project/src"), true, false))),
        (
            "~/notes.txt",
            os,
            Some((abs("home/notes.txt"), false, false)),
        ),
        (
            main_abs.as_str(),
            os,
            Some((main_abs.clone(), false, false)),
        ),
        (
            "tool.exe",
            Os::Windows,
            Some((abs("project/tool.exe"), false, true)),
        ),
        (
            "tool.exe",
            Os::Linux,
            Some((abs("project/tool.exe"), false, false)),
        ),
        (
            "launch.desktop",
            Os::Linux,
            Some((abs("project/launch.desktop"), false, true)),
        ),
        (
            "App.app",
            Os::MacOs,
            Some((abs("project/App.app"), true, true)),
        ),
        ("C:\\nowhere\\file.rs", Os::MacOs, None),
        (
            "notes.terminal",
            Os::MacOs,
            Some((abs("project/notes.terminal"), false, true)),
        ),
    ];
    for (text, os, expected) in cases {
        let got =
            resolve_path_on(os, &cwd, Some(&home), text).map(|r| (r.abs, r.is_dir, r.reveal_only));
        assert_eq!(got, expected, "{text} on {os:?}");
    }
}

/// Executable is revealed: a script with the exec bit is reveal-only on macOS and Linux.
#[cfg(unix)]
#[test]
fn executable_is_revealed() {
    let scratch = Scratch::new("exec");
    let script = scratch.file("build.sh");
    make_executable(&script);
    scratch.file("plain.sh");
    for os in [Os::MacOs, Os::Linux] {
        let got = resolve_path_on(os, &scratch.0, None, "./build.sh").unwrap();
        assert!(got.reveal_only, "{os:?}");
        let plain = resolve_path_on(os, &scratch.0, None, "./plain.sh").unwrap();
        assert!(!plain.reveal_only, "{os:?}");
    }
}

/// A symlink to a launcher is revealed: its target decides, whatever the link is named.
#[cfg(unix)]
#[test]
fn symlink_to_launcher_is_revealed() {
    use std::os::unix::fs::symlink;
    let scratch = Scratch::new("symlink");
    fs::create_dir_all(scratch.0.join("Tool.app")).unwrap();
    scratch.file("setup.pkg");
    scratch.file("notes.txt");
    fs::create_dir_all(scratch.0.join("docs")).unwrap();
    symlink("../Tool.app", scratch.0.join("docs/README.txt")).unwrap();
    symlink("../setup.pkg", scratch.0.join("docs/guide.md")).unwrap();
    symlink("../notes.txt", scratch.0.join("docs/plain.md")).unwrap();
    // (link, reveal-only on macOS)
    let cases = [
        ("docs/README.txt", true),
        ("docs/guide.md", true),
        ("docs/plain.md", false),
    ];
    for (text, reveal_only) in cases {
        let got = resolve_path_on(Os::MacOs, &scratch.0, None, text).unwrap();
        assert_eq!(got.reveal_only, reveal_only, "{text}");
    }
}
