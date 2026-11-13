//! The Heynote pane's notes, stored as plain files under `heynote/notes/` in the OS app config folder, and its
//! own settings and tab state in `heynote/state.json`.
//!
//! The pane loads the whole library once when it opens and then writes each change through these commands.
//! Every path comes from the pane, so each one is checked to stay inside the notes folder.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

const DIR_NAME: &str = "heynote";
const NOTES_DIR: &str = "notes";
const STATE_FILE: &str = "state.json";

/// Everything the pane needs to start: each note's text by its library path, the library's folders and the
/// pane's saved state (settings, open tabs, theme).
#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Library {
    pub notes: BTreeMap<String, String>,
    pub dirs: Vec<String>,
    pub state: Value,
}

/// `path` as a relative path inside the notes folder, or an error when it is empty, absolute or climbs out.
fn inside(path: &str) -> Result<PathBuf, String> {
    let rel = Path::new(path);
    let plain = !path.is_empty() && rel.components().all(|c| matches!(c, Component::Normal(_)));
    if plain {
        Ok(rel.to_path_buf())
    } else {
        Err(format!("Not a note path: {path:?}"))
    }
}

/// `path` relative to `root`, with `/` separators as the pane expects on every platform.
fn library_path(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Option<Vec<&str>> = rel.components().map(|c| c.as_os_str().to_str()).collect();
    Some(parts?.join("/"))
}

fn walk(root: &Path, dir: &Path, library: &mut Library) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        // Hidden files and half-written temporary files are not notes.
        if name.starts_with('.') || name.ends_with(".tmp") {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            if let Some(rel) = library_path(root, &path) {
                library.dirs.push(rel);
            }
            walk(root, &path, library);
        } else if kind.is_file() {
            if let (Some(rel), Ok(text)) = (library_path(root, &path), fs::read_to_string(&path)) {
                library.notes.insert(rel, text);
            }
        }
    }
}

/// The library kept in `dir`; empty when the folder does not exist yet.
pub fn load_from(dir: &Path) -> Library {
    let mut library = Library::default();
    let notes = dir.join(NOTES_DIR);
    walk(&notes, &notes, &mut library);
    library.dirs.sort();
    library.state = fs::read_to_string(dir.join(STATE_FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null);
    library
}

/// Writes `text` to `file` through a temporary file renamed over it, so a crash never leaves half a note.
fn write_whole(file: &Path, text: &str) -> io::Result<()> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)?;
    }
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let temp = file.with_file_name(format!(
        ".{name}.{}.tmp",
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&temp, text)?;
    fs::rename(&temp, file)
}

pub fn write_in(dir: &Path, path: &str, content: &str) -> Result<(), String> {
    let file = dir.join(NOTES_DIR).join(inside(path)?);
    write_whole(&file, content).map_err(|e| format!("Could not save note {path}: {e}"))
}

/// Removes note `path`; a note that is already gone is fine.
pub fn remove_in(dir: &Path, path: &str) -> Result<(), String> {
    match fs::remove_file(dir.join(NOTES_DIR).join(inside(path)?)) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => {
            Err(format!("Could not delete note {path}: {e}"))
        }
        _ => Ok(()),
    }
}

pub fn move_in(dir: &Path, from: &str, to: &str) -> Result<(), String> {
    let notes = dir.join(NOTES_DIR);
    let target = notes.join(inside(to)?);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(notes.join(inside(from)?), target)
        .map_err(|e| format!("Could not move note {from}: {e}"))
}

pub fn mkdir_in(dir: &Path, path: &str) -> Result<(), String> {
    fs::create_dir_all(dir.join(NOTES_DIR).join(inside(path)?)).map_err(|e| e.to_string())
}

/// Removes folder `path` only when it is empty.
pub fn rmdir_in(dir: &Path, path: &str) -> Result<(), String> {
    match fs::remove_dir(dir.join(NOTES_DIR).join(inside(path)?)) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => {
            Err(format!("Could not delete folder {path}: {e}"))
        }
        _ => Ok(()),
    }
}

pub fn save_state_in(dir: &Path, state: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    write_whole(&dir.join(STATE_FILE), &text)
        .map_err(|e| format!("Could not save Heynote state: {e}"))
}

fn heynote_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join(DIR_NAME))
}

#[tauri::command]
pub fn heynote_load(app: AppHandle) -> Result<Library, String> {
    Ok(load_from(&heynote_dir(&app)?))
}

#[tauri::command]
pub fn heynote_write(app: AppHandle, path: String, content: String) -> Result<(), String> {
    write_in(&heynote_dir(&app)?, &path, &content)
}

#[tauri::command]
pub fn heynote_remove(app: AppHandle, path: String) -> Result<(), String> {
    remove_in(&heynote_dir(&app)?, &path)
}

#[tauri::command]
pub fn heynote_move(app: AppHandle, from: String, to: String) -> Result<(), String> {
    move_in(&heynote_dir(&app)?, &from, &to)
}

#[tauri::command]
pub fn heynote_mkdir(app: AppHandle, path: String) -> Result<(), String> {
    mkdir_in(&heynote_dir(&app)?, &path)
}

#[tauri::command]
pub fn heynote_rmdir(app: AppHandle, path: String) -> Result<(), String> {
    rmdir_in(&heynote_dir(&app)?, &path)
}

