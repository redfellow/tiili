// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `tiili <command>` (see `tiili help`) runs before the GUI starts and exits without opening a window; no
    // arguments, or a dash-prefixed one the OS passes, start the app.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if tiili_lib::cli::is_cli(&args) {
        tiili_lib::cli::main(&args)
    }
    tiili_lib::run()
}
