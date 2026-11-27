pub mod app_icon;
pub mod appimage_env;
pub mod attention;
pub mod bridge;
pub mod claude_hook;
pub mod claude_skill;
pub mod cli;
pub mod command;
pub mod control;
mod control_app;
pub mod control_server;
pub mod cwd;
#[cfg(target_os = "macos")]
mod dock_menu;
pub mod follow;
pub mod integrations;
pub mod intents;
#[cfg(windows)]
mod jump_list;
pub mod launch;
pub mod links;
pub mod notes;
pub mod pty;
pub mod repo;
pub mod session;
mod session_app;
pub mod settings;
pub mod shell_integration;
pub mod shells;
pub mod sink;
pub mod tints;
pub mod updates;
pub mod window_state;
pub mod windows;
pub mod working;

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use pty::{PaneCommand, SessionId, SessionRegistry};
use sink::{FlowGate, FlowGates, SessionSinks};
use tints::Tints;
use windows::WindowSessions;

/// Event sent when a shell exits; its payload names the session.
pub const PTY_EXIT_EVENT: &str = "pty-exit";
/// Event sent when an Edit menu item is chosen; its payload is `copy`, `paste`, `selectAll`, `find`, `findNext` or
/// `findPrevious`.
pub const CLIPBOARD_EVENT: &str = "clipboard";
/// Event sent when a pane menu item is chosen; its payload is `new`, `close`, `moveToNewWindow` or `zen`.
pub const PANE_EVENT: &str = "pane";
/// Event sent when the app menu's Settings… item is chosen.
pub const OPEN_SETTINGS_EVENT: &str = "open-settings";
/// Event sent when a shell's working directory or repository changes; its payload is a [`PaneCwdEvent`].
pub const PANE_CWD_EVENT: &str = "pane-cwd";
/// Event sent when what runs in a pane changes; its payload is a [`PaneCommandEvent`].
pub const PANE_COMMAND_EVENT: &str = "pane-command";
/// Event sent to the focused window when the Shell menu's Move to Window ▸ item is chosen; its payload is the
/// label of the window to move the focused pane to.
pub const MOVE_TO_WINDOW_EVENT: &str = "move-to-window";
/// Menu item ids of Move to Window ▸ entries start with this, followed by the target window's label.
const MOVE_TO_WINDOW_ID: &str = "move-to-window:";

#[derive(Clone, Serialize)]
struct PtyExit {
    id: SessionId,
    code: u32,
}

/// A repository as the frontend sees it: root folder, name and, in a linked worktree, its branch or worktree name.
#[derive(Clone, Serialize)]
struct RepoInfo {
    root: String,
    name: String,
    worktree: Option<String>,
}

/// Where session `pane_id`'s shell is now, its repository (`None` outside any) and its host (`None` when local).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneCwdEvent {
    pane_id: SessionId,
    cwd: String,
    repo: Option<RepoInfo>,
    /// The host a remote pane is on; `None` for this machine.
    host: Option<String>,
    /// The pane's project tint, the same in every window; `None` outside a repository.
    tint: Option<u8>,
}

/// What session `pane_id`'s pane runs now: the title its foreground program set, else the
/// foreground process's name, else the shell's name.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PaneCommandEvent {
    pane_id: SessionId,
    command: String,
}

impl PaneCwdEvent {
    fn new(pane_id: SessionId, at: &cwd::PaneCwd, tints: &Tints) -> Self {
        let repo_key = at.repo.as_ref().map(|r| r.key.to_string_lossy());
        let key = tints::tint_key(repo_key.as_deref(), at.host.as_deref());
        Self {
            tint: tints.tint_for(pane_id, key.as_deref()),
            pane_id,
            cwd: at.cwd.to_string_lossy().into_owned(),
            repo: at.repo.as_ref().map(|r| RepoInfo {
                root: r.root.to_string_lossy().into_owned(),
                name: r.name.clone(),
                worktree: r.worktree.clone(),
            }),
            host: at.host.clone(),
        }
    }
}

fn text(err: std::io::Error) -> String {
    err.to_string()
}

/// Each session's latest `pane-cwd` and `pane-command` reports, sent again to the window a pane moves to.
#[derive(Default)]
struct SessionReports(Mutex<HashMap<SessionId, Reports>>);

/// A session's latest `pane-cwd` and `pane-command` reports, either missing until the first arrives.
type Reports = (Option<PaneCwdEvent>, Option<PaneCommandEvent>);

