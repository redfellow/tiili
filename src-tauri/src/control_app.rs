//! The app's side of the control channel (see [`crate::control_server`]): an open asks the caller's window for a
//! pane through `pane-open-request` and waits for its `pane_open_done`; a list is answered from the window's sessions
//! and their latest reports, in the grid order the window reports through `pane_order_set`. Setup starts the
//! endpoint, tells every pane about it and puts `tiili` in the app's bin folder.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::control::{grid_order, place_name, PaneInfo};
use crate::control_server::{ControlServer, Handler};
use crate::pty::{ControlEnv, SessionId, SessionRegistry};
use crate::windows::WindowSessions;
use crate::SessionReports;

/// Event sent to the caller's window to open a pane for `tiili open`; its payload is a [`PaneOpenRequest`], and the
/// window answers with `pane_open_done`.
pub const PANE_OPEN_REQUEST_EVENT: &str = "pane-open-request";

/// How long an open waits for the window to answer.
const OPEN_WAIT: Duration = Duration::from_secs(10);

/// A pane `tiili open` asks a window for.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneOpenRequest {
    request_id: u64,
    cwd: Option<String>,
    title: Option<String>,
    command: Vec<String>,
    path: Option<String>,
}

type OpenResult = Result<SessionId, String>;

/// Opens waiting for their window's answer, by request id.
#[derive(Default)]
pub struct PendingOpens {
    next: AtomicU64,
    waiting: Mutex<HashMap<u64, mpsc::Sender<OpenResult>>>,
}

impl PendingOpens {
    fn add(&self) -> (u64, mpsc::Receiver<OpenResult>) {
        let id = self.next.fetch_add(1, Ordering::Relaxed) + 1;
        let (tx, rx) = mpsc::channel();
        if let Ok(mut waiting) = self.waiting.lock() {
            waiting.insert(id, tx);
        }
        (id, rx)
    }

    fn finish(&self, id: u64, result: OpenResult) {
        let tx = self.waiting.lock().ok().and_then(|mut w| w.remove(&id));
        if let Some(tx) = tx {
            let _ = tx.send(result);
        }
    }
}

/// The titles `tiili open --title` gave panes, which `tiili list` shows instead of their chip names.
#[derive(Default)]
pub struct PaneTitles(Mutex<HashMap<SessionId, String>>);

impl PaneTitles {
    fn set(&self, id: SessionId, title: String) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(id, title);
        }
    }

    fn get(&self, id: SessionId) -> Option<String> {
        self.0.lock().ok().and_then(|map| map.get(&id).cloned())
    }

    pub fn forget(&self, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(&id);
        }
    }
}

/// Each window's sessions in grid order, as its frontend last reported them, by window label.
#[derive(Default)]
pub struct PaneOrders(Mutex<HashMap<String, Vec<SessionId>>>);

impl PaneOrders {
    fn get(&self, label: &str) -> Vec<SessionId> {
        self.0
            .lock()
            .ok()
            .and_then(|map| map.get(label).cloned())
            .unwrap_or_default()
    }

    pub fn forget(&self, label: &str) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(label);
        }
    }
}

/// The window reports its panes' sessions in grid order, whenever its grid or a pane's session changes.
#[tauri::command]
pub fn pane_order_set(
    window: WebviewWindow,
    orders: State<'_, PaneOrders>,
    sessions: Vec<SessionId>,
) {
    if let Ok(mut map) = orders.0.lock() {
        map.insert(window.label().to_string(), sessions);
    }
}

/// The running endpoint, removed when the app exits.
#[derive(Default)]
pub struct ControlState(Mutex<Option<ControlServer>>);

/// The window answers a `pane-open-request`: `pane` is the pane it opened, else `error` says why it could not.
#[tauri::command]
pub fn pane_open_done(
    pending: State<'_, PendingOpens>,
    request_id: u64,
    pane: Option<SessionId>,
    error: Option<String>,
) {
    let result = pane.ok_or_else(|| error.unwrap_or_else(|| "the pane did not open".to_string()));
    pending.finish(request_id, result);
}

struct AppHandler(AppHandle);

impl AppHandler {
    fn window_of(&self, caller: SessionId) -> Result<String, String> {
        self.0
            .state::<WindowSessions>()
            .owner(caller)
            .ok_or_else(|| format!("pane {caller} is not open in tiili"))
    }
}

