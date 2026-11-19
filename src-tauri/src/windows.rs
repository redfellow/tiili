//! tiili's windows: the main window from `tauri.conf.json` and the extra ones New Window opens (from a pane, the
//! Shell menu or the app icon), which shells each window started and which window was focused last. The pure parts
//! (labels, cascade, start-up URL, the session map) carry no Tauri types, so they test without a window.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::pty::SessionId;

/// The label of the window `tauri.conf.json` opens at start.
pub const MAIN_WINDOW: &str = "main";
/// How far down and right of the focused window a new window opens, in logical pixels.
pub const CASCADE_OFFSET: f64 = 28.0;
/// Event sent to the focused window when the Shell menu's New Window is chosen; it answers by calling
/// `window_new` with its focused pane's folder.
pub const NEW_WINDOW_EVENT: &str = "new-window";

/// How long a window may stay hidden before tiili shows it anyway. Windows open hidden and their page shows them
/// once it has painted in its theme, so the webview's white never flashes; this is for a page that never gets there.
const REVEAL_FALLBACK: std::time::Duration = std::time::Duration::from_secs(3);

/// Shows `window` after [`REVEAL_FALLBACK`] unless its page has shown it already.
pub fn reveal_later(window: &WebviewWindow) {
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(REVEAL_FALLBACK);
        if !window.is_visible().unwrap_or(true) {
            let _ = window.show();
        }
    });
}

/// Hands out `window-1`, `window-2`, …; labels of closed windows are never reused.
#[derive(Default)]
pub struct WindowLabels(AtomicU32);

impl WindowLabels {
    pub fn next(&self) -> String {
        format!("window-{}", self.0.fetch_add(1, Ordering::Relaxed) + 1)
    }
}

/// Where a new window goes: `CASCADE_OFFSET` down and right of the window at `(x, y)`.
pub fn cascade(x: f64, y: f64) -> (f64, f64) {
    (x + CASCADE_OFFSET, y + CASCADE_OFFSET)
}

/// The page a new window loads: `index.html`, with `?cwd=` naming the folder its first pane starts in, or with
/// `?move=` naming the pending move whose pane it opens with instead of a fresh shell.
pub fn start_url(cwd: Option<&str>, move_token: Option<&str>) -> String {
    match (move_token, cwd) {
        (Some(token), _) if !token.is_empty() => {
            format!("index.html?move={}", percent_encode(token))
        }
        (_, Some(cwd)) if !cwd.is_empty() => format!("index.html?cwd={}", percent_encode(cwd)),
        _ => "index.html".to_string(),
    }
}

/// `text` with every byte outside the URL's unreserved characters percent-encoded.
fn percent_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'/') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// Which shells each window started, by window label, so a closed window's shells end with it.
#[derive(Default)]
pub struct WindowSessions(Mutex<HashMap<String, Vec<SessionId>>>);

impl WindowSessions {
    /// Session `id` belongs to window `label`.
    pub fn add(&self, label: &str, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            map.entry(label.to_string()).or_default().push(id);
        }
    }

    /// Session `id` has ended; it belongs to no window any more.
    pub fn remove(&self, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            for ids in map.values_mut() {
                ids.retain(|&s| s != id);
            }
            map.retain(|_, ids| !ids.is_empty());
        }
    }

    /// The window session `id` belongs to, if any.
    pub fn owner(&self, id: SessionId) -> Option<String> {
        let map = self.0.lock().ok()?;
        map.iter()
            .find(|(_, ids)| ids.contains(&id))
            .map(|(label, _)| label.clone())
    }

    /// Session `id` now belongs to window `to`, which ends it on closing; its former window no longer does.
    pub fn reassign(&self, id: SessionId, to: &str) {
        self.remove(id);
        self.add(to, id);
    }

    /// Window `label`'s sessions, in the order they joined it.
    pub fn sessions(&self, label: &str) -> Vec<SessionId> {
        self.0
            .lock()
            .ok()
            .and_then(|map| map.get(label).cloned())
            .unwrap_or_default()
    }

    /// Window `label`'s remaining sessions, which then belong to no window.
    pub fn take(&self, label: &str) -> Vec<SessionId> {
        self.0
            .lock()
            .ok()
            .and_then(|mut map| map.remove(label))
            .unwrap_or_default()
    }
}