impl SessionReports {
    fn cwd(&self, event: &PaneCwdEvent) {
        if let Ok(mut map) = self.0.lock() {
            map.entry(event.pane_id).or_default().0 = Some(event.clone());
        }
    }

    fn command(&self, event: &PaneCommandEvent) {
        if let Ok(mut map) = self.0.lock() {
            map.entry(event.pane_id).or_default().1 = Some(event.clone());
        }
    }

    fn latest(&self, id: SessionId) -> Reports {
        self.0
            .lock()
            .ok()
            .and_then(|map| map.get(&id).cloned())
            .unwrap_or_default()
    }

    fn forget(&self, id: SessionId) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(&id);
        }
    }
}

/// Session `id`'s latest reported folder and the host it is on (`None` when local), once a report has arrived.
pub(crate) fn pane_place(app: &AppHandle, id: SessionId) -> Option<(String, Option<String>)> {
    let (cwd, _) = app.state::<SessionReports>().latest(id);
    cwd.map(|event| (event.cwd, event.host))
}

/// The window session `id`'s events go to: the one it belongs to now, or `spawner` (the window that started it)
/// before it is registered.
fn owner_of(app: &AppHandle, id: SessionId, spawner: &str) -> String {
    app.state::<WindowSessions>()
        .owner(id)
        .unwrap_or_else(|| spawner.to_string())
}

/// Session `id`'s pane has closed: it leaves its window, and all [`session_exited`] clears goes with it.
fn forget_session(app: &AppHandle, id: SessionId) {
    app.state::<WindowSessions>().remove(id);
    forget_process(app, id);
}

/// Session `id`'s process exited. Its pane may stay (a minimized pane showing its exit), so the session stays in
/// its window, no longer live, for that pane's attention mark to lead there; `pty_close` takes it out.
fn session_exited(app: &AppHandle, id: SessionId) {
    app.state::<WindowSessions>().exit(id);
    forget_process(app, id);
}

/// What ends with session `id`'s process: the tint counts, its sink, its flow gate (releasing its reader), its
/// reports, its `tiili open` records, its attention mark and its working icon.
fn forget_process(app: &AppHandle, id: SessionId) {
    app.state::<Tints>().forget(id);
    app.state::<SessionSinks>().remove(id);
    app.state::<FlowGates>().remove(id);
    app.state::<SessionReports>().forget(id);
    app.state::<control_app::PaneOpens>().forget(id);
    app.state::<control_app::PaneOwners>().forget(id);
    attention::forget(app, id);
    app_icon::forget(app, id);
}

/// Tells the working app icon whether session `id` is at its shell (see [`working::at_shell`]); before the session
/// is registered, it is.
fn report_foreground(app: &AppHandle, id: SessionId) {
    let at_shell = app
        .state::<SessionRegistry>()
        .running(id)
        .map_or(true, |running| working::at_shell(&running, cfg!(unix)));
    app_icon::foreground(app, id, at_shell);
}

