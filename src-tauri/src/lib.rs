pub mod app_icon;
pub mod bridge;
pub mod command;
pub mod cwd;
pub mod notes;
pub mod pty;
pub mod repo;
pub mod settings;
pub mod shell_integration;
pub mod tints;
pub mod window_state;
pub mod windows;

use std::path::Path;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use pty::{SessionId, SessionRegistry};
use tints::Tints;
use windows::WindowSessions;

/// Event sent when a shell exits; its payload names the session.
pub const PTY_EXIT_EVENT: &str = "pty-exit";
/// Event sent when a clipboard menu item is chosen; its payload is `copy`, `paste` or `selectAll`.
pub const CLIPBOARD_EVENT: &str = "clipboard";
/// Event sent when a pane menu item is chosen; its payload is `new` or `close`.
pub const PANE_EVENT: &str = "pane";
/// Event sent when the app menu's Settings… item is chosen.
pub const OPEN_SETTINGS_EVENT: &str = "open-settings";
/// Event sent when a shell's working directory or repository changes; its payload is a [`PaneCwdEvent`].
pub const PANE_CWD_EVENT: &str = "pane-cwd";
/// Event sent when what runs in a pane changes; its payload is a [`PaneCommandEvent`].
pub const PANE_COMMAND_EVENT: &str = "pane-command";

#[derive(Clone, Serialize)]
struct PtyExit {
    id: SessionId,
    code: u32,
}

/// A repository as the frontend sees it: root folder and name.
#[derive(Clone, Serialize)]
struct RepoInfo {
    root: String,
    name: String,
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
        let root = at.repo.as_ref().map(|r| r.root.to_string_lossy());
        let key = tints::tint_key(root.as_deref(), at.host.as_deref());
        Self {
            tint: tints.tint_for(pane_id, key.as_deref()),
            pane_id,
            cwd: at.cwd.to_string_lossy().into_owned(),
            repo: at.repo.as_ref().map(|r| RepoInfo {
                root: r.root.to_string_lossy().into_owned(),
                name: r.name.clone(),
            }),
            host: at.host.clone(),
        }
    }
}

fn text(err: std::io::Error) -> String {
    err.to_string()
}

/// Session `id` has ended: it leaves its window and the tint counts.
fn forget_session(app: &AppHandle, id: SessionId) {
    app.state::<WindowSessions>().remove(id);
    app.state::<Tints>().forget(id);
}

/// Starts a new default shell in `cwd` (home folder when absent or unreadable) with the prompt chosen
/// in Settings (`off` when absent) and returns its session id; its output streams over `on_output`, a
/// channel of its own, and its working directory as `pane-cwd` events and what runs in it as
/// `pane-command` events, sent only to the window that started it.
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
    on_output: Channel<Vec<u8>>,
) -> Result<SessionId, String> {
    let label = window.label().to_string();
    let (cwd_app, cwd_label) = (app.clone(), label.clone());
    let (command_app, command_label) = (app.clone(), label.clone());
    let exit_label = label.clone();
    let id = sessions
        .spawn_tracked(
            cwd.as_deref().map(Path::new),
            prompt.as_deref().unwrap_or(shell_integration::PROMPT_OFF),
            rows,
            cols,
            Box::new(move |_id, data| {
                let _ = on_output.send(data.to_vec());
            }),
            Some(Box::new(move |id, at| {
                let event = PaneCwdEvent::new(id, at, &cwd_app.state::<Tints>());
                let _ = cwd_app.emit_to(cwd_label.as_str(), PANE_CWD_EVENT, event);
            })),
            Some(Box::new(move |id, command| {
                let _ = command_app.emit_to(
                    command_label.as_str(),
                    PANE_COMMAND_EVENT,
                    PaneCommandEvent {
                        pane_id: id,
                        command: command.to_string(),
                    },
                );
            })),
            Box::new(move |id, code| {
                forget_session(&app, id);
                let _ = app.emit_to(exit_label.as_str(), PTY_EXIT_EVENT, PtyExit { id, code });
            }),
        )
        .map_err(|e| format!("Could not start the shell: {e}"))?;
    window.state::<WindowSessions>().add(&label, id);
    Ok(id)
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

/// Window `label` was closed: its shells end and it no longer holds Heynote or the focus.
fn window_destroyed(app: &AppHandle, label: &str) {
    let registry = app.state::<SessionRegistry>();
    for id in app.state::<WindowSessions>().take(label) {
        app.state::<Tints>().forget(id);
        let _ = registry.close(id);
    }
    app.state::<notes::HeynoteOwner>().release(label);
    app.state::<windows::LastFocused>().forget(label);
}

/// The working directory of session `id`'s shell, or `None` where it cannot be read (Windows).
#[tauri::command]
fn pty_cwd(sessions: State<'_, SessionRegistry>, id: SessionId) -> Result<Option<String>, String> {
    Ok(sessions
        .cwd(id)
        .map_err(text)?
        .map(|p| p.to_string_lossy().into_owned()))
}

/// macOS menu bar: the app menu with Settings…, a Shell menu for panes and an Edit menu, whose items the
/// frontend carries out.
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
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;
    let shell_menu = SubmenuBuilder::new(app, "Shell")
        .item(
            &MenuItemBuilder::with_id(windows::NEW_WINDOW_EVENT, "New Window")
                .accelerator("Cmd+N")
                .build(app)?,
        )
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
        .build()?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &shell_menu, &edit_menu, &window_menu])
        .build()
}

