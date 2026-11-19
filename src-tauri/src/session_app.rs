//! Ties the session store to the app: reopens the saved windows at launch, keeps each window's place and its
//! frontend's reports, forgets windows closed while others stay, and asks every window to flush (its latest
//! state and its panes' scrollback) before the session file is written when the app ends.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Condvar, Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::session::{self, Geometry, SessionStore, TabState};
use crate::window_state::{self, Rect};
use crate::windows::{self, WindowLabels, MAIN_WINDOW};

/// Asks a window's frontend to report its latest state and save its panes' scrollback, then call
/// `session_flushed`.
pub const FLUSH_EVENT: &str = "session-flush";
/// How long the app waits for windows to flush before writing the session without them.
const FLUSH_TIMEOUT: Duration = Duration::from_millis(1500);
/// The state file of the window-state plugin earlier tiili versions used, read once to keep the main window's
/// place when there is no session file yet.
const OLD_STATE_FILE: &str = ".window-state.json";
/// Size of a window without a usable saved place; the same as `tauri.conf.json`.
pub(crate) const DEFAULT_WINDOW_SIZE: tauri::LogicalSize<f64> =
    tauri::LogicalSize::new(900.0, 600.0);

/// A window's saved state handed to its frontend once, with its panes' saved scrollback by saved pane id.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Restored {
    pub window: session::Window,
    pub scrollback: HashMap<u32, String>,
    /// Where each local terminal pane with a saved folder opens, by saved pane id: that folder, else its nearest
    /// existing parent, else `None` for home.
    pub folders: HashMap<u32, Option<String>>,
    /// The home folder, which the window's notes write as `~`.
    pub home: Option<String>,
}

/// The folder each of `window`'s local terminal panes opens in (see [`Restored::folders`]).
fn open_folders(window: &session::Window) -> HashMap<u32, Option<String>> {
    window
        .state
        .tabs
        .iter()
        .flat_map(|tab| &tab.panes)
        .filter(|pane| pane.kind == session::PaneKind::Terminal && pane.host.is_none())
        .filter_map(|pane| {
            let cwd = pane.cwd.as_deref()?;
            let found = session::nearest_existing(std::path::Path::new(cwd))
                .map(|dir| dir.to_string_lossy().into_owned());
            Some((pane.id, found))
        })
        .collect()
}

/// The session, held for the app.
#[derive(Default)]
pub struct SessionState {
    /// The app data folder the session lives in; `None` until launch has read it.
    dir: Mutex<Option<PathBuf>>,
    store: Mutex<SessionStore>,
    /// What each reopened window has yet to take, by its label.
    restore: Mutex<HashMap<String, Restored>>,
    /// Windows asked to flush that have not answered yet.
    pending: Mutex<HashSet<String>>,
    flushed: Condvar,
    /// The last windows whose close waits for their flush.
    closing: Mutex<HashSet<String>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

/// Whether window `label` holds panes, so it belongs in the session: every window but settings windows.
fn is_session_window(label: &str) -> bool {
    !crate::settings::is_settings_window(label)
}

/// The open windows that hold panes.
fn session_labels(app: &AppHandle) -> Vec<String> {
    app.webview_windows()
        .into_keys()
        .filter(|label| is_session_window(label))
        .collect()
}

impl SessionState {
    /// Writes the session file from the open windows' latest state.
    fn save(&self) {
        let Some(dir) = lock(&self.dir).clone() else {
            return;
        };
        let session = lock(&self.store).session();
        if let Err(e) = session::write_atomic(&dir, &session) {
            eprintln!("tiili: could not save the session: {e}");
        }
    }