/// A window as Move to Window lists it: its label and the chip text of its focused pane.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct WindowEntry {
    pub label: String,
    pub name: String,
}

/// Each open window's menu name, in the order windows first reported one (their open order).
#[derive(Default)]
pub struct WindowNames(Mutex<Vec<WindowEntry>>);

impl WindowNames {
    /// Window `label` is now named `name`; a window reporting for the first time goes last.
    pub fn set(&self, label: &str, name: &str) {
        if let Ok(mut entries) = self.0.lock() {
            match entries.iter_mut().find(|e| e.label == label) {
                Some(entry) => entry.name = name.to_string(),
                None => entries.push(WindowEntry {
                    label: label.to_string(),
                    name: name.to_string(),
                }),
            }
        }
    }

    /// Window `label` closed.
    pub fn remove(&self, label: &str) {
        if let Ok(mut entries) = self.0.lock() {
            entries.retain(|e| e.label != label);
        }
    }

    /// Every named window except `label`, in open order.
    pub fn others(&self, label: &str) -> Vec<WindowEntry> {
        self.0
            .lock()
            .map(|entries| {
                entries
                    .iter()
                    .filter(|e| e.label != label)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// The menu text of each entry: its name, with ` (2)`, ` (3)`… added to the second and later of the same name.
pub fn numbered_names(entries: &[WindowEntry]) -> Vec<String> {
    let mut seen: HashMap<&str, usize> = HashMap::new();
    entries
        .iter()
        .map(|e| {
            let count = seen.entry(e.name.as_str()).or_insert(0);
            *count += 1;
            if *count == 1 {
                e.name.clone()
            } else {
                format!("{} ({count})", e.name)
            }
        })
        .collect()
}

/// What moves to another window: a terminal pane's session with its scrollback and zoom offset, a Heynote pane, or
/// a whole tab (Pop Out) with its name, its grid's track sizes (kept as the frontend sent them), its focused pane and
/// its panes in grid order.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum MovePayload {
    Terminal {
        session: SessionId,
        scrollback: String,
        zoom: f64,
    },
    Heynote,
    Tab {
        name: Option<String>,
        layout: serde_json::Value,
        focused: usize,
        panes: Vec<MovePayload>,
    },
}

impl MovePayload {
    /// The sessions that move with it: a terminal pane's, or those of a tab's terminal panes in grid order.
    pub fn sessions(&self) -> Vec<SessionId> {
        match self {
            MovePayload::Terminal { session, .. } => vec![*session],
            MovePayload::Heynote => Vec::new(),
            MovePayload::Tab { panes, .. } => {
                panes.iter().flat_map(MovePayload::sessions).collect()
            }
        }
    }
}

/// Moves waiting for their target window to take them, by token.
#[derive(Default)]
pub struct PendingMoves {
    next: AtomicU32,
    moves: Mutex<HashMap<String, MovePayload>>,
}

impl PendingMoves {
    /// Keeps `payload` until [`take`](Self::take) and returns the token naming it.
    pub fn put(&self, payload: MovePayload) -> String {
        let token = format!("move-{}", self.next.fetch_add(1, Ordering::Relaxed) + 1);
        if let Ok(mut moves) = self.moves.lock() {
            moves.insert(token.clone(), payload);
        }
        token
    }

    /// The move named `token`, handed out once.
    pub fn take(&self, token: &str) -> Option<MovePayload> {
        self.moves.lock().ok()?.remove(token)
    }
}

/// The label of the window focused last, for when no window reports focus (the menu bar has it).
#[derive(Default)]
pub struct LastFocused(Mutex<Option<String>>);

impl LastFocused {
    pub fn set(&self, label: &str) {
        if let Ok(mut last) = self.0.lock() {
            *last = Some(label.to_string());
        }
    }

    /// Forgets `label` when it was the last focused window, because it closed.
    pub fn forget(&self, label: &str) {
        if let Ok(mut last) = self.0.lock() {
            if last.as_deref() == Some(label) {
                *last = None;
            }
        }
    }

    pub fn get(&self) -> Option<String> {
        self.0.lock().ok().and_then(|last| last.clone())
    }
}

/// The window menu items act on: the focused one, else the one focused last, else any open window.
pub fn focused_label(app: &AppHandle) -> Option<String> {
    let windows = app.webview_windows();
    windows
        .iter()
        .find(|(_, w)| w.is_focused().unwrap_or(false))
        .map(|(label, _)| label.clone())
        .or_else(|| {
            app.state::<LastFocused>()
                .get()
                .filter(|label| windows.contains_key(label))
        })
        .or_else(|| {
            windows
                .contains_key(MAIN_WINDOW)
                .then(|| MAIN_WINDOW.to_string())
        })
        .or_else(|| windows.keys().next().cloned())
}

/// Opens a full tiili window labelled `label` loading `url`, the same size as `window` (the one that asked) and
/// cascaded from it, and returns it.
fn open_window(
    app: &AppHandle,
    window: &WebviewWindow,
    label: String,
    url: String,
) -> Result<WebviewWindow, String> {
    let text = |e: tauri::Error| format!("Could not open a new window: {e}");
    let scale = window.scale_factor().map_err(text)?;
    let size = window.inner_size().map_err(text)?.to_logical::<f64>(scale);
    let place = window
        .outer_position()
        .map_err(text)?
        .to_logical::<f64>(scale);
    let (x, y) = cascade(place.x, place.y);
    let builder = window_builder(app, label, url)
        .inner_size(size.width, size.height)
        .position(x, y);
    let built = builder.build().map_err(text)?;
    reveal_later(&built);
    Ok(built)
}

/// Opens a new tiili window for the Dock menu, the jump list or the desktop action, whose first pane starts in the
/// home folder, and focuses it once its page has shown it. It is cascaded from the last focused window, or centred
/// at the default size when there is none. The window is built on the async runtime, because building one from the
/// main thread's event handlers deadlocks on Windows; an error is logged.
pub fn open_from_launcher(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match open_launcher_window(&app) {
            Ok(window) => focus_when_shown(window),
            Err(error) => eprintln!("tiili: {error}"),
        }
    });
}

/// The window [`open_from_launcher`] opens.
fn open_launcher_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let label = app.state::<WindowLabels>().next();
    let url = start_url(None, None);
    let from = focused_label(app)
        .filter(|label| !crate::settings::is_settings_window(label))
        .and_then(|label| app.get_webview_window(&label));
    if let Some(from) = from {
        return open_window(app, &from, label, url);
    }
    let size = crate::session_app::DEFAULT_WINDOW_SIZE;
    let built = window_builder(app, label, url)
        .inner_size(size.width, size.height)
        .center()
        .build()
        .map_err(|e| format!("Could not open a new window: {e}"))?;
    reveal_later(&built);
    Ok(built)
}