/// Size of the main window when it has no usable saved state; the same as `tauri.conf.json`.
const DEFAULT_WINDOW_SIZE: tauri::LogicalSize<f64> = tauri::LogicalSize::new(900.0, 600.0);

/// Puts the main window back to its default size, centred, when its saved position lies on no connected
/// screen: the window-state plugin leaves the position to the OS then but still restores the saved size.
fn reset_off_screen_window(app: &tauri::App) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let path = app
        .path()
        .app_config_dir()?
        .join(tauri_plugin_window_state::DEFAULT_FILENAME);
    let Some(saved) = window_state::read_saved(&path, window.label()) else {
        return Ok(());
    };
    let monitors: Vec<_> = window
        .available_monitors()?
        .iter()
        .map(|m| window_state::Rect {
            x: m.position().x,
            y: m.position().y,
            width: m.size().width,
            height: m.size().height,
        })
        .collect();
    if !window_state::is_on_screen(saved, &monitors) {
        window.set_size(DEFAULT_WINDOW_SIZE)?;
        window.center()?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_window_state::StateFlags;

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filter(windows::is_remembered)
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .manage(SessionRegistry::new())
        .manage(app_icon::IconState::default())
        .manage(Tints::default())
        .manage(WindowSessions::default())
        .manage(windows::WindowLabels::default())
        .manage(windows::LastFocused::default())
        .manage(notes::HeynoteOwner::default())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::ThemeChanged(_) => app_icon::apply(window.app_handle()),
            tauri::WindowEvent::Focused(true) => {
                window.state::<windows::LastFocused>().set(window.label())
            }
            // Tauri quits once the last window is gone, on macOS too.
            tauri::WindowEvent::Destroyed => window_destroyed(window.app_handle(), window.label()),
            _ => {}
        })
        .setup(|app| {
            app_icon::apply(app.handle());
            reset_off_screen_window(app)?;
            #[cfg(target_os = "macos")]
            {
                let menu = macos_menu(app.handle())?;
                app.set_menu(menu)?;
                // Menu items act on the focused window only.
                app.on_menu_event(|app, event| {
                    let Some(label) = windows::focused_label(app) else {
                        return;
                    };
                    let label = label.as_str();
                    let id = event.id().as_ref();
                    if matches!(id, "copy" | "paste" | "selectAll") {
                        let _ = app.emit_to(label, CLIPBOARD_EVENT, id);
                    } else if matches!(id, "new" | "close") {
                        let _ = app.emit_to(label, PANE_EVENT, id);
                    } else if id == "settings" {
                        let _ = app.emit_to(label, OPEN_SETTINGS_EVENT, ());
                    } else if id == windows::NEW_WINDOW_EVENT {
                        let _ = app.emit_to(label, windows::NEW_WINDOW_EVENT, ());
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_close,
            pty_cwd,
            settings::settings_load,
            settings::settings_save,
            app_icon::app_icon_set,
            notes::heynote_load,
            notes::heynote_write,
            notes::heynote_remove,
            notes::heynote_move,
            notes::heynote_mkdir,
            notes::heynote_rmdir,
            notes::heynote_save_state,
            notes::heynote_claim,
            notes::heynote_release,
            notes::heynote_focus,
            windows::window_new
        ])
        .run(tauri::generate_context!())
        .expect("error while running tiili");
}
