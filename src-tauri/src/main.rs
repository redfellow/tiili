// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `tiili <command>` (see `tiili help`) runs before the GUI starts and exits without opening a window; no
    // arguments, or a dash-prefixed one the OS passes, start the app.
    // Read as `OsString`s: a non-UTF-8 argument is a usage error in command-line mode, not a panic.
    let raw: Vec<std::ffi::OsString> = std::env::args_os().skip(1).collect();
    if tiili_lib::cli::is_cli(&tiili_lib::cli::lossy(&raw)) {
        tiili_lib::cli::main(&raw)
    }
    tiili_lib::run()
}