/// Focuses `window`, which opened hidden, once its page (or [`reveal_later`]) has shown it, so it is shown on the
/// current desktop before tiili comes to the front: macOS then has no reason to switch to another window's Space.
fn focus_when_shown(window: WebviewWindow) {
    const POLL: std::time::Duration = std::time::Duration::from_millis(20);
    std::thread::spawn(move || {
        let deadline =
            std::time::Instant::now() + REVEAL_FALLBACK + std::time::Duration::from_secs(1);
        while !window.is_visible().unwrap_or(false) {
            if std::time::Instant::now() >= deadline {
                return;
            }
            std::thread::sleep(POLL);
        }
        let _ = window.set_focus();
    });
}

/// Brings the last focused tiili window to the front (else the main window, else any), for a plain second launch.
pub fn focus_last(app: &AppHandle) {
    let Some(window) = focused_label(app).and_then(|label| app.get_webview_window(&label)) else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

/// A builder for a full tiili window `label` loading `url`, hidden until its page has painted and with the same
/// title and decorations as the main window in `tauri.conf.json`.
pub fn window_builder<'a>(
    app: &'a AppHandle,
    label: String,
    url: String,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("tiili >_")
        .visible(false);
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);
    builder
}

/// Opens a full tiili window with one pane starting in `cwd`, or holding the pane of pending move `move_token`,
/// the same size as `window` (the one that asked) and cascaded from it. Async, because building a window from a
/// synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn window_new(
    app: AppHandle,
    window: WebviewWindow,
    labels: tauri::State<'_, WindowLabels>,
    cwd: Option<String>,
    move_token: Option<String>,
) -> Result<(), String> {
    let url = start_url(cwd.as_deref(), move_token.as_deref());
    open_window(&app, &window, labels.next(), url).map(|_| ())
}

