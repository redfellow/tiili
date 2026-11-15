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

use crate::attention::{Attention, MarkInfo};
use crate::command::Running;
use crate::control::{
    grid_order, place_name, AttentionRecord, PaneInfo, RepoRecord, RunningRecord,
};
use crate::control_server::{ControlServer, Handler};
use crate::pty::{ControlEnv, SessionId, SessionRegistry};
use crate::windows::WindowSessions;
use crate::{PaneCwdEvent, SessionReports};

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
    /// The pane `tiili open` ran in: the new pane joins its tab.
    caller: SessionId,
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
            caller,
            cwd,
            title: title.clone(),
            command: command.clone(),
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
        if let Ok(id) = &result {
            // A pane that has already ended is not remembered.
            if self.0.state::<WindowSessions>().owner(*id).is_some() {
                self.0.state::<PaneOpens>().set(
                    *id,
                    PaneOpen {
                        title,
                        argv: command,
                    },
                );
            }
        }
        result
    }

    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String> {
        let label = self.window_of(caller)?;
        let (reports, opens, registry) = (
            self.0.state::<SessionReports>(),
            self.0.state::<PaneOpens>(),
            self.0.state::<SessionRegistry>(),
        );
        let marks = self.0.state::<Attention>().marks();
        let grid = self.0.state::<PaneOrders>().get(&label);
        Ok(
            grid_order(self.0.state::<WindowSessions>().sessions(&label), &grid)
                .into_iter()
                .map(|id| {
                    let (at, _) = reports.latest(id);
                    pane_record(PaneFacts {
                        id,
                        caller,
                        window: &label,
                        at: at.as_ref(),
                        open: opens.get(id).as_ref(),
                        running: registry.running(id).unwrap_or_default(),
                        mark: marks.iter().find(|m| m.session == id),
                    })
                })
                .collect(),
        )
    }
}

/// What the app knows about one pane of a `tiili list`.
struct PaneFacts<'a> {
    id: SessionId,
    /// The pane the request came from.
    caller: SessionId,
    window: &'a str,
    /// The pane's latest folder report, until the first arrives `None`.
    at: Option<&'a PaneCwdEvent>,
    open: Option<&'a PaneOpen>,
    running: Running,
    mark: Option<&'a MarkInfo>,
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
        is_self: id == caller,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::RepoInfo;

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
                caller,
                window: "main",
                at,
                open: open.as_ref(),
                running,
                mark,
            });
            assert_eq!(record, expected, "{name}");
        }
    }
}
