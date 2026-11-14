// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `tiili open` and `tiili list`, run from inside a pane, talk to the running app instead of starting one.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if tiili_lib::cli::is_cli(&args) {
        tiili_lib::cli::main(&args)
    }
    tiili_lib::run()
}