    /// Asks `labels` to flush and waits until they all have, or [`FLUSH_TIMEOUT`] passed.
    fn flush(&self, app: &AppHandle, labels: Vec<String>) {
        lock(&self.pending).extend(labels.iter().cloned());
        for label in &labels {
            if app.emit_to(label.as_str(), FLUSH_EVENT, ()).is_err() {
                lock(&self.pending).remove(label);
            }
        }
        let pending = lock(&self.pending);
        let (mut pending, _) = self
            .flushed
            .wait_timeout_while(pending, FLUSH_TIMEOUT, |p| !p.is_empty())
            .unwrap_or_else(|e| e.into_inner());
        pending.clear();
    }
}

/// The session in the app data folder, or, when there is no session file yet, the main window's place from the
/// old window-state file. An unreadable or other-version file gives an empty session and stays on disk until
/// the next write.
fn read_session(app: &tauri::App, dir: &std::path::Path) -> session::Session {
    match std::fs::read(dir.join(session::FILE)) {
        Ok(bytes) => session::parse(&bytes).unwrap_or_default(),
        Err(_) => {
            let old = app.path().app_config_dir().ok().and_then(|config| {
                window_state::read_saved(&config.join(OLD_STATE_FILE), MAIN_WINDOW)
            });
            session::Session {
                windows: old
                    .map(|rect| session::Window {
                        label: MAIN_WINDOW.to_string(),
                        geometry: Geometry {
                            rect: Some(rect),
                            ..Geometry::default()
                        },
                        ..session::Window::default()
                    })
                    .into_iter()
                    .collect(),
                ..session::Session::default()
            }
        }
    }
}

/// Reads each saved pane's scrollback, then deletes the scrollback folder so that a crash later in this run
/// reopens panes without stale scrollback.
fn take_scrollback(dir: &std::path::Path, window: &session::Window) -> HashMap<u32, String> {
    window
        .state
        .tabs
        .iter()
        .flat_map(|tab| &tab.panes)
        .filter_map(|pane| {
            let path = session::scrollback_path(dir, &window.label, pane.id);
            Some((pane.id, std::fs::read_to_string(path).ok()?))
        })
        .collect()
}

/// Puts `window` at `geometry`, or at the default size centred when it has no saved place.
fn place(window: &WebviewWindow, geometry: Geometry) -> tauri::Result<()> {
    match geometry.rect {
        Some(rect) => {
            window.set_size(tauri::PhysicalSize::new(rect.width, rect.height))?;
            window.set_position(tauri::PhysicalPosition::new(rect.x, rect.y))?;
        }
        None => {
            window.set_size(DEFAULT_WINDOW_SIZE)?;
            window.center()?;
        }
    }
    if geometry.maximized {
        window.maximize()?;
    }
    if geometry.fullscreen {
        window.set_fullscreen(true)?;
    }
    Ok(())
}

/// Reopens the saved windows: the first in the main window, the others as new windows, each at its saved place
/// when that is on a connected screen. With nothing saved the main window opens as `tauri.conf.json` sets it.
pub fn restore(app: &tauri::App) -> tauri::Result<()> {
    let state = app.state::<SessionState>();
    let dir = app.path().app_data_dir()?;
    *lock(&state.dir) = Some(dir.clone());
    let saved = read_session(app, &dir);
    let scrollback: Vec<_> = saved
        .windows
        .iter()
        .map(|w| take_scrollback(&dir, w))
        .collect();
    let _ = std::fs::remove_dir_all(dir.join(session::SCROLLBACK_DIR));
    // History lines a shell without tiili's integration never read, left by an earlier run.
    let _ = std::fs::remove_dir_all(dir.join(session::HISTORY_DIR));
    app.state::<crate::pty::SessionRegistry>()
        .set_history_dir(dir.join(session::HISTORY_DIR));
    let Some(main) = app.get_webview_window(MAIN_WINDOW) else {
        return Ok(());
    };
    let monitors: Vec<_> = main
        .available_monitors()?
        .iter()
        .map(|m| Rect {
            x: m.position().x,
            y: m.position().y,
            width: m.size().width,
            height: m.size().height,
        })
        .collect();
    let places = session::plan_restore(&saved, &monitors);
    for (index, ((window, geometry), scrollback)) in saved
        .windows
        .into_iter()
        .zip(places)
        .zip(scrollback)
        .enumerate()
    {
        let target = if index == 0 {
            main.clone()
        } else {
            let label = app.state::<WindowLabels>().next();
            let built = windows::window_builder(app.handle(), label, "index.html".into())
                .inner_size(DEFAULT_WINDOW_SIZE.width, DEFAULT_WINDOW_SIZE.height)
                .build()?;
            windows::reveal_later(&built);
            built
        };
        place(&target, geometry)?;
        let label = target.label().to_string();
        {
            let mut store = lock(&state.store);
            store.set_geometry(&label, geometry);
            store.update(&label, window.state.clone());
        }
        let folders = open_folders(&window);
        let home = app
            .path()
            .home_dir()
            .ok()
            .map(|dir| dir.to_string_lossy().into_owned());
        lock(&state.restore).insert(
            label,
            Restored {
                window,
                scrollback,
                folders,
                home,
            },
        );
    }
    Ok(())
}

/// Records `window`'s place and size; while it is maximised, fullscreen or minimised the place it had before
/// is kept, so it un-maximises there after a relaunch.
pub fn record_geometry(window: &tauri::Window) {
    let label = window.label();
    if !is_session_window(label) {
        return;
    }
    let maximized = window.is_maximized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let state = window.state::<SessionState>();
    let mut store = lock(&state.store);
    let mut geometry = store.geometry(label);
    if !maximized && !fullscreen && !minimized {
        if let (Ok(at), Ok(size)) = (window.outer_position(), window.inner_size()) {
            geometry.rect = Some(Rect {
                x: at.x,
                y: at.y,
                width: size.width,
                height: size.height,
            });
        }
    }
    geometry.maximized = maximized;
    geometry.fullscreen = fullscreen;
    store.set_geometry(label, geometry);
}

/// A window is about to close. Closing the last window ends the app, so it first waits for that window to
/// flush, then closes it.
pub fn close_requested(window: &tauri::Window, api: &tauri::CloseRequestApi) {
    let label = window.label().to_string();
    if !is_session_window(&label) {
        return;
    }
    record_geometry(window);
    let app = window.app_handle().clone();
    let state = app.state::<SessionState>();
    if lock(&state.store).is_ending() || session_labels(&app) != [label.clone()] {
        return;
    }
    api.prevent_close();
    if !lock(&state.closing).insert(label.clone()) {
        return;
    }
    let window = window.clone();
    std::thread::spawn(move || {
        let state = app.state::<SessionState>();
        state.flush(&app, vec![label]);
        state.save();
        let _ = window.destroy();
    });
}

/// Window `label` is gone: it is forgotten unless it was the last one or the app is ending.
pub fn window_destroyed(app: &AppHandle, label: &str) {
    if !is_session_window(label) {
        return;
    }
    let state = app.state::<SessionState>();
    lock(&state.restore).remove(label);
    lock(&state.closing).remove(label);
    lock(&state.store).close(label);
    state.save();
}

/// The app was asked to end: unless it is ending already, every window flushes and the session is written
/// before it exits. Returns whether the exit has to wait for that.
pub fn exit_requested(app: &AppHandle) -> bool {
    let state = app.state::<SessionState>();
    {
        let mut store = lock(&state.store);
        if store.is_ending() {
            return false;
        }
        store.end();
    }
    for window in app.webview_windows().values() {
        record_geometry(&window.as_ref().window());
    }
    let labels = session_labels(app);
    let app = app.clone();
    std::thread::spawn(move || {
        let state = app.state::<SessionState>();
        state.flush(&app, labels);
        state.save();
        app.exit(0);
    });
    true
}

/// The app is exiting: the session is written one last time.
pub fn exited(app: &AppHandle) {
    app.state::<SessionState>().save();
}

/// The calling window's saved state, once, right after launch; `None` for a window that was not reopened.
#[tauri::command]
pub fn session_load(window: WebviewWindow, state: State<'_, SessionState>) -> Option<Restored> {
    lock(&state.restore).remove(window.label())
}

/// The calling window's tabs, panes and folders changed; the session file is rewritten.
#[tauri::command]
pub fn session_update(window: WebviewWindow, state: State<'_, SessionState>, tab_state: TabState) {
    if !is_session_window(window.label()) {
        return;
    }
    lock(&state.store).update(window.label(), tab_state);
    state.save();
}

/// Saves the scrollback of the calling window's pane `pane_id`, readable by the user only.
#[tauri::command]
pub fn session_save_scrollback(
    window: WebviewWindow,
    state: State<'_, SessionState>,
    pane_id: u32,
    text: String,
) -> Result<(), String> {
    let Some(dir) = lock(&state.dir).clone() else {
        return Ok(());
    };
    let path = session::scrollback_path(&dir, window.label(), pane_id);
    session::write_private(&path, text.as_bytes()).map_err(|e| e.to_string())
}

/// Restoring scrollback and commands was turned off: saved scrollback and command lines are deleted.
#[tauri::command]
pub fn session_clear_scrollback(state: State<'_, SessionState>) {
    if let Some(dir) = lock(&state.dir).clone() {
        let _ = std::fs::remove_dir_all(dir.join(session::SCROLLBACK_DIR));
        let _ = std::fs::remove_dir_all(dir.join(session::HISTORY_DIR));
    }
    lock(&state.store).forget_commands();
    state.save();
}

/// The calling window has flushed.
#[tauri::command]
pub fn session_flushed(window: WebviewWindow, state: State<'_, SessionState>) {
    lock(&state.pending).remove(window.label());
    state.flushed.notify_all();
}
