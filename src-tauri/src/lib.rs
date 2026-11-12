pub mod bridge;
pub mod cwd;
pub mod pty;
pub mod settings;

use std::path::Path;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, State};

use pty::{SessionId, SessionRegistry};

/// Event sent when a shell exits; its payload names the session.
pub const PTY_EXIT_EVENT: &str = "pty-exit";
/// Event sent when a clipboard menu item is chosen; its payload is `copy`, `paste` or `selectAll`.
pub const CLIPBOARD_EVENT: &str = "clipboard";
/// Event sent when a pane menu item is chosen; its payload is `new` or `close`.
pub const PANE_EVENT: &str = "pane";
/// Event sent when the app menu's Settings… item is chosen.
pub const OPEN_SETTINGS_EVENT: &str = "open-settings";

#[derive(Clone, Serialize)]
struct PtyExit {
    id: SessionId,
    code: u32,
}

fn text(err: std::io::Error) -> String {
    err.to_string()
}

/// Starts a new default shell in `cwd` (home folder when absent or unreadable) and returns its
/// session id; its output streams over `on_output`, a channel of its own.
#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    sessions: State<'_, SessionRegistry>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    on_output: Channel<Vec<u8>>,
) -> Result<SessionId, String> {
    sessions
        .spawn(
            cwd.as_deref().map(Path::new),
            rows,
            cols,
            Box::new(move |_id, data| {
                let _ = on_output.send(data.to_vec());
            }),
            Box::new(move |id, code| {
                let _ = app.emit(PTY_EXIT_EVENT, PtyExit { id, code });
            }),
        )
        .map_err(|e| format!("Could not start the shell: {e}"))
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
fn pty_close(sessions: State<'_, SessionRegistry>, id: SessionId) -> Result<(), String> {
    sessions.close(id).map_err(text)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(SessionRegistry::new())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let menu = macos_menu(app.handle())?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    if matches!(id, "copy" | "paste" | "selectAll") {
                        let _ = app.emit(CLIPBOARD_EVENT, id);
                    } else if matches!(id, "new" | "close") {
                        let _ = app.emit(PANE_EVENT, id);
                    } else if id == "settings" {
                        let _ = app.emit(OPEN_SETTINGS_EVENT, ());
                    }
                });
            }
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_close,
            pty_cwd,
            settings::settings_load,
            settings::settings_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tiili");
}
