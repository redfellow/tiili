//! The app's side of the control channel (see [`crate::control_server`]): an open asks the caller's window for a
//! pane through `pane-open-request` and waits for its `pane_open_done`; a close asks the pane's window through
//! `pane-close-request` and waits for its `pane_close_done`; a minimize or restore asks the pane's window through
//! `pane-minimize-request` and waits for its `pane_minimize_done`; an attention request goes to the caller's window as
//! `pane-attention-request`, which marks it as an escape-code signal would. A list is answered from the window's
//! sessions and their latest reports, in the grid order the window reports through `pane_order_set`, with the panes
//! it reports minimized marked so. Which pane
//! opened which, and with what key, lives in [`PaneOwners`]. Setup starts the endpoint, tells every pane about it and
//! puts `tiili` in the app's bin folder.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::attention::{Attention, MarkInfo};
use crate::command::Running;
use crate::control::{
    grid_order, place_name, AttentionRecord, CliError, PaneInfo, RepoRecord, RunningRecord,
};
use crate::control_server::{ControlServer, Handler, OpenRequest};
use crate::pty::{ControlEnv, SessionId, SessionRegistry};
use crate::windows::WindowSessions;
use crate::{PaneCwdEvent, SessionReports};

/// Event sent to the caller's window to open a pane for `tiili open`; its payload is a [`PaneOpenRequest`], and the
/// window answers with `pane_open_done`.
pub const PANE_OPEN_REQUEST_EVENT: &str = "pane-open-request";

/// Event sent to a pane's window to close it for `tiili close`; its payload is a [`PaneCloseRequest`], and the window
/// answers with `pane_close_done`.
pub const PANE_CLOSE_REQUEST_EVENT: &str = "pane-close-request";

/// Event sent to a pane's window to minimize or restore it for `tiili minimize` and `tiili restore`; its payload is a
/// [`PaneMinimizeRequest`], and the window answers with `pane_minimize_done`.
pub const PANE_MINIMIZE_REQUEST_EVENT: &str = "pane-minimize-request";

/// The answer a window gives a minimize when the pane is the only one showing in its tab.
const LAST_VISIBLE_PANE: &str = "last_visible_pane";

/// Event sent to the caller's window for `tiili attention`; its payload is a [`PaneAttentionRequest`].
pub const PANE_ATTENTION_REQUEST_EVENT: &str = "pane-attention-request";

/// How long an open, a close, a minimize or a restore waits for the window to answer.
const OPEN_WAIT: Duration = Duration::from_secs(10);

/// A pane `tiili open` asks a window for.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneOpenRequest {
    request_id: u64,
    /// The pane `tiili open` ran in: the new pane joins its tab.
    caller: SessionId,
    cwd: Option<String>,
    title: Option<String>,
    command: Vec<String>,
    path: Option<String>,
    /// `--minimized`: the pane opens as a badge in the window's top bar and never shows in the grid first.
    minimized: bool,
}

/// A pane `tiili close` asks its window to close.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneCloseRequest {
    request_id: u64,
    session: SessionId,
}

/// A pane `tiili minimize` (`minimize` true) or `tiili restore` asks its window to minimize or bring back.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneMinimizeRequest {
    request_id: u64,
    session: SessionId,
    minimize: bool,
}

/// `tiili attention` from pane `session`: mark it with `message`, or clear its mark.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneAttentionRequest {
    session: SessionId,
    message: Option<String>,
    clear: bool,
}

type OpenResult = Result<SessionId, String>;

/// Opens, closes, minimizes and restores waiting for their window's answer, by request id.
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

    /// Sends `payload` as `event` to window `label` with a new request id and waits for the window's answer.
    fn ask<P: Serialize + Clone>(
        &self,
        app: &AppHandle,
        label: &str,
        event: &str,
        payload: impl FnOnce(u64) -> P,
    ) -> OpenResult {
        let (request_id, answer) = self.add();
        if let Err(e) = app.emit_to(label, event, payload(request_id)) {
            self.finish(request_id, Err(String::new()));
            return Err(format!("could not reach the window: {e}"));
        }
        answer.recv_timeout(OPEN_WAIT).unwrap_or_else(|_| {
            self.finish(request_id, Err(String::new()));
            Err("the window did not answer in time".to_string())
        })
    }
}

/// What `tiili open` asked a pane for: the title `--title` gave it, which `tiili list` shows instead of its chip
/// name, and the command it runs.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PaneOpen {
    pub title: Option<String>,
    pub argv: Vec<String>,
}

/// The panes `tiili open` opened, by session.
#[derive(Default)]
pub struct PaneOpens(Mutex<HashMap<SessionId, PaneOpen>>);

