//! The user's settings, stored as `settings.json` in the OS app config folder.
//!
//! The core only reads and writes the JSON; the frontend checks each value and falls back to defaults.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const FILE_NAME: &str = "settings.json";

fn file_in(dir: &Path) -> PathBuf {
    dir.join(FILE_NAME)
}

/// The settings saved in `dir`, or `Value::Null` when the file is missing, unreadable or not JSON.
pub fn load_from(dir: &Path) -> Value {
    fs::read_to_string(file_in(dir))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null)
}

/// Saves `value` in `dir`, creating the folder if needed. Writes a temporary file and renames it over the old
/// one, so a crash mid-write never leaves a half-written file.
pub fn save_to(dir: &Path, value: &Value) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let text = serde_json::to_string_pretty(value)?;
    let temp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&temp, text)?;
    fs::rename(&temp, file_in(dir))
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

/// The saved settings, or null when there are none to read.
#[tauri::command]
pub fn settings_load(app: AppHandle) -> Value {
    config_dir(&app)
        .map(|dir| load_from(&dir))
        .unwrap_or(Value::Null)
}

/// Event sent to every other window after one saved the settings; its payload is the saved value.
pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";

/// The windows to tell about settings `sender` saved: every open window but the sender.
pub fn recipients<'a>(labels: impl IntoIterator<Item = &'a str>, sender: &str) -> Vec<&'a str> {
    labels.into_iter().filter(|&l| l != sender).collect()
}

/// Saves the settings, then sends them to every other window so they apply everywhere.
#[tauri::command]
pub fn settings_save(app: AppHandle, window: WebviewWindow, value: Value) -> Result<(), String> {
    let dir = config_dir(&app)?;
    save_to(&dir, &value).map_err(|e| format!("Could not save settings: {e}"))?;
    let windows = app.webview_windows();
    for label in recipients(windows.keys().map(String::as_str), window.label()) {
        let _ = app.emit_to(label, SETTINGS_CHANGED_EVENT, &value);
    }
    Ok(())
}

/// Labels of settings windows start with this, followed by the label of the tiili window that opened them.
const SETTINGS_WINDOW_PREFIX: &str = "settings-";

/// Event sent to a tiili window when its settings window has closed, however it closed.
pub const SETTINGS_CLOSED_EVENT: &str = "settings-closed";

/// The label of the settings window tiili window `owner` opens.
pub fn settings_window_label(owner: &str) -> String {
    format!("{SETTINGS_WINDOW_PREFIX}{owner}")
}

/// Whether window `label` is a settings window, which holds no panes.
pub fn is_settings_window(label: &str) -> bool {
    settings_owner(label).is_some()
}

/// The tiili window that opened settings window `label`; `None` when `label` is not a settings window.
pub fn settings_owner(label: &str) -> Option<&str> {
    label
        .strip_prefix(SETTINGS_WINDOW_PREFIX)
        .filter(|owner| !owner.is_empty())
}

/// A rectangle in logical pixels: a window's place and size, or a screen's work area.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The settings window's size when the screen has room for it: the settings form's natural size.
pub const SETTINGS_WINDOW_SIZE: (f64, f64) = (720.0, 640.0);

/// Where the settings window opens: `size` centred over the `owner` window, shrunk to fit `screen` and moved to
/// lie wholly on it.
pub fn settings_window_place(owner: Rect, screen: Rect, size: (f64, f64)) -> Rect {
    let width = size.0.min(screen.width);
    let height = size.1.min(screen.height);
    let centred_x = owner.x + (owner.width - width) / 2.0;
    let centred_y = owner.y + (owner.height - height) / 2.0;
    Rect {
        x: centred_x.clamp(screen.x, screen.x + screen.width - width),
        y: centred_y.clamp(screen.y, screen.y + screen.height - height),
        width,
        height,
    }
}

/// The calling window's place and the work area of the screen it is on, in logical pixels.
fn owner_and_screen(window: &WebviewWindow) -> tauri::Result<(Rect, Option<Rect>)> {
    let scale = window.scale_factor()?;
    let position = window.outer_position()?.to_logical::<f64>(scale);
    let size = window.outer_size()?.to_logical::<f64>(scale);
    let owner = Rect {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    let screen = window.current_monitor()?.map(|monitor| {
        let scale = monitor.scale_factor();
        let area = monitor.work_area();
        let position = area.position.to_logical::<f64>(scale);
        let size = area.size.to_logical::<f64>(scale);
        Rect {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        }
    });
    Ok((owner, screen))
}

/// Opens the calling tiili window's settings window, centred over it, or brings it to the front when it is open
/// already. Async, because building a window from a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn settings_open(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let text = |e: tauri::Error| format!("Could not open settings: {e}");
    let label = match settings_owner(window.label()) {
        // Asked from a settings window: that one comes to the front.
        Some(_) => window.label().to_string(),
        None => settings_window_label(window.label()),
    };
    if let Some(open) = app.get_webview_window(&label) {
        let _ = open.unminimize();
        open.show().map_err(text)?;
        return open.set_focus().map_err(text);
    }
    let (owner, screen) = owner_and_screen(&window).map_err(text)?;
    let place = match screen {
        Some(screen) => settings_window_place(owner, screen, SETTINGS_WINDOW_SIZE),
        None => settings_window_place(owner, owner, SETTINGS_WINDOW_SIZE),
    };
    let url = format!("index.html?settings={}", window.label());
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("Settings")
        .inner_size(place.width, place.height)
        .position(place.x, place.y)
        .build()
        .map_err(text)?;
    Ok(())
}