/// The other open windows, in open order, named by their focused pane's chip text.
#[tauri::command]
pub fn window_list(
    window: WebviewWindow,
    names: tauri::State<'_, WindowNames>,
) -> Vec<WindowEntry> {
    names.others(window.label())
}

/// The calling window's focused pane's chip text is now `name`; Move to Window menus list it under that name.
#[tauri::command]
pub fn window_set_name(app: AppHandle, window: WebviewWindow, name: String) {
    // A settings window holds no panes, so it is never a Move to Window target.
    if crate::settings::is_settings_window(window.label()) {
        return;
    }
    app.state::<WindowNames>().set(window.label(), &name);
    crate::refresh_move_menu(&app);
}

/// Event sent to a window when a pane moves into it; its payload names the pending move as `{ token }`.
pub const PANE_ARRIVE_EVENT: &str = "pane-arrive";

#[derive(Clone, Serialize)]
struct PaneArrive {
    token: String,
}

/// Moves the calling window's pane or tab described by `payload` to window `target`, or to a new window when
/// `target` is absent. Its sessions belong to the target window from now on, so the calling window may close after
/// this returns without ending it. The target window takes the move with `pane_move_take`, comes to the front and
/// focuses the pane.
#[tauri::command]
pub async fn pane_move(
    app: AppHandle,
    window: WebviewWindow,
    labels: tauri::State<'_, WindowLabels>,
    moves: tauri::State<'_, PendingMoves>,
    sessions: tauri::State<'_, WindowSessions>,
    target: Option<String>,
    payload: MovePayload,
) -> Result<(), String> {
    let moved = payload.sessions();
    match target {
        None => {
            let label = labels.next();
            let token = moves.put(payload);
            for &id in &moved {
                sessions.reassign(id, &label);
            }
            let url = start_url(None, Some(&token));
            if let Err(error) = open_window(&app, &window, label, url) {
                moves.take(&token);
                for &id in &moved {
                    sessions.reassign(id, window.label());
                }
                return Err(error);
            }
        }
        Some(label) => {
            let Some(to) = app.get_webview_window(&label) else {
                return Err(format!("Could not move the pane: no window {label}"));
            };
            let token = moves.put(payload);
            for &id in &moved {
                sessions.reassign(id, &label);
            }
            let _ = to.unminimize();
            let _ = to.set_focus();
            // Sent to the target only: an app-wide emit would let any window take the pane.
            if let Err(error) = app.emit_to(
                label.as_str(),
                PANE_ARRIVE_EVENT,
                PaneArrive {
                    token: token.clone(),
                },
            ) {
                moves.take(&token);
                for &id in &moved {
                    sessions.reassign(id, window.label());
                }
                return Err(format!("Could not move the pane: {error}"));
            }
        }
    }
    Ok(())
}