impl PaneOpens {
    fn set(&self, id: SessionId, open: PaneOpen) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(id, open);
        }
    }

    fn get(&self, id: SessionId) -> Option<PaneOpen> {
        self.0.lock().ok().and_then(|map| map.get(&id).cloned())
    }

    pub fn forget(&self, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(&id);
        }
    }
}

/// The pane that opened a pane with `tiili open`, and the key it gave.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Owner {
    by: SessionId,
    key: Option<String>,
}

#[derive(Default)]
struct OwnersState {
    owners: HashMap<SessionId, Owner>,
    /// The (owner, key) pairs an open is running for right now.
    pending: HashSet<(SessionId, String)>,
}

/// Which pane opened which with `tiili open`, and with what key, for as long as both live. Kept only in memory: a
/// restart forgets it. A keyed open is atomic: a second open with the caller's key waits for the first, then reuses
/// its pane.
#[derive(Default)]
pub struct PaneOwners {
    state: Mutex<OwnersState>,
    /// Signalled whenever a keyed open finishes.
    done: Condvar,
}

impl PaneOwners {
    fn lock(&self) -> MutexGuard<'_, OwnersState> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Opens a pane for `caller` with `open`, recording `caller` as its owner when it is still `live`. With `key`,
    /// `caller`'s live pane with that key is returned instead (`true`: reused), and an open with the same key
    /// already running is waited for first.
    fn open(
        &self,
        caller: SessionId,
        key: Option<String>,
        live: impl Fn(SessionId) -> bool,
        open: impl FnOnce() -> OpenResult,
    ) -> Result<(SessionId, bool), String> {
        let Some(key) = key else {
            let id = open()?;
            if live(id) {
                self.lock().owners.insert(
                    id,
                    Owner {
                        by: caller,
                        key: None,
                    },
                );
            }
            return Ok((id, false));
        };
        let pair = (caller, key.clone());
        let mut state = self.lock();
        loop {
            let reuse = state
                .owners
                .iter()
                .find(|(id, o)| o.by == caller && o.key.as_ref() == Some(&key) && live(**id))
                .map(|(id, _)| *id);
            if let Some(id) = reuse {
                return Ok((id, true));
            }
            if !state.pending.contains(&pair) {
                break;
            }
            state = self.done.wait(state).unwrap_or_else(|e| e.into_inner());
        }
        state.pending.insert(pair.clone());
        drop(state);
        let result = open();
        let mut state = self.lock();
        state.pending.remove(&pair);
        if let Ok(id) = result {
            // A dead pane with the same key gives its key up.
            state
                .owners
                .retain(|_, o| !(o.by == caller && o.key.as_ref() == Some(&key)));
            if live(id) {
                state.owners.insert(
                    id,
                    Owner {
                        by: caller,
                        key: Some(key),
                    },
                );
            }
        }
        drop(state);
        self.done.notify_all();
        result.map(|id| (id, false))
    }

    /// Whether `caller` may close `target`: it must be `live` and opened by `caller`.
    fn check_close(
        &self,
        caller: SessionId,
        target: SessionId,
        live: impl Fn(SessionId) -> bool,
    ) -> Result<(), CliError> {
        if !live(target) {
            return Err(CliError::NoSuchPane(format!("no open pane {target}")));
        }
        match self.lock().owners.get(&target) {
            Some(owner) if owner.by == caller => Ok(()),
            _ => Err(CliError::NotOpenedByYou(format!(
                "pane {target} was not opened by this pane"
            ))),
        }
    }

    /// The pane `caller` may minimize or restore: `target` under the close rule, else the caller itself while it is
    /// `live`.
    fn check_minimize(
        &self,
        caller: SessionId,
        target: Option<SessionId>,
        live: impl Fn(SessionId) -> bool,
    ) -> Result<SessionId, CliError> {
        match target {
            Some(target) => self.check_close(caller, target, live).map(|()| target),
            None if live(caller) => Ok(caller),
            None => Err(CliError::NoSuchPane(format!("no open pane {caller}"))),
        }
    }

    /// The pane that opened `id` and the key it gave.
    fn get(&self, id: SessionId) -> Option<(SessionId, Option<String>)> {
        self.lock().owners.get(&id).map(|o| (o.by, o.key.clone()))
    }

    /// Pane `id` has ended: it owns nothing and is owned by no one, and its key is free.
    pub fn forget(&self, id: SessionId) {
        self.lock()
            .owners
            .retain(|pane, o| *pane != id && o.by != id);
    }
}

/// One window's sessions as its frontend last reported them.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct PaneOrder {
    /// By tab in strip order, each tab's visible panes in grid order followed by its minimized ones.
    tabs: Vec<Vec<SessionId>>,
    /// The window's minimized panes.
    minimized: Vec<SessionId>,
}

