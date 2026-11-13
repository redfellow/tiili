//! tiili's windows: the main window from `tauri.conf.json` and the extra ones New Window opens, which shells each
//! window started and which window was focused last. The pure parts (labels, cascade, start-up URL, the session
//! map) carry no Tauri types, so they test without a window.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::pty::SessionId;

/// The label of the window `tauri.conf.json` opens; the only one whose size and place are remembered.
pub const MAIN_WINDOW: &str = "main";
/// How far down and right of the focused window a new window opens, in logical pixels.
pub const CASCADE_OFFSET: f64 = 28.0;
/// Event sent to the focused window when the Shell menu's New Window is chosen; it answers by calling
/// `window_new` with its focused pane's folder.
pub const NEW_WINDOW_EVENT: &str = "new-window";

/// Whether the window-state plugin saves and restores window `label`: only the main window, so extra windows'
/// size and place never reach the saved state.
pub fn is_remembered(label: &str) -> bool {
    label == MAIN_WINDOW
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

/// The page a new window loads: `index.html`, with `?cwd=` naming the folder its first pane starts in.
pub fn start_url(cwd: Option<&str>) -> String {
    match cwd {
        Some(cwd) if !cwd.is_empty() => format!("index.html?cwd={}", percent_encode(cwd)),
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

    /// Window `label`'s remaining sessions, which then belong to no window.
    pub fn take(&self, label: &str) -> Vec<SessionId> {
        self.0
            .lock()
            .ok()
            .and_then(|mut map| map.remove(label))
            .unwrap_or_default()
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

/// Opens a full tiili window with one pane starting in `cwd`, the same size as `window` (the one that asked)
/// and cascaded from it. Async, because building a window from a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn window_new(
    app: AppHandle,
    window: WebviewWindow,
    labels: tauri::State<'_, WindowLabels>,
    cwd: Option<String>,
) -> Result<(), String> {
    let text = |e: tauri::Error| e.to_string();
    let scale = window.scale_factor().map_err(text)?;
    let size = window.inner_size().map_err(text)?.to_logical::<f64>(scale);
    let place = window
        .outer_position()
        .map_err(text)?
        .to_logical::<f64>(scale);
    let (x, y) = cascade(place.x, place.y);
    let url = WebviewUrl::App(start_url(cwd.as_deref()).into());
    let builder = WebviewWindowBuilder::new(&app, labels.next(), url)
        .title("tiili")
        .inner_size(size.width, size.height)
        .position(x, y);
    // The same decorations as the main window in `tauri.conf.json`.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);
    builder.build().map_err(text)?;
    Ok(())
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
            assert_eq!(start_url(cwd), expected, "{name}");
        }
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

    #[test]
    fn extra_windows_are_not_remembered_only_main_is_saved() {
        assert!(is_remembered("main"));
        assert!(!is_remembered("window-1"));
    }
}