/// Starts a new shell in `cwd` (home folder when absent or unreadable): `shell`, the shell chosen in Settings, or the
/// system default when it is absent, empty or cannot be run (see [`shells::resolve`]), with the prompt chosen
/// in Settings (`off` when absent), or `command` directly when given (looked up on and run with `path`, the `PATH` of
/// the `tiili open` that asked for it, when given), and returns its session id. A shell started with `history` has that
/// line as the newest entry of its history. Its output streams over `on_output`, a channel of its own, and its working
/// directory as `pane-cwd` events and what runs in it as `pane-command` events, sent only to the window it belongs to:
/// the one that started it, until its pane moves.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    window: WebviewWindow,
    sessions: State<'_, SessionRegistry>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    prompt: Option<String>,
    command: Option<Vec<String>>,
    path: Option<String>,
    history: Option<String>,
    shell: Option<String>,
    on_output: Channel<Vec<u8>>,
) -> Result<SessionId, String> {
    let command = command
        .filter(|argv| !argv.is_empty())
        .map(|argv| PaneCommand {
            argv,
            path: path.map(Into::into),
        });
    let label = window.label().to_string();
    let (cwd_app, cwd_label) = (app.clone(), label.clone());
    let (command_app, command_label) = (app.clone(), label.clone());
    let output_app = app.clone();
    let exit_label = label.clone();
    let sink = SessionSinks::create(Box::new(move |data| {
        let _ = on_output.send(data.to_vec());
    }));
    let output_sink = std::sync::Arc::clone(&sink);
    let gate = FlowGate::new();
    let output_gate = std::sync::Arc::clone(&gate);
    // A shell that ends before it is registered below is forgotten before the registration, so it
    // is forgotten again after it.
    let exited = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let exit_flag = std::sync::Arc::clone(&exited);
    let id = sessions
        .spawn_restored(
            cwd.as_deref().map(Path::new),
            prompt.as_deref().unwrap_or(shell_integration::PROMPT_OFF),
            shell.as_deref().filter(|s| !s.trim().is_empty()),
            command.as_ref(),
            history.as_deref(),
            rows,
            cols,
            Box::new(move |id, data| {
                // Outside the sink lock, so pty_detach and pty_attach never wait behind a held-back reader.
                output_gate.wait();
                // Where the foreground cannot be read (Windows), what runs is known only from the command line the
                // shell reports, which titles alone would not follow: read it with each output.
                #[cfg(not(unix))]
                report_foreground(&output_app, id);
                app_icon::output(&output_app, id);
                if let Ok(mut sink) = output_sink.lock() {
                    sink.write(data);
                }
                output_gate.sent(data.len());
            }),
            Some(Box::new(move |id, at| {
                let event = PaneCwdEvent::new(id, at, &cwd_app.state::<Tints>());
                cwd_app.state::<SessionReports>().cwd(&event);
                let to = owner_of(&cwd_app, id, &cwd_label);
                let _ = cwd_app.emit_to(to.as_str(), PANE_CWD_EVENT, event);
            })),
            Some(Box::new(move |id, command| {
                // What runs changed, so who is in front may have: the pane works only away from its shell.
                report_foreground(&command_app, id);
                let event = PaneCommandEvent {
                    pane_id: id,
                    command: command.to_string(),
                };
                command_app.state::<SessionReports>().command(&event);
                let to = owner_of(&command_app, id, &command_label);
                let _ = command_app.emit_to(to.as_str(), PANE_COMMAND_EVENT, event);
            })),
            Box::new(move |id, code| {
                let to = owner_of(&app, id, &exit_label);
                exit_flag.store(true, std::sync::atomic::Ordering::SeqCst);
                session_exited(&app, id);
                let _ = app.emit_to(to.as_str(), PTY_EXIT_EVENT, PtyExit { id, code });
            }),
        )
        .map_err(|e| format!("Could not start the shell: {e}"))?;
    window.state::<SessionSinks>().add(id, sink);
    window.state::<FlowGates>().add(id, gate);
    window.state::<WindowSessions>().add(&label, id);
    if exited.load(std::sync::atomic::Ordering::SeqCst) {
        session_exited(window.app_handle(), id);
    }
    Ok(id)
}

/// What the Settings dialogue's Shell menu offers: the system default shell's program name and the shells installed
/// on this machine (see [`shells::installed`]).
#[tauri::command]
fn shells_installed() -> shells::InstalledShells {
    shells::installed_shells()
}

/// Session `id`'s pane is leaving its window: its output is kept from now until `pty_attach`. The old terminal never
/// acknowledges again, so the flow gate counts from zero: what is kept from now is acknowledged by the new window.
#[tauri::command]
fn pty_detach(
    sinks: State<'_, SessionSinks>,
    gates: State<'_, FlowGates>,
    id: SessionId,
) -> Result<(), String> {
    sinks.detach(id)?;
    if let Some(gate) = gates.get(id) {
        gate.reset();
    }
    Ok(())
}

/// Session `id`'s pane has arrived in the calling window: the session belongs to it, the output kept since
/// `pty_detach` and all after streams over `on_output`, and its latest folder and command are sent to it again so
/// the pane's chip and tint show at once.
#[tauri::command]
fn pty_attach(
    app: AppHandle,
    window: WebviewWindow,
    sinks: State<'_, SessionSinks>,
    id: SessionId,
    on_output: Channel<Vec<u8>>,
) -> Result<(), String> {
    let label = window.label().to_string();
    app.state::<WindowSessions>().reassign(id, &label);
    sinks.attach(
        id,
        Box::new(move |data| {
            let _ = on_output.send(data.to_vec());
        }),
    )?;
    let (cwd, command) = app.state::<SessionReports>().latest(id);
    if let Some(event) = cwd {
        let _ = app.emit_to(label.as_str(), PANE_CWD_EVENT, event);
    }
    if let Some(event) = command {
        let _ = app.emit_to(label.as_str(), PANE_COMMAND_EVENT, event);
    }
    Ok(())
}