/// Each window's [`PaneOrder`], by window label.
#[derive(Default)]
pub struct PaneOrders(Mutex<HashMap<String, PaneOrder>>);

impl PaneOrders {
    fn get(&self, label: &str) -> PaneOrder {
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

/// The window's sessions in `tiili list` order: tab by tab in strip order, in grid order inside each tab.
fn list_order(tabs: &[Vec<SessionId>]) -> Vec<SessionId> {
    tabs.concat()
}

/// The tab, counting from 1, `id` is in among `tabs`.
fn tab_of(tabs: &[Vec<SessionId>], id: SessionId) -> Option<u32> {
    tabs.iter()
        .position(|tab| tab.contains(&id))
        .and_then(|i| u32::try_from(i + 1).ok())
}

/// The window reports its panes' sessions, tab by tab in grid order with each tab's minimized panes last, and which
/// are minimized, whenever its grid, its minimized panes or a pane's session changes.
#[tauri::command]
pub fn pane_order_set(
    window: WebviewWindow,
    orders: State<'_, PaneOrders>,
    tabs: Vec<Vec<SessionId>>,
    minimized: Option<Vec<SessionId>>,
) {
    if let Ok(mut map) = orders.0.lock() {
        map.insert(
            window.label().to_string(),
            PaneOrder {
                tabs,
                minimized: minimized.unwrap_or_default(),
            },
        );
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

/// The window answers a `pane-close-request`: the pane has closed, else `error` says why it could not.
#[tauri::command]
pub fn pane_close_done(pending: State<'_, PendingOpens>, request_id: u64, error: Option<String>) {
    // A close answers with no pane; the id is not read.
    pending.finish(request_id, error.map_or(Ok(0), Err));
}

/// The window answers a `pane-minimize-request`: the pane is minimized or back, else `error` says why it is not.
#[tauri::command]
pub fn pane_minimize_done(
    pending: State<'_, PendingOpens>,
    request_id: u64,
    error: Option<String>,
) {
    // Like a close, a minimize answers with no pane.
    pending.finish(request_id, error.map_or(Ok(0), Err));
}

/// The error a minimize or restore of pane `id` gives when its window answers `error`.
fn minimize_error(id: SessionId, error: String) -> CliError {
    if error == LAST_VISIBLE_PANE {
        CliError::LastVisiblePane(format!("pane {id} is the only pane showing in its tab"))
    } else {
        CliError::MinimizeFailed(error)
    }
}

struct AppHandler(AppHandle);

impl AppHandler {
    fn window_of(&self, caller: SessionId) -> Result<String, String> {
        self.0
            .state::<WindowSessions>()
            .owner(caller)
            .ok_or_else(|| format!("pane {caller} is not open in tiili"))
    }

    /// Whether session `id` is still open in a window.
    fn live(&self, id: SessionId) -> bool {
        self.0.state::<WindowSessions>().owner(id).is_some()
    }
}

impl Handler for AppHandler {
    fn open(&self, caller: SessionId, request: OpenRequest) -> Result<(SessionId, bool), String> {
        let OpenRequest {
            cwd,
            title,
            command,
            path,
            key,
            minimized,
        } = request;
        let label = self.window_of(caller)?;
        let opened = self.0.state::<PaneOwners>().open(
            caller,
            key,
            |id| self.live(id),
            || {
                self.0.state::<PendingOpens>().ask(
                    &self.0,
                    &label,
                    PANE_OPEN_REQUEST_EVENT,
                    |request_id| PaneOpenRequest {
                        request_id,
                        caller,
                        cwd,
                        title: title.clone(),
                        command: command.clone(),
                        path,
                        minimized,
                    },
                )
            },
        )?;
        if let (id, false) = opened {
            // A pane that has already ended is not remembered.
            if self.live(id) {
                self.0.state::<PaneOpens>().set(
                    id,
                    PaneOpen {
                        title,
                        argv: command,
                    },
                );
            }
        }
        Ok(opened)
    }

    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
        let label = self.window_of(caller)?;
        Ok(self.window_panes(&label, Some(caller)))
    }

    fn panes(&self) -> Result<Vec<PaneInfo>, String> {
        let windows = self.0.state::<WindowSessions>().labels();
        Ok(windows
            .iter()
            .flat_map(|label| self.window_panes(label, None))
            .collect())
    }

    fn attention(
        &self,
        caller: SessionId,
        message: Option<String>,
        clear: bool,
    ) -> Result<(), String> {
        let label = self.window_of(caller)?;
        // Only ever the caller's own pane; the window applies the escape-code signal rules.
        self.0
            .emit_to(
                label.as_str(),
                PANE_ATTENTION_REQUEST_EVENT,
                PaneAttentionRequest {
                    session: caller,
                    message,
                    clear,
                },
            )
            .map_err(|e| format!("could not reach the window: {e}"))
    }

    fn close(&self, caller: SessionId, target: SessionId) -> Result<(), CliError> {
        self.0
            .state::<PaneOwners>()
            .check_close(caller, target, |id| self.live(id))?;
        let label = self.window_of(target).map_err(CliError::NoSuchPane)?;
        self.0
            .state::<PendingOpens>()
            .ask(&self.0, &label, PANE_CLOSE_REQUEST_EVENT, |request_id| {
                PaneCloseRequest {
                    request_id,
                    session: target,
                }
            })
            .map(|_| ())
            .map_err(CliError::CloseFailed)
    }

    fn minimize(
        &self,
        caller: SessionId,
        target: Option<SessionId>,
        minimize: bool,
    ) -> Result<(), CliError> {
        let target = self
            .0
            .state::<PaneOwners>()
            .check_minimize(caller, target, |id| self.live(id))?;
        let label = self.window_of(target).map_err(CliError::NoSuchPane)?;
        self.0
            .state::<PendingOpens>()
            .ask(&self.0, &label, PANE_MINIMIZE_REQUEST_EVENT, |request_id| {
                PaneMinimizeRequest {
                    request_id,
                    session: target,
                    minimize,
                }
            })
            .map(|_| ())
            .map_err(|e| minimize_error(target, e))
    }
}

impl AppHandler {
    /// Window `label`'s panes as `tiili list` reports them, in its order; `caller` is the pane asking, `None` for
    /// the token-free `panes` request.
    fn window_panes(&self, label: &str, caller: Option<SessionId>) -> Vec<PaneInfo> {
        let (reports, opens, registry, owners) = (
            self.0.state::<SessionReports>(),
            self.0.state::<PaneOpens>(),
            self.0.state::<SessionRegistry>(),
            self.0.state::<PaneOwners>(),
        );
        let marks = self.0.state::<Attention>().marks();
        let PaneOrder { tabs, minimized } = self.0.state::<PaneOrders>().get(label);
        let grid = list_order(&tabs);
        grid_order(self.0.state::<WindowSessions>().sessions(label), &grid)
            .into_iter()
            .map(|id| {
                let (at, _) = reports.latest(id);
                pane_record(PaneFacts {
                    id,
                    caller,
                    window: label,
                    at: at.as_ref(),
                    open: opens.get(id).as_ref(),
                    running: registry.running(id).unwrap_or_default(),
                    mark: marks.iter().find(|m| m.session == id),
                    tab: tab_of(&tabs, id),
                    owner: owners.get(id),
                    minimized: minimized.contains(&id),
                })
            })
            .collect()
    }
}

/// What the app knows about one pane of a `tiili list`.
struct PaneFacts<'a> {
    id: SessionId,
    /// The pane the request came from; `None` for the token-free `panes` request.
    caller: Option<SessionId>,
    window: &'a str,
    /// The pane's latest folder report, until the first arrives `None`.
    at: Option<&'a PaneCwdEvent>,
    open: Option<&'a PaneOpen>,
    running: Running,
    mark: Option<&'a MarkInfo>,
    /// The tab the pane is in, counting from 1.
    tab: Option<u32>,
    /// The pane that opened it with `tiili open`, and the key it gave.
    owner: Option<(SessionId, Option<String>)>,
    /// Whether its window reports it minimized.
    minimized: bool,
}

/// One pane as `tiili list` reports it. A pane `tiili open` started runs its command line, quoted, while its shell
/// (when it has one) reports none; at the prompt nothing runs.
fn pane_record(facts: PaneFacts) -> PaneInfo {
    let PaneFacts {
        id,
        caller,
        window,
        at,
        open,
        running,
        mark,
        tab,
        owner,
        minimized,
    } = facts;
    let command = running.command.or_else(|| {
        open.filter(|o| !o.argv.is_empty())
            .map(|o| shell_join(&o.argv))
    });
    let running = (command.is_some() || running.program.is_some()).then_some(RunningRecord {
        command,
        program: running.program,
    });
    PaneInfo {
        id,
        is_self: caller == Some(id),
        window: window.to_string(),
        cwd: at.map(|a| a.cwd.clone()).unwrap_or_default(),
        host: at.and_then(|a| a.host.clone()),
        repo: at.and_then(|a| a.repo.as_ref()).map(|r| RepoRecord {
            root: r.root.clone(),
            name: r.name.clone(),
            worktree: r.worktree.clone(),
        }),
        title: open.and_then(|o| o.title.clone()),
        label: at
            .map(|a| {
                place_name(
                    &a.cwd,
                    a.repo
                        .as_ref()
                        .map(|r| (r.name.as_str(), r.worktree.as_deref())),
                    a.host.as_deref(),
                )
            })
            .unwrap_or_default(),
        running,
        attention: mark.map(|m| AttentionRecord {
            message: m.message.clone(),
        }),
        tab,
        opened_by_you: owner.as_ref().is_some_and(|(by, _)| caller == Some(*by)),
        // A key is the opener's own handle on its pane: only a token holder sees it.
        key: owner.filter(|_| caller.is_some()).and_then(|(_, key)| key),
        minimized,
    }
}

/// `argv` as one shell command line: each word as it is when the shell would read it back unchanged, else in single
/// quotes.
fn shell_join(argv: &[String]) -> String {
    let plain = |c: char| c.is_ascii_alphanumeric() || "_@%+=:,./-".contains(c);
    argv.iter()
        .map(|word| {
            if !word.is_empty() && word.chars().all(plain) {
                word.clone()
            } else {
                format!("'{}'", word.replace('\'', "'\\''"))
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// What `tiili` in the app's `bin` folder runs: the running binary `exe`, or, in an AppImage, the AppImage file the
/// runtime names in `appimage` (its `APPIMAGE`). The binary of an AppImage lives in a temporary mount that goes when
/// the app exits, and the file stays where the user put it, so a link to it keeps working, across updates too.
fn cli_target(exe: PathBuf, appimage: Option<std::ffi::OsString>) -> PathBuf {
    match appimage.map(PathBuf::from) {
        Some(file) if file.is_absolute() => file,
        _ => exe,
    }
}

/// Puts `tiili` in `bin`: a link to `exe` on macOS and Linux. On Windows a hard link to (or, across volumes, a copy
/// of) the console program `tiili-cli.exe` next to `exe`, named `tiili.exe`: `exe` is a GUI program there, which
/// shells neither wait for nor take an exit code from, and no batch file sits between, so cmd.exe never re-parses
/// the arguments. An existing one is replaced, so it follows the app when it moves or updates.
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
        let source = exe.with_file_name("tiili-cli.exe");
        let target = bin.join("tiili.exe");
        if let (Ok(have), Ok(want)) = (std::fs::metadata(&target), std::fs::metadata(&source)) {
            if have.len() == want.len() && have.modified().ok() == want.modified().ok() {
                let _ = std::fs::remove_file(bin.join("tiili.cmd"));
                return Ok(());
            }
        }
        let fresh = bin.join(format!(".tiili-{}.exe", std::process::id()));
        let _ = std::fs::remove_file(&fresh);
        if std::fs::hard_link(&source, &fresh).is_err() {
            std::fs::copy(&source, &fresh)?;
        }
        if let Err(e) = std::fs::rename(&fresh, &target) {
            let _ = std::fs::remove_file(&fresh);
            return Err(e);
        }
        // A `tiili.cmd` from an earlier version, whose arguments cmd.exe re-parsed.
        let _ = std::fs::remove_file(bin.join("tiili.cmd"));
        Ok(())
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
            let exe = cli_target(exe, std::env::var_os("APPIMAGE"));
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

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicUsize;

    use super::*;
    use crate::RepoInfo;

    #[test]
    fn cli_links_the_appimage_file_not_its_mount() {
        let mounted = PathBuf::from("/tmp/.mount_tiiliX1/usr/bin/tiili");
        let cases = [
            (
                Some("/home/u/Applications/tiili.AppImage"),
                "/home/u/Applications/tiili.AppImage",
            ),
            (None, "/tmp/.mount_tiiliX1/usr/bin/tiili"),
            (Some(""), "/tmp/.mount_tiiliX1/usr/bin/tiili"),
            (Some("tiili.AppImage"), "/tmp/.mount_tiiliX1/usr/bin/tiili"),
        ];
        for (appimage, want) in cases {
            let got = cli_target(mounted.clone(), appimage.map(std::ffi::OsString::from));
            assert_eq!(got, PathBuf::from(want), "APPIMAGE={appimage:?}");
        }
    }

    /// One thing done to the owners table, and what it should answer.
    enum Step {
        /// `caller` opens with `key`; a fresh open makes pane `gives`. Expect the pane and whether it was reused.
        Open {
            caller: SessionId,
            key: Option<&'static str>,
            gives: SessionId,
            expect: (SessionId, bool),
        },
        /// Two opens by `caller` with `key` at once, while the first is still opening pane `gives`.
        Race {
            caller: SessionId,
            key: &'static str,
            gives: SessionId,
        },
        /// Pane `0`'s command exits; tiili forgets it.
        Die(SessionId),
        /// `caller` closes `target`; expect `Ok` or the error code.
        Close {
            caller: SessionId,
            target: SessionId,
            expect: Result<(), &'static str>,
        },
        /// `caller` minimizes or restores `target`, itself when `None`; expect the pane or the error code.
        Minimize {
            caller: SessionId,
            target: Option<SessionId>,
            expect: Result<SessionId, &'static str>,
        },
    }
    use Step::*;

    fn run(steps: &[Step]) {
        let owners = PaneOwners::default();
        let live = Mutex::new(HashSet::from([1, 2]));
        let is_live = |id: SessionId| live.lock().unwrap().contains(&id);
        let opens = AtomicUsize::new(0);
        let make = |gives: SessionId, slow: bool| {
            if slow {
                std::thread::sleep(Duration::from_millis(100));
            }
            opens.fetch_add(1, Ordering::SeqCst);
            live.lock().unwrap().insert(gives);
            Ok(gives)
        };
        for (i, step) in steps.iter().enumerate() {
            match step {
                Open {
                    caller,
                    key,
                    gives,
                    expect,
                } => {
                    let got = owners.open(*caller, key.map(String::from), is_live, || {
                        make(*gives, false)
                    });
                    assert_eq!(got, Ok(*expect), "step {i}");
                }
                Race { caller, key, gives } => {
                    let before = opens.load(Ordering::SeqCst);
                    let (a, b) = std::thread::scope(|s| {
                        let first = s.spawn(|| {
                            owners.open(*caller, Some(key.to_string()), is_live, || {
                                make(*gives, true)
                            })
                        });
                        std::thread::sleep(Duration::from_millis(20));
                        let second = s.spawn(|| {
                            owners.open(*caller, Some(key.to_string()), is_live, || {
                                make(gives + 100, false)
                            })
                        });
                        (first.join().unwrap(), second.join().unwrap())
                    });
                    assert_eq!(a, Ok((*gives, false)), "step {i}");
                    assert_eq!(b, Ok((*gives, true)), "step {i}");
                    assert_eq!(opens.load(Ordering::SeqCst), before + 1, "step {i}");
                }
                Die(id) => {
                    live.lock().unwrap().remove(id);
                    owners.forget(*id);
                }
                Close {
                    caller,
                    target,
                    expect,
                } => {
                    let got = owners
                        .check_close(*caller, *target, is_live)
                        .map_err(|e| e.code());
                    assert_eq!(got, *expect, "step {i}");
                }
                Minimize {
                    caller,
                    target,
                    expect,
                } => {
                    let got = owners
                        .check_minimize(*caller, *target, is_live)
                        .map_err(|e| e.code());
                    assert_eq!(got, *expect, "step {i}");
                }
            }
        }
    }

    /// Owner recorded, Second call reuses, Concurrent calls, Dead key reopens, Keys are per owner, Close own pane,
    /// Refuse another pane, Minimize own pane, Minimize an opened pane, Refuse to minimize another pane: what each
    /// open, close, minimize and restore answers, in order.
    #[test]
    fn ownership_and_keys_decide_reuse_and_close() {
        let cases: &[(&str, &[Step])] = &[
            (
                "Owner recorded: an unkeyed open is the caller's and is never reused",
                &[
                    Open { caller: 1, key: None, gives: 10, expect: (10, false) },
                    Open { caller: 1, key: None, gives: 11, expect: (11, false) },
                    Close { caller: 1, target: 10, expect: Ok(()) },
                ],
            ),
            (
                "Second call reuses: the same key gives back the live pane",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Open { caller: 1, key: Some("dev"), gives: 11, expect: (10, true) },
                    Open { caller: 1, key: Some("test"), gives: 12, expect: (12, false) },
                ],
            ),
            (
                "Concurrent calls: the second waits for the first and reuses its pane",
                &[
                    Race { caller: 1, key: "dev", gives: 10 },
                    Open { caller: 1, key: Some("dev"), gives: 11, expect: (10, true) },
                ],
            ),
            (
                "Dead key reopens: once the keyed pane has ended a fresh one opens",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Die(10),
                    Open { caller: 1, key: Some("dev"), gives: 11, expect: (11, false) },
                    Open { caller: 1, key: Some("dev"), gives: 12, expect: (11, true) },
                ],
            ),
            (
                "Keys are per owner: another pane's key of the same name opens its own pane",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Open { caller: 2, key: Some("dev"), gives: 11, expect: (11, false) },
                    Open { caller: 2, key: Some("dev"), gives: 12, expect: (11, true) },
                ],
            ),
            (
                "Refuse another pane: a pane opened by someone else, by hand, or gone is not closed",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Close { caller: 2, target: 10, expect: Err("not_opened_by_you") },
                    Close { caller: 1, target: 2, expect: Err("not_opened_by_you") },
                    Close { caller: 1, target: 77, expect: Err("no_such_pane") },
                    Close { caller: 1, target: 10, expect: Ok(()) },
                    Die(10),
                    Close { caller: 1, target: 10, expect: Err("no_such_pane") },
                ],
            ),
            (
                "Minimize own pane: no target is the caller itself, while it lives",
                &[
                    Minimize { caller: 1, target: None, expect: Ok(1) },
                    Die(1),
                    Minimize { caller: 1, target: None, expect: Err("no_such_pane") },
                ],
            ),
            (
                "Minimize an opened pane: a pane the caller opened minimizes and restores by id",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Minimize { caller: 1, target: Some(10), expect: Ok(10) },
                    Minimize { caller: 1, target: Some(10), expect: Ok(10) },
                ],
            ),
            (
                "Refuse to minimize another pane: one opened by someone else, by hand, or gone is left alone",
                &[
                    Open { caller: 1, key: None, gives: 10, expect: (10, false) },
                    Minimize { caller: 2, target: Some(10), expect: Err("not_opened_by_you") },
                    Minimize { caller: 1, target: Some(2), expect: Err("not_opened_by_you") },
                    Minimize { caller: 1, target: Some(77), expect: Err("no_such_pane") },
                    Die(10),
                    Minimize { caller: 1, target: Some(10), expect: Err("no_such_pane") },
                ],
            ),
            (
                "An owner that ends gives its panes up",
                &[
                    Open { caller: 1, key: Some("dev"), gives: 10, expect: (10, false) },
                    Die(1),
                    Close { caller: 1, target: 10, expect: Err("not_opened_by_you") },
                ],
            ),
        ];
        for (name, steps) in cases {
            eprintln!("{name}");
            run(steps);
        }
    }

