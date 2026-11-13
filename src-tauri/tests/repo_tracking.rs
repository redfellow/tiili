// @harvaaja-test-tier: host
//! A real default shell `cd`s between git repositories and a plain folder; the repository the
//! registry reports for it follows.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use tiili_lib::cwd::PaneCwd;
use tiili_lib::pty::SessionRegistry;

const TIMEOUT: Duration = Duration::from_secs(20);

/// A fresh folder under the system temp folder, with canonical path (macOS's /tmp is a symlink).
fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("tiili-repo-tracking-{}", std::process::id()));
    let dir = dir.join(name);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir.canonicalize().expect("canonical")
}

fn git_init(dir: &Path) {
    let status = Command::new("git")
        .args(["init", "-q"])
        .current_dir(dir)
        .status()
        .expect("git runs");
    assert!(status.success(), "git init in {}", dir.display());
}

/// Waits for a report matching `want` and returns it.
fn wait_for(rx: &mpsc::Receiver<PaneCwd>, want: impl Fn(&PaneCwd) -> bool) -> PaneCwd {
    let deadline = Instant::now() + TIMEOUT;
    let mut last = None;
    while Instant::now() < deadline {
        if let Ok(report) = rx.recv_timeout(Duration::from_millis(100)) {
            if want(&report) {
                return report;
            }
            last = Some(report);
        }
    }
    panic!("no matching report; last was {last:?}");
}

fn root_of(report: &PaneCwd) -> Option<&Path> {
    report.repo.as_ref().map(|r| r.root.as_path())
}

#[test]
#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]
fn change_directory_into_a_repository_tracked_root_follows() {
    let repo_a = temp_dir("alpha");
    let repo_b = temp_dir("beta");
    let plain = temp_dir("plain");
    git_init(&repo_a);
    git_init(&repo_b);
    let start = repo_a.join("src");
    std::fs::create_dir_all(&start).expect("src");

    let (tx, rx) = mpsc::channel();
    let registry = SessionRegistry::new();
    let id = registry
        .spawn_tracked(
            Some(&start),
            "off",
            24,
            80,
            Box::new(|_, _| {}),
            Some(Box::new(move |_, report| {
                let _ = tx.send(report.clone());
            })),
            None,
            Box::new(|_, _| {}),
        )
        .expect("shell starts");

    // Every platform knows the folder the shell started in.
    let first = wait_for(&rx, |r| root_of(r) == Some(&repo_a));
    assert_eq!(first.repo.expect("repo").name, "alpha");

    // Following `cd` needs polling, which Windows lacks (there only OSC 7 from the shell does it).
    if cfg!(not(windows)) {
        let cd = |dir: &Path| {
            registry
                .write(id, format!("cd '{}'\r", dir.display()).as_bytes())
                .expect("write");
        };
        cd(&repo_b);
        wait_for(&rx, |r| root_of(r) == Some(&repo_b));
        cd(&plain);
        wait_for(&rx, |r| r.repo.is_none() && r.cwd == plain);
        cd(&repo_a);
        wait_for(&rx, |r| root_of(r) == Some(&repo_a) && r.cwd == repo_a);
    }

    registry.close(id).expect("close");
    let _ = std::fs::remove_dir_all(repo_a.parent().expect("parent"));
}