/// Window `label` was closed: a settings window tells its tiili window, and a tiili window's settings window
/// closes with it, unsaved.
pub fn window_destroyed(app: &AppHandle, label: &str) {
    if let Some(owner) = settings_owner(label) {
        let _ = app.emit_to(owner, SETTINGS_CLOSED_EVENT, ());
    } else if let Some(settings) = app.get_webview_window(&settings_window_label(label)) {
        let _ = settings.destroy();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A fresh, empty folder under the system temp dir, removed when dropped.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("tiili-settings-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn settings_round_trip() {
        let dir = TempDir::new("round-trip");
        let value = json!({ "theme": "koski", "font": { "family": "JetBrains Mono", "size": 16 } });
        save_to(&dir.0, &value).unwrap();
        assert_eq!(load_from(&dir.0), value);
        assert!(!dir.0.join("settings.json.tmp").exists());
    }

    #[test]
    fn settings_save_replaces_the_old_file() {
        let dir = TempDir::new("replace");
        save_to(&dir.0, &json!({ "theme": "nord" })).unwrap();
        save_to(&dir.0, &json!({ "theme": "dracula" })).unwrap();
        assert_eq!(load_from(&dir.0), json!({ "theme": "dracula" }));
    }

    #[test]
    fn settings_saved_in_one_window_go_to_every_other_window() {
        let cases = [
            (
                "two windows",
                vec!["main", "window-1"],
                "window-1",
                vec!["main"],
            ),
            ("only window", vec!["main"], "main", vec![]),
            (
                "three windows",
                vec!["main", "window-1", "window-2"],
                "main",
                vec!["window-1", "window-2"],
            ),
        ];
        for (name, open, sender, expected) in cases {
            assert_eq!(recipients(open, sender), expected, "{name}");
        }
    }

    #[test]
    fn settings_windows_are_told_apart_from_tiili_windows() {
        let cases = [
            ("main window", "main", None),
            ("New Window's window", "window-2", None),
            ("main's settings", "settings-main", Some("main")),
            (
                "a second window's settings",
                "settings-window-2",
                Some("window-2"),
            ),
            ("bare prefix", "settings-", None),
        ];
        for (name, label, owner) in cases {
            assert_eq!(settings_owner(label), owner, "{name}");
            assert_eq!(is_settings_window(label), owner.is_some(), "{name}");
            if let Some(owner) = owner {
                assert_eq!(settings_window_label(owner), label, "{name}");
            }
        }
    }

    #[test]
    fn settings_window_opens_centred_over_its_window_and_on_screen() {
        let rect = |x, y, width, height| Rect {
            x,
            y,
            width,
            height,
        };
        let screen = rect(0.0, 25.0, 1440.0, 875.0);
        let cases = [
            (
                "Larger than the tiili window: centred over a small window",
                rect(500.0, 300.0, 400.0, 300.0),
                screen,
                rect(340.0, 130.0, 720.0, 640.0),
            ),
            (
                "window near the screen's top left: kept on screen",
                rect(0.0, 25.0, 300.0, 200.0),
                screen,
                rect(0.0, 25.0, 720.0, 640.0),
            ),
            (
                "small screen: shrunk to fit",
                rect(0.0, 0.0, 600.0, 400.0),
                rect(0.0, 0.0, 600.0, 400.0),
                rect(0.0, 0.0, 600.0, 400.0),
            ),
        ];
        for (name, owner, screen, expected) in cases {
            assert_eq!(
                settings_window_place(owner, screen, SETTINGS_WINDOW_SIZE),
                expected,
                "{name}"
            );
        }
    }

    #[test]
    fn settings_missing_file_is_null() {
        let dir = TempDir::new("missing");
        assert_eq!(load_from(&dir.0), Value::Null);
    }

    #[test]
    fn settings_broken_json_is_null() {
        let dir = TempDir::new("broken");
        fs::create_dir_all(&dir.0).unwrap();
        fs::write(dir.0.join("settings.json"), "{ \"theme\": ").unwrap();
        assert_eq!(load_from(&dir.0), Value::Null);
    }
}