    /// List across tabs: tab 1's panes come first in grid order, then tab 2's; an empty tab adds nothing.
    #[test]
    fn list_across_tabs_lists_tab_by_tab() {
        let cases: &[(&[Vec<SessionId>], &[SessionId])] = &[
            (&[vec![1, 2], vec![3]], &[1, 2, 3]),
            (&[vec![], vec![3, 4]], &[3, 4]),
        ];
        for (tabs, expected) in cases {
            assert_eq!(list_order(tabs), *expected, "{tabs:?}");
        }
    }

    /// Own and opened panes: the tab a pane is in counts from 1.
    #[test]
    fn own_and_opened_panes_have_their_tab() {
        let tabs = vec![vec![1, 2], vec![3]];
        for (id, tab) in [(1, Some(1)), (2, Some(1)), (3, Some(2)), (4, None)] {
            assert_eq!(tab_of(&tabs, id), tab, "{id}");
        }
    }

    /// Own and opened panes: a pane the caller opened has opened_by_you true, one another pane opened does not,
    /// each shows the key it was opened with, and every pane has its tab.
    #[test]
    fn own_and_opened_panes_are_marked_in_the_list() {
        // The pane's owner and key, and the opened_by_you and key expected for caller 3.
        type Case<'a> = (Option<(SessionId, Option<&'a str>)>, bool, Option<&'a str>);
        let cases: &[Case] = &[
            (None, false, None),
            (Some((3, Some("dev"))), true, Some("dev")),
            (Some((3, None)), true, None),
            (Some((4, Some("dev"))), false, Some("dev")),
        ];
        for (owner, mine, key) in cases {
            let record = pane_record(PaneFacts {
                id: 8,
                caller: Some(3),
                window: "main",
                at: None,
                open: None,
                running: Running::default(),
                mark: None,
                tab: Some(2),
                owner: owner.map(|(by, key)| (by, key.map(Into::into))),
                minimized: false,
            });
            assert_eq!(record.opened_by_you, *mine, "{owner:?}");
            assert_eq!(record.key.as_deref(), *key, "{owner:?}");
            assert_eq!(record.tab, Some(2), "{owner:?}");
        }
    }

    /// The token-free `panes` request has no caller: no pane is its own or opened by it, and no key shows; Minimized
    /// pane listed: a pane its window reports minimized is marked so.
    #[test]
    fn panes_without_a_caller_show_no_keys() {
        let record = pane_record(PaneFacts {
            id: 8,
            caller: None,
            window: "main",
            at: None,
            open: None,
            running: Running::default(),
            mark: None,
            tab: Some(1),
            owner: Some((3, Some("dev".into()))),
            minimized: true,
        });
        assert!(!record.is_self && !record.opened_by_you);
        assert_eq!(record.key, None);
        assert_eq!((record.window.as_str(), record.tab), ("main", Some(1)));
        assert!(record.minimized);
    }

    fn at(cwd: &str, repo: Option<(&str, Option<&str>)>, host: Option<&str>) -> PaneCwdEvent {
        PaneCwdEvent {
            pane_id: 0,
            cwd: cwd.into(),
            repo: repo.map(|(name, worktree)| RepoInfo {
                root: cwd.into(),
                name: name.into(),
                worktree: worktree.map(Into::into),
            }),
            host: host.map(Into::into),
            tint: None,
        }
    }

    fn opened(title: Option<&str>, argv: &[&str]) -> PaneOpen {
        PaneOpen {
            title: title.map(Into::into),
            argv: argv.iter().map(|a| a.to_string()).collect(),
        }
    }

    fn running(command: Option<&str>, program: Option<&str>) -> Running {
        Running {
            command: command.map(Into::into),
            program: program.map(Into::into),
        }
    }

    fn ran(command: Option<&str>, program: Option<&str>) -> Option<RunningRecord> {
        Some(RunningRecord {
            command: command.map(Into::into),
            program: program.map(Into::into),
        })
    }

    /// Own pane and a dev server, Pane at a prompt: each pane's record from what the app knows about it.
    #[test]
    fn pane_records_follow_reports_opens_running_and_marks() {
        let app = at("/w/app", Some(("app", None)), None);
        let fix = at("/w/app-fix", Some(("app", Some("fix"))), Some("box"));
        let base = PaneInfo {
            id: 3,
            is_self: true,
            window: "main".into(),
            cwd: "/w/app".into(),
            repo: Some(RepoRecord {
                root: "/w/app".into(),
                name: "app".into(),
                worktree: None,
            }),
            label: "app".into(),
            ..PaneInfo::default()
        };
        let marked = MarkInfo {
            session: 3,
            message: Some("Build done".into()),
        };
        let bare_mark = MarkInfo {
            session: 3,
            message: None,
        };
        // Name, the caller, the report, the open, what runs, the mark, and the record expected.
        type Case<'a> = (
            &'a str,
            SessionId,
            Option<&'a PaneCwdEvent>,
            Option<PaneOpen>,
            Running,
            Option<&'a MarkInfo>,
            PaneInfo,
        );
        let cases: Vec<Case> = vec![
            (
                "at the prompt",
                3,
                Some(&app),
                None,
                running(None, None),
                None,
                base.clone(),
            ),
            (
                "shell command, another pane's",
                1,
                Some(&app),
                None,
                running(Some("npm run dev"), Some("node")),
                None,
                PaneInfo {
                    is_self: false,
                    running: ran(Some("npm run dev"), Some("node")),
                    ..base.clone()
                },
            ),
            (
                "opened argv joined with quoting",
                3,
                Some(&app),
                Some(opened(None, &["sh", "-c", "echo 'hi' $X", "", "a.txt"])),
                running(None, None),
                None,
                PaneInfo {
                    running: ran(Some(r#"sh -c 'echo '\''hi'\'' $X' '' a.txt"#), None),
                    ..base.clone()
                },
            ),
            (
                "title override, the shell's command wins",
                3,
                Some(&app),
                Some(opened(Some("logs"), &["tail", "-f", "x.log"])),
                running(Some("less x.log"), None),
                None,
                PaneInfo {
                    title: Some("logs".into()),
                    running: ran(Some("less x.log"), None),
                    ..base.clone()
                },
            ),
            (
                "attention mark with a message",
                3,
                Some(&app),
                None,
                running(None, None),
                Some(&marked),
                PaneInfo {
                    attention: Some(AttentionRecord {
                        message: Some("Build done".into()),
                    }),
                    ..base.clone()
                },
            ),
            (
                "attention mark without a message, remote worktree",
                3,
                Some(&fix),
                None,
                running(None, None),
                Some(&bare_mark),
                PaneInfo {
                    cwd: "/w/app-fix".into(),
                    host: Some("box".into()),
                    repo: Some(RepoRecord {
                        root: "/w/app-fix".into(),
                        name: "app".into(),
                        worktree: Some("fix".into()),
                    }),
                    label: "box:app › fix".into(),
                    attention: Some(AttentionRecord { message: None }),
                    ..base.clone()
                },
            ),
            (
                "no report yet",
                3,
                None,
                Some(opened(None, &["top"])),
                running(None, None),
                None,
                PaneInfo {
                    cwd: String::new(),
                    repo: None,
                    label: String::new(),
                    running: ran(Some("top"), None),
                    ..base.clone()
                },
            ),
        ];
        for (name, caller, at, open, running, mark, expected) in cases {
            let record = pane_record(PaneFacts {
                id: 3,
                caller: Some(caller),
                window: "main",
                at,
                open: open.as_ref(),
                running,
                mark,
                tab: None,
                owner: None,
                minimized: false,
            });
            assert_eq!(record, expected, "{name}");
        }
    }
}
