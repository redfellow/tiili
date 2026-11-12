pub mod pty;
pub mod settings;

use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, State};

use pty::PtySession;

/// Event sent when the shell exits.
pub const PTY_EXIT_EVENT: &str = "pty-exit";
/// Event sent when a clipboard menu item is chosen; its payload is `copy`, `paste` or `selectAll`.
pub const CLIPBOARD_EVENT: &str = "clipboard";
/// Event sent when the app menu's Settings… item is chosen.
pub const OPEN_SETTINGS_EVENT: &str = "open-settings";

#[derive(Clone, Serialize)]
struct PtyExit {
    code: u32,
}

/// The window's one shell.
#[derive(Default)]
struct Terminal(Mutex<Option<PtySession>>);

fn with_session<T>(
    terminal: &Terminal,
    f: impl FnOnce(&PtySession) -> std::io::Result<T>,
) -> Result<T, String> {
    let guard = terminal.0.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or("No shell is running")?;
    f(session).map_err(|e| e.to_string())
}

/// Starts a new default shell, replacing any previous one; its output streams over `on_output`.
#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    terminal: State<'_, Terminal>,
    rows: u16,
    cols: u16,
    on_output: Channel<Vec<u8>>,
) -> Result<(), String> {
    let session = PtySession::spawn(
        rows,
        cols,
        Box::new(move |data| {
            let _ = on_output.send(data.to_vec());
        }),
        Box::new(move |code| {
            let _ = app.emit(PTY_EXIT_EVENT, PtyExit { code });
        }),
    )
    .map_err(|e| format!("Could not start the shell: {e}"))?;
    let mut guard = terminal.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(session);
    Ok(())
}

#[tauri::command]
fn pty_write(terminal: State<'_, Terminal>, data: String) -> Result<(), String> {
    with_session(&terminal, |s| s.write(data.as_bytes()))
}

#[tauri::command]
fn pty_resize(terminal: State<'_, Terminal>, rows: u16, cols: u16) -> Result<(), String> {
    with_session(&terminal, |s| s.resize(rows, cols))
}

/// macOS menu bar: the app menu with Settings… and an Edit menu whose items the frontend carries out on the terminal.
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
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &window_menu])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Terminal::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let menu = macos_menu(app.handle())?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    if matches!(id, "copy" | "paste" | "selectAll") {
                        let _ = app.emit(CLIPBOARD_EVENT, id);
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
            settings::settings_load,
            settings::settings_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tiili");
}