#[tauri::command]
pub fn heynote_save_state(app: AppHandle, state: Value) -> Result<(), String> {
    save_state_in(&heynote_dir(&app)?, &state)
}

/// Event sent to the window holding Heynote when another window asks for it: it focuses its Heynote pane.
pub const HEYNOTE_FOCUS_EVENT: &str = "heynote-focus";

/// Which window holds the one Heynote pane of the app, by label; every Heynote page keeps its own copy of the
/// notes, so there is at most one across all windows.
#[derive(Default)]
pub struct HeynoteOwner(Mutex<Option<String>>);

impl HeynoteOwner {
    /// Window `label` wants to open Heynote: `None` when it may (it now holds it), else the label of the window
    /// that already does.
    pub fn claim(&self, label: &str) -> Option<String> {
        let mut owner = self.0.lock().ok()?;
        match owner.as_deref() {
            Some(other) if other != label => Some(other.to_string()),
            _ => {
                *owner = Some(label.to_string());
                None
            }
        }
    }

    /// Window `label` closed its Heynote pane or itself; Heynote is free when it held it.
    pub fn release(&self, label: &str) {
        if let Ok(mut owner) = self.0.lock() {
            if owner.as_deref() == Some(label) {
                *owner = None;
            }
        }
    }
}

/// The calling window wants to open Heynote: null when it may, else the label of the window holding it.
#[tauri::command]
pub fn heynote_claim(window: WebviewWindow, owner: State<'_, HeynoteOwner>) -> Option<String> {
    owner.claim(window.label())
}

/// The calling window closed its Heynote pane.
#[tauri::command]
pub fn heynote_release(window: WebviewWindow, owner: State<'_, HeynoteOwner>) {
    owner.release(window.label());
}

/// Brings window `label` forward and has it focus its Heynote pane.
#[tauri::command]
pub fn heynote_focus(app: AppHandle, label: String) -> Result<(), String> {
    let window = app.get_webview_window(&label).ok_or_else(|| {
        "The window holding Heynote has closed; click Heynote again to open it here.".to_string()
    })?;
    let text = |e: tauri::Error| format!("Could not bring forward the window holding Heynote: {e}");
    window.unminimize().map_err(text)?;
    window.show().map_err(text)?;
    window.set_focus().map_err(text)?;
    app.emit_to(label.as_str(), HEYNOTE_FOCUS_EVENT, ())
        .map_err(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("tiili-notes-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn an_empty_folder_loads_an_empty_library() {
        let dir = TempDir::new("empty");
        assert_eq!(
            load_from(&dir.0),
            Library {
                state: Value::Null,
                ..Library::default()
            }
        );
    }

    #[test]
    fn notes_folders_and_state_round_trip() {
        let dir = TempDir::new("round-trip");
        write_in(&dir.0, "scratch.txt", "hello").unwrap();
        write_in(&dir.0, "work/plan.txt", "plan").unwrap();
        mkdir_in(&dir.0, "empty").unwrap();
        save_state_in(&dir.0, &json!({ "theme": "dark" })).unwrap();

        let library = load_from(&dir.0);
        assert_eq!(
            library.notes.get("scratch.txt").map(String::as_str),
            Some("hello")
        );
        assert_eq!(
            library.notes.get("work/plan.txt").map(String::as_str),
            Some("plan")
        );
        assert_eq!(library.dirs, vec!["empty".to_string(), "work".to_string()]);
        assert_eq!(library.state, json!({ "theme": "dark" }));
    }

    #[test]
    fn move_remove_and_rmdir() {
        let dir = TempDir::new("move");
        write_in(&dir.0, "a.txt", "a").unwrap();
        move_in(&dir.0, "a.txt", "sub/b.txt").unwrap();
        remove_in(&dir.0, "missing.txt").unwrap();
        mkdir_in(&dir.0, "gone").unwrap();
        rmdir_in(&dir.0, "gone").unwrap();
        assert!(
            rmdir_in(&dir.0, "sub").is_err(),
            "a folder with notes is not removed"
        );

        let library = load_from(&dir.0);
        assert_eq!(library.notes.keys().collect::<Vec<_>>(), vec!["sub/b.txt"]);
        assert_eq!(library.dirs, vec!["sub".to_string()]);
    }

    #[test]
    fn paths_cannot_leave_the_notes_folder() {
        let dir = TempDir::new("escape");
        for bad in ["", "../x.txt", "/etc/passwd", "a/../../x.txt", "./x.txt"] {
            assert!(
                write_in(&dir.0, bad, "x").is_err(),
                "{bad:?} must be refused"
            );
        }
        assert!(move_in(&dir.0, "a.txt", "../b.txt").is_err());
    }

    #[test]
    fn heynote_open_in_another_window_names_that_window() {
        let owner = HeynoteOwner::default();
        assert_eq!(owner.claim("main"), None);
        assert_eq!(owner.claim("main"), None, "the holder may ask again");
        assert_eq!(owner.claim("window-1").as_deref(), Some("main"));
        owner.release("window-1");
        assert_eq!(
            owner.claim("window-1").as_deref(),
            Some("main"),
            "only the holder releases"
        );
        owner.release("main");
        assert_eq!(owner.claim("window-1"), None);
        assert_eq!(owner.claim("main").as_deref(), Some("window-1"));
    }
}