#[tauri::command]
fn pty_write(
    sessions: State<'_, SessionRegistry>,
    id: SessionId,
    data: String,
) -> Result<(), String> {
    sessions.write(id, data.as_bytes()).map_err(text)
}

#[tauri::command]
fn pty_resize(
    sessions: State<'_, SessionRegistry>,
    id: SessionId,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    sessions.resize(id, rows, cols).map_err(text)
}

/// Ends session `id`, killing its shell if it still runs.
#[tauri::command]
fn pty_close(
    app: AppHandle,
    sessions: State<'_, SessionRegistry>,
    id: SessionId,
) -> Result<(), String> {
    forget_session(&app, id);
    sessions.close(id).map_err(text)
}

/// The calling window's terminal has drawn `bytes` more of session `id`'s output; a reader held back for it reads
/// on. Does nothing for an ended session.
#[tauri::command]
fn pty_ack(gates: State<'_, FlowGates>, id: SessionId, bytes: usize) {
    if let Some(gate) = gates.get(id) {
        gate.ack(bytes);
    }
}

/// The prompt choice changed (picked, saved, cancelled or saved in another window): new shells and the open local
/// zsh, bash and PowerShell shells follow it; an idle zsh redraws its prompt at once.
#[tauri::command]
fn pty_set_prompt(sessions: State<'_, SessionRegistry>, prompt: String) -> Result<(), String> {
    sessions.set_prompt(&prompt).map_err(text)
}

/// The terminal theme changed: integrated zsh and bash 5.1+ shells give pasted text `colour`, the selection's colour,
/// from their next prompt on, instead of reverse video.
#[tauri::command]
fn pty_set_highlight(colour: String) -> Result<(), String> {
    pty::set_highlight(&colour).map_err(text)
}

/// Window `label` was closed: its shells end and it no longer holds the focus.
fn window_destroyed(app: &AppHandle, label: &str) {
    app.state::<control_app::PaneOrders>().forget(label);
    let registry = app.state::<SessionRegistry>();
    for id in app.state::<WindowSessions>().take(label) {
        app.state::<Tints>().forget(id);
        app.state::<control_app::PaneOpens>().forget(id);
        app.state::<control_app::PaneOwners>().forget(id);
        attention::forget(app, id);
        app_icon::forget(app, id);
        app.state::<FlowGates>().remove(id);
        let _ = registry.close(id);
    }
    app.state::<windows::LastFocused>().forget(label);
    app.state::<windows::WindowNames>().remove(label);
    settings::window_destroyed(app, label);
    refresh_move_menu(app);
}

/// The Shell menu's Move to Window ▸ submenu, kept to be rebuilt when windows or their names change.
#[derive(Default)]
struct MoveMenu(Mutex<Option<tauri::menu::Submenu<tauri::Wry>>>);

/// Rebuilds the Shell menu's Move to Window ▸ submenu: the windows other than the focused one, named by their
/// focused pane, disabled when there are none. Does nothing where there is no such menu.
pub(crate) fn refresh_move_menu(app: &AppHandle) {
    let Some(menu) = app
        .try_state::<MoveMenu>()
        .and_then(|m| m.0.lock().ok().and_then(|m| m.clone()))
    else {
        return;
    };
    let focused = windows::focused_label(app).unwrap_or_default();
    let others = app.state::<windows::WindowNames>().others(&focused);
    let _ = (|| -> tauri::Result<()> {
        for item in menu.items()? {
            menu.remove(&item)?;
        }
        for (entry, text) in others.iter().zip(windows::numbered_names(&others)) {
            let id = format!("{MOVE_TO_WINDOW_ID}{}", entry.label);
            menu.append(&tauri::menu::MenuItem::with_id(
                app,
                id,
                text,
                true,
                None::<&str>,
            )?)?;
        }
        menu.set_enabled(!others.is_empty())
    })();
}

/// What runs in session `id`: the command line its shell reported and the foreground program's name.
#[tauri::command]
fn pty_running(
    sessions: State<'_, SessionRegistry>,
    id: SessionId,
) -> Result<command::Running, String> {
    sessions.running(id).map_err(text)
}

/// The working directory of session `id`'s shell, or `None` where it cannot be read (Windows).
#[tauri::command]
fn pty_cwd(sessions: State<'_, SessionRegistry>, id: SessionId) -> Result<Option<String>, String> {
    Ok(sessions
        .cwd(id)
        .map_err(text)?
        .map(|p| p.to_string_lossy().into_owned()))
}