impl Handler for AppHandler {
    fn open(
        &self,
        caller: SessionId,
        cwd: Option<String>,
        title: Option<String>,
        command: Vec<String>,
        path: Option<String>,
    ) -> Result<SessionId, String> {
        let label = self.window_of(caller)?;
        let pending = self.0.state::<PendingOpens>();
        let (request_id, answer) = pending.add();
        let request = PaneOpenRequest {
            request_id,
            cwd,
            title: title.clone(),
            command,
            path,
        };
        if let Err(e) = self
            .0
            .emit_to(label.as_str(), PANE_OPEN_REQUEST_EVENT, request)
        {
            pending.finish(request_id, Err(String::new()));
            return Err(format!("could not reach the window: {e}"));
        }
        let result = answer.recv_timeout(OPEN_WAIT).unwrap_or_else(|_| {
            pending.finish(request_id, Err(String::new()));
            Err("the window did not open the pane in time".to_string())
        });
        if let (Ok(id), Some(title)) = (&result, title) {
            // A pane that has already ended keeps no title.
            if self.0.state::<WindowSessions>().owner(*id).is_some() {
                self.0.state::<PaneTitles>().set(*id, title);
            }
        }
        result
    }

    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
        let label = self.window_of(caller)?;
        let (reports, titles) = (
            self.0.state::<SessionReports>(),
            self.0.state::<PaneTitles>(),
        );
        let grid = self.0.state::<PaneOrders>().get(&label);
        Ok(
            grid_order(self.0.state::<WindowSessions>().sessions(&label), &grid)
                .into_iter()
                .map(|id| {
                    let (at, _) = reports.latest(id);
                    let cwd = at.as_ref().map(|a| a.cwd.clone()).unwrap_or_default();
                    let title = titles.get(id).unwrap_or_else(|| match &at {
                        Some(at) => place_name(
                            &at.cwd,
                            at.repo
                                .as_ref()
                                .map(|r| (r.name.as_str(), r.worktree.as_deref())),
                            at.host.as_deref(),
                        ),
                        None => String::new(),
                    });
                    PaneInfo { id, cwd, title }
                })
                .collect(),
        )
    }
}

/// What `<bin>/tiili.cmd` holds on Windows: it runs `exe` with the arguments it was given.
#[cfg(windows)]
fn windows_shim(exe: &Path) -> String {
    format!("@\"{}\" %*\r\n", exe.display())
}

/// Puts `tiili` in `bin`: a link to `exe` on macOS and Linux, a `tiili.cmd` running it on Windows. An existing one
/// is replaced, so it follows the app when it moves.
fn install_cli(bin: &Path, exe: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(bin)?;
    #[cfg(unix)]
    {
        let link = bin.join("tiili");
        if std::fs::read_link(&link).ok().as_deref() == Some(exe) {
            return Ok(());
        }
        let fresh = bin.join(format!(".tiili-{}", std::process::id()));
        let _ = std::fs::remove_file(&fresh);
        std::os::unix::fs::symlink(exe, &fresh)?;
        std::fs::rename(&fresh, &link)
    }
    #[cfg(windows)]
    {
        std::fs::write(bin.join("tiili.cmd"), windows_shim(exe))
    }
}

/// Starts the control endpoint and tells every pane started from now on about it. Without it panes still open;
/// `tiili` then says it cannot reach the app.
pub fn start(app: &AppHandle) {
    let token = match crate::control::new_token() {
        Ok(token) => token,
        Err(e) => {
            eprintln!("tiili: no control channel, no random token: {e}");
            return;
        }
    };
    let server =
        match crate::control_server::start(token.clone(), Arc::new(AppHandler(app.clone()))) {
            Ok(server) => server,
            Err(e) => {
                eprintln!("tiili: no control channel: {e}");
                return;
            }
        };
    let bin_dir = app
        .path()
        .app_data_dir()
        .map(|dir| dir.join("bin"))
        .unwrap_or_else(|_| PathBuf::from("bin"));
    match std::env::current_exe() {
        Ok(exe) => {
            if let Err(e) = install_cli(&bin_dir, &exe) {
                eprintln!("tiili: could not put tiili in {}: {e}", bin_dir.display());
            }
        }
        Err(e) => eprintln!("tiili: could not find its own binary: {e}"),
    }
    app.state::<SessionRegistry>().set_control(ControlEnv {
        socket: server.endpoint().to_os_string(),
        token,
        bin_dir,
    });
    if let Ok(mut state) = app.state::<ControlState>().0.lock() {
        *state = Some(server);
    }
}

/// The app is exiting: the socket goes.
pub fn stop(app: &AppHandle) {
    let server = app
        .try_state::<ControlState>()
        .and_then(|state| state.0.lock().ok().and_then(|mut s| s.take()));
    drop(server);
}
