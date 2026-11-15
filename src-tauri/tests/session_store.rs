// @harvaaja-test-tier: fast
//! The session file: parsing, private atomic writes, folder fallback, per-window placement and which windows
//! the store keeps.

use tiili_lib::session::{
    nearest_existing, parse, plan_restore, write_atomic, Geometry, Pane, Session, SessionStore,
    Tab, TabState, Window, FILE, VERSION,
};
use tiili_lib::window_state::Rect;

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("tiili-session-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn tabs(panes: &[u32]) -> TabState {
    TabState {
        tabs: vec![Tab {
            panes: panes
                .iter()
                .map(|&id| Pane {
                    id,
                    cwd: Some("/tmp".into()),
                    command: Some("npm run dev".into()),
                    ..Pane::default()
                })
                .collect(),
            ..Tab::default()
        }],
        active_tab: 0,
    }
}

/// Corrupt session: a file that is not a session of this version is ignored.
#[test]
fn corrupt_session_unreadable_or_other_versions_give_nothing() {
    let cases: [(&str, &[u8], bool); 6] = [
        ("not JSON", b"{not json", false),
        ("empty", b"", false),
        ("no version", br#"{"windows":[]}"#, false),
        ("newer version", br#"{"version":2,"windows":[]}"#, false),
        ("wrong shape", br#"{"version":1,"windows":"x"}"#, false),
        ("this version", br#"{"version":1,"windows":[]}"#, true),
    ];
    for (name, bytes, readable) in cases {
        assert_eq!(parse(bytes).is_some(), readable, "{name}");
    }
}

/// Two windows reopen: a written session reads back the same, and the file is the user's only.
#[test]
fn two_windows_reopen_written_session_reads_back_private() {
    let dir = temp_dir("write");
    let mut store = SessionStore::default();
    store.update("main", tabs(&[1, 2, 3]));
    store.set_geometry(
        "main",
        Geometry {
            rect: Some(Rect {
                x: -40,
                y: 60,
                width: 1280,
                height: 720,
            }),
            maximized: false,
            fullscreen: true,
        },
    );
    store.update("window-1", tabs(&[1]));
    let session = store.session();
    write_atomic(&dir, &session).unwrap();
    write_atomic(&dir, &session).unwrap();
    let file = dir.join(FILE);
    assert_eq!(parse(&std::fs::read(&file).unwrap()), Some(session.clone()));
    assert_eq!(session.windows.len(), 2);
    assert_eq!(session.version, VERSION);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&file).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }
    let names: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|e| e.unwrap().file_name())
        .collect();
    assert_eq!(
        names,
        [std::ffi::OsString::from(FILE)],
        "no temporary file is left"
    );
    std::fs::remove_dir_all(&dir).unwrap();
}

/// Closed window forgotten: closing a window while others stay drops it; the last one, a window closed while
/// the app ends and the store's commands are handled as the session needs.
#[test]
fn closed_window_forgotten_store_keeps_only_windows_that_reopen() {
    type Step = fn(&mut SessionStore);
    let cases: [(&str, Step, &[&str]); 5] = [
        ("second window closed", |s| s.close("window-1"), &["main"]),
        (
            "both closed, last one kept",
            |s| {
                s.close("window-1");
                s.close("main");
            },
            &["main"],
        ),
        (
            "app ending keeps every window",
            |s| {
                s.end();
                s.close("main");
                s.close("window-1");
            },
            &["main", "window-1"],
        ),
        (
            "last pane exited",
            |s| s.update("main", tabs(&[])),
            &["window-1"],
        ),
        (
            "unknown window closed",
            |s| s.close("settings-1"),
            &["main", "window-1"],
        ),
    ];
    for (name, step, kept) in cases {
        let mut store = SessionStore::default();
        store.update("main", tabs(&[1, 2]));
        store.update("window-1", tabs(&[1]));
        step(&mut store);
        let labels: Vec<_> = store
            .session()
            .windows
            .into_iter()
            .map(|w| w.label)
            .collect();
        assert_eq!(labels, kept, "{name}");
    }
    let mut store = SessionStore::default();
    store.update("main", tabs(&[1]));
    store.forget_commands();
    assert_eq!(
        store.session().windows[0].state.tabs[0].panes[0].command,
        None
    );
}

/// Folder deleted: a pane opens in the nearest existing parent folder.
#[test]
fn folder_deleted_opens_in_nearest_existing_parent() {
    let dir = temp_dir("nearest");
    std::fs::create_dir_all(dir.join("a")).unwrap();
    std::fs::write(dir.join("file"), b"").unwrap();
    let cases = [
        ("existing folder", dir.join("a"), Some(dir.join("a"))),
        ("deleted folder", dir.join("a/b/c"), Some(dir.join("a"))),
        ("a file, not a folder", dir.join("file"), Some(dir.clone())),
        (
            "relative path with nothing",
            "no-such-tiili-dir/x".into(),
            None,
        ),
    ];
    for (name, path, expected) in cases {
        assert_eq!(nearest_existing(&path), expected, "{name}");
    }
    std::fs::remove_dir_all(&dir).unwrap();
}

/// Monitor unplugged: each window keeps its own place while it is on a screen, else opens at the default.
#[test]
fn monitor_unplugged_each_window_falls_back_on_its_own() {
    let screen = Rect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    };
    let on = Geometry {
        rect: Some(Rect {
            x: 100,
            y: 100,
            width: 1280,
            height: 720,
        }),
        maximized: true,
        fullscreen: false,
    };
    let off = Geometry {
        rect: Some(Rect {
            x: 3000,
            y: 100,
            width: 800,
            height: 600,
        }),
        maximized: true,
        fullscreen: false,
    };
    let cases = [
        ("on screen", on, on),
        ("off every screen", off, Geometry::default()),
        (
            "never sized",
            Geometry { rect: None, ..on },
            Geometry::default(),
        ),
        (
            "zero size",
            Geometry {
                rect: Some(Rect {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                }),
                ..on
            },
            Geometry::default(),
        ),
    ];
    let session = Session {
        windows: cases
            .iter()
            .map(|&(_, geometry, _)| Window {
                geometry,
                ..Window::default()
            })
            .collect(),
        ..Session::default()
    };
    let planned = plan_restore(&session, &[screen]);
    for ((name, _, expected), got) in cases.iter().zip(planned) {
        assert_eq!(got, *expected, "{name}");
    }
}