/// The macOS app menu's Quit item.
#[cfg(target_os = "macos")]
const QUIT_ID: &str = "quit";

/// macOS menu bar: the app menu with Settings…, a Shell menu for panes and an Edit menu, whose items the
/// frontend carries out. The Shell menu's Move to Window ▸ submenu is kept in [`MoveMenu`].
#[cfg(target_os = "macos")]
fn macos_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

    let app_menu = SubmenuBuilder::new(app, "tiili")
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("settings", "Settings…")
                .accelerator("Cmd+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        // Not the predefined Quit, which ends the app at once: tiili first saves the session.
        .item(
            &MenuItemBuilder::with_id(QUIT_ID, "Quit tiili")
                .accelerator("Cmd+Q")
                .build(app)?,
        )
        .build()?;
    let move_menu = SubmenuBuilder::new(app, "Move to Window")
        .enabled(false)
        .build()?;
    if let Ok(mut kept) = app.state::<MoveMenu>().0.lock() {
        *kept = Some(move_menu.clone());
    }
    let shell_menu = SubmenuBuilder::new(app, "Shell")
        .item(
            &MenuItemBuilder::with_id(windows::NEW_WINDOW_EVENT, "New Window")
                .accelerator("Cmd+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("moveToNewWindow", "Move to New Window")
                .accelerator("Ctrl+Cmd+N")
                .build(app)?,
        )
        .item(&move_menu)
        .separator()
        .item(
            &MenuItemBuilder::with_id("new", "New Terminal")
                .accelerator("Cmd+T")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("close", "Close Terminal")
                .accelerator("Cmd+W")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("tabNew", "New Tab")
                .accelerator("Shift+Cmd+T")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("tabNext", "Next Tab")
                .accelerator("Shift+Cmd+BracketRight")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("tabPrevious", "Previous Tab")
                .accelerator("Shift+Cmd+BracketLeft")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("tabMoveNext", "Move Pane to Next Tab")
                .accelerator("Ctrl+Shift+Cmd+BracketRight")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("tabMovePrevious", "Move Pane to Previous Tab")
                .accelerator("Ctrl+Shift+Cmd+BracketLeft")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("zen", "Zen Mode")
                .accelerator("Shift+Cmd+Enter")
                .build(app)?,
        )
        .build()?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(
            &MenuItemBuilder::with_id("copy", "Copy")
                .accelerator("Cmd+C")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("paste", "Paste")
                .accelerator("Cmd+V")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("selectAll", "Select All")
                .accelerator("Cmd+A")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("find", "Find…")
                .accelerator("Cmd+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("findNext", "Find Next")
                .accelerator("Cmd+G")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("findPrevious", "Find Previous")
                .accelerator("Shift+Cmd+G")
                .build(app)?,
        )
        .build()?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &shell_menu, &edit_menu, &window_menu])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // First, as the plugin requires: a second launch hands its command line to this tiili and exits before it opens a
    // window or restores the session. A dev run (`npm run tauri dev`) shares the installed tiili's identifier, so it
    // leaves the plugin out: otherwise it would hand off to the installed tiili and never open.
    let builder = if tauri::is_dev() {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            match launch::launch_action(&argv) {
                launch::LaunchAction::Focus => windows::focus_last(app),
                launch::LaunchAction::NewWindow => windows::open_from_launcher(app),
                launch::LaunchAction::FocusPane(id) => attention::focus_pane(app, id),
            }
        }))
    };
    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SessionRegistry::new())
        .manage(app_icon::IconState::default())
        .manage(app_icon::WorkingIcon::default())
        .manage(Tints::default())
        .manage(WindowSessions::default())
        .manage(windows::WindowLabels::default())
        .manage(windows::LastFocused::default())
        .manage(windows::WindowNames::default())
        .manage(windows::PendingMoves::default())
        .manage(SessionSinks::default())
        .manage(FlowGates::default())
        .manage(SessionReports::default())
        .manage(MoveMenu::default())
        .manage(attention::Attention::default())
        .manage(control_app::PendingOpens::default())
        .manage(control_app::PaneOpens::default())
        .manage(control_app::PaneOwners::default())
        .manage(control_app::ControlState::default())
        .manage(control_app::PaneOrders::default())
        .manage(session_app::SessionState::default())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::ThemeChanged(_) => app_icon::apply(window.app_handle()),
            tauri::WindowEvent::Focused(true) => {
                window.state::<windows::LastFocused>().set(window.label());
                refresh_move_menu(window.app_handle());
                attention::focus_changed(window.app_handle(), true);
            }
            tauri::WindowEvent::Focused(false) => {
                attention::focus_changed(window.app_handle(), false);
            }
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                session_app::record_geometry(window);
            }
            tauri::WindowEvent::CloseRequested { api, .. } => {
                session_app::close_requested(window, api);
            }
            // Tauri quits once the last window is gone, on macOS too.
            tauri::WindowEvent::Destroyed => {
                session_app::window_destroyed(window.app_handle(), window.label());
                window_destroyed(window.app_handle(), window.label());
            }
            _ => {}
        })
        .setup(|app| {
            app_icon::apply(app.handle());
            control_app::start(app.handle());
            integrations::refresh_at_startup(app.handle());
            {
                use tauri_plugin_notification::NotificationExt;
                let handle = app.handle().clone();
                app.notification().on_action(move |performed| {
                    if performed.action_id() == "tap" {
                        let id = performed.notification().map(|n| n.id());
                        attention::notification_clicked(&handle, id);
                    }
                })?;
            }
            session_app::restore(app)?;
            if let Some(main) = app.get_webview_window(windows::MAIN_WINDOW) {
                windows::reveal_later(&main);
            }
            #[cfg(windows)]
            jump_list::write();
            #[cfg(target_os = "macos")]
            {
                dock_menu::install(app.handle());
                let menu = macos_menu(app.handle())?;
                app.set_menu(menu)?;
                // Menu items act on the focused window only.
                app.on_menu_event(|app, event| {
                    if event.id().as_ref() == QUIT_ID {
                        app.exit(0);
                        return;
                    }
                    let Some(label) = windows::focused_label(app) else {
                        return;
                    };
                    let label = label.as_str();
                    let id = event.id().as_ref();
                    if matches!(
                        id,
                        "copy" | "paste" | "selectAll" | "find" | "findNext" | "findPrevious"
                    ) {
                        let _ = app.emit_to(label, CLIPBOARD_EVENT, id);
                    } else if matches!(
                        id,
                        "new"
                            | "close"
                            | "moveToNewWindow"
                            | "zen"
                            | "tabNew"
                            | "tabNext"
                            | "tabPrevious"
                            | "tabMoveNext"
                            | "tabMovePrevious"
                    ) {
                        let _ = app.emit_to(label, PANE_EVENT, id);
                    } else if id == "settings" {
                        let _ = app.emit_to(label, OPEN_SETTINGS_EVENT, ());
                    } else if id == windows::NEW_WINDOW_EVENT {
                        let _ = app.emit_to(label, windows::NEW_WINDOW_EVENT, ());
                    } else if let Some(target) = id.strip_prefix(MOVE_TO_WINDOW_ID) {
                        let _ = app.emit_to(label, MOVE_TO_WINDOW_EVENT, target);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_detach,
            pty_attach,
            pty_write,
            pty_resize,
            pty_close,
            pty_ack,
            pty_cwd,
            pty_running,
            pty_set_prompt,
            pty_set_highlight,
            shells_installed,
            settings::settings_load,
            settings::settings_save,
            settings::settings_open,
            integrations::integrations_status,
            integrations::integrations_apply,
            app_icon::app_icon_set,
            updates::update_install_kind,
            updates::relaunch_after_update,
            notes::heynote_load,
            notes::heynote_write,
            notes::heynote_remove,
            notes::heynote_move,
            notes::heynote_mkdir,
            notes::heynote_rmdir,
            notes::heynote_save_state,
            windows::window_new,
            windows::window_list,
            windows::window_set_name,
            windows::pane_move,
            windows::pane_move_take,
            attention::attention_mark,
            attention::attention_clear,
            attention::attention_list,
            attention::attention_next,
            control_app::pane_open_done,
            control_app::pane_close_done,
            control_app::pane_minimize_done,
            control_app::pane_order_set,
            links::link_open,
            links::path_resolve,
            links::path_open,
            links::path_reveal,
            session_app::session_load,
            session_app::session_update,
            session_app::session_save_scrollback,
            session_app::session_clear_scrollback,
            session_app::session_flushed
        ])
        .build(tauri::generate_context!())
        .expect("error while building tiili")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                if session_app::exit_requested(app) {
                    api.prevent_exit();
                }
            }
            tauri::RunEvent::Exit => {
                session_app::exited(app);
                control_app::stop(app);
            }
            _ => {}
        });
}