/// The pending move named `token`, handed to the window it moves to; `None` once taken.
#[tauri::command]
pub fn pane_move_take(moves: tauri::State<'_, PendingMoves>, token: String) -> Option<MovePayload> {
    moves.take(&token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_a_second_window_cascades_from_the_focused_one() {
        let cases = [
            ("top left", (0.0, 0.0), (28.0, 28.0)),
            ("somewhere", (300.0, 120.5), (328.0, 148.5)),
            ("left screen", (-1200.0, 40.0), (-1172.0, 68.0)),
        ];
        for (name, (x, y), expected) in cases {
            assert_eq!(cascade(x, y), expected, "{name}");
        }
    }

    #[test]
    fn open_a_second_window_starts_in_the_focused_panes_folder() {
        let cases = [
            ("no folder", None, "index.html"),
            ("empty folder", Some(""), "index.html"),
            (
                "plain folder",
                Some("/Users/red/work/tiili"),
                "index.html?cwd=/Users/red/work/tiili",
            ),
            (
                "spaces and query characters",
                Some("/tmp/a b&c=d?#"),
                "index.html?cwd=/tmp/a%20b%26c%3Dd%3F%23",
            ),
            ("non-ASCII", Some("/tmp/ä"), "index.html?cwd=/tmp/%C3%A4"),
            (
                "Windows path",
                Some(r"C:\Users\red"),
                "index.html?cwd=C%3A%5CUsers%5Cred",
            ),
        ];
        for (name, cwd, expected) in cases {
            assert_eq!(start_url(cwd, None), expected, "{name}");
        }
    }

    #[test]
    fn move_to_a_new_window_opens_it_with_the_move_not_a_fresh_shell() {
        let cases = [
            ("move token", None, Some("move-3"), "index.html?move=move-3"),
            (
                "move wins over folder",
                Some("/tmp"),
                Some("move-1"),
                "index.html?move=move-1",
            ),
            ("empty token", Some("/tmp"), Some(""), "index.html?cwd=/tmp"),
        ];
        for (name, cwd, token, expected) in cases {
            assert_eq!(start_url(cwd, token), expected, "{name}");
        }
    }

    #[test]
    fn moved_shell_follows_its_window() {
        let sessions = WindowSessions::default();
        sessions.add("main", 1);
        sessions.add("main", 2);
        sessions.add("window-1", 3);
        sessions.reassign(2, "window-1");
        assert_eq!(sessions.owner(2).as_deref(), Some("window-1"));
        // The source window closes after the move: the moved shell lives on.
        assert_eq!(sessions.take("main"), vec![1]);
        assert_eq!(sessions.owner(2).as_deref(), Some("window-1"));
        // Closing the target window ends it.
        assert_eq!(sessions.take("window-1"), vec![3, 2]);
        assert_eq!(sessions.owner(2), None);
    }

    #[test]
    fn last_pane_moves_out_to_a_window_that_had_no_shells() {
        let sessions = WindowSessions::default();
        sessions.add("main", 1);
        sessions.reassign(1, "window-2");
        assert_eq!(sessions.take("main"), Vec::<SessionId>::new());
        assert_eq!(sessions.take("window-2"), vec![1]);
    }

    #[test]
    fn duplicate_window_names() {
        let entry = |label: &str, name: &str| WindowEntry {
            label: label.into(),
            name: name.into(),
        };
        let names = WindowNames::default();
        names.set("main", "tiili");
        names.set("window-1", "härvääjä");
        names.set("window-2", "tiili");
        names.set("window-3", "tiili");
        // A rename keeps the window's place.
        names.set("window-1", "Heynote");
        names.remove("window-3");
        let others = names.others("window-1");
        assert_eq!(
            others,
            vec![entry("main", "tiili"), entry("window-2", "tiili")]
        );
        assert_eq!(numbered_names(&others), vec!["tiili", "tiili (2)"]);
        let all = names.others("none");
        assert_eq!(numbered_names(&all), vec!["tiili", "Heynote", "tiili (2)"]);
    }

    #[test]
    fn pending_move_is_taken_once() {
        let moves = PendingMoves::default();
        let terminal = MovePayload::Terminal {
            session: 4,
            scrollback: "$ ls\r\n".into(),
            zoom: 2.0,
        };
        let first = moves.put(terminal.clone());
        let second = moves.put(MovePayload::Heynote);
        assert_ne!(first, second);
        assert_eq!(moves.take(&first), Some(terminal));
        assert_eq!(moves.take(&first), None);
        assert_eq!(moves.take(&second), Some(MovePayload::Heynote));
    }

    #[test]
    fn move_payload_reads_the_frontends_json() {
        let cases = [
            (
                r#"{"kind":"terminal","session":3,"scrollback":"hi","zoom":-1}"#,
                MovePayload::Terminal {
                    session: 3,
                    scrollback: "hi".into(),
                    zoom: -1.0,
                },
            ),
            (r#"{"kind":"heynote"}"#, MovePayload::Heynote),
            (
                r#"{"kind":"tab","name":"build","layout":{"colSizes":[1,1],"rowSizes":[1]},"focused":1,"panes":[{"kind":"terminal","session":3,"scrollback":"","zoom":0},{"kind":"heynote"}]}"#,
                MovePayload::Tab {
                    name: Some("build".into()),
                    layout: serde_json::json!({"colSizes": [1, 1], "rowSizes": [1]}),
                    focused: 1,
                    panes: vec![
                        MovePayload::Terminal {
                            session: 3,
                            scrollback: String::new(),
                            zoom: 0.0,
                        },
                        MovePayload::Heynote,
                    ],
                },
            ),
        ];
        for (json, expected) in cases {
            assert_eq!(
                serde_json::from_str::<MovePayload>(json).unwrap(),
                expected,
                "{json}"
            );
        }
    }

    #[test]
    fn pop_out_a_tab_all_its_sessions_move() {
        let terminal = |session| MovePayload::Terminal {
            session,
            scrollback: String::new(),
            zoom: 0.0,
        };
        let cases = [
            ("a terminal pane", terminal(4), vec![4]),
            ("a Heynote pane", MovePayload::Heynote, vec![]),
            (
                "a tab of three panes",
                MovePayload::Tab {
                    name: None,
                    layout: serde_json::Value::Null,
                    focused: 0,
                    panes: vec![terminal(1), MovePayload::Heynote, terminal(2)],
                },
                vec![1, 2],
            ),
        ];
        for (name, payload, expected) in cases {
            assert_eq!(payload.sessions(), expected, "{name}");
        }
    }

    #[test]
    fn move_a_full_scrollback_all_its_lines_arrive() {
        // The setting's cap: 100 000 lines of 200 columns, about 20 MB.
        let line = format!("{}\r\n", "x".repeat(200));
        let scrollback = line.repeat(100_000);
        let payload = MovePayload::Terminal {
            session: 7,
            scrollback: scrollback.clone(),
            zoom: 0.0,
        };
        let json = serde_json::to_string(&payload).unwrap();
        let back = serde_json::from_str::<MovePayload>(&json).unwrap();
        let MovePayload::Terminal {
            scrollback: got, ..
        } = &back
        else {
            panic!("not a terminal payload");
        };
        assert_eq!(got.matches("\r\n").count(), 100_000);
        assert_eq!(back, payload);
    }

    #[test]
    fn window_labels_grow_and_are_never_reused() {
        let labels = WindowLabels::default();
        assert_eq!(labels.next(), "window-1");
        assert_eq!(labels.next(), "window-2");
    }

    #[test]
    fn close_one_of_two_windows_ends_only_its_shells() {
        let sessions = WindowSessions::default();
        sessions.add("main", 1);
        sessions.add("window-1", 2);
        sessions.add("main", 3);
        sessions.add("window-1", 4);
        // Session 4's shell exited by itself before its window closed.
        sessions.remove(4);
        assert_eq!(sessions.take("window-1"), vec![2]);
        assert_eq!(sessions.take("window-1"), Vec::<SessionId>::new());
        assert_eq!(sessions.take("main"), vec![1, 3]);
    }

    #[test]
    fn last_focused_window_is_forgotten_when_it_closes() {
        let last = LastFocused::default();
        assert_eq!(last.get(), None);
        last.set("window-1");
        last.forget("main");
        assert_eq!(last.get().as_deref(), Some("window-1"));
        last.forget("window-1");
        assert_eq!(last.get(), None);
    }
}
