//! The user's settings, stored as `settings.json` in the OS app config folder.
//!
//! The core only reads and writes the JSON; the frontend checks each value and falls back to defaults.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

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
