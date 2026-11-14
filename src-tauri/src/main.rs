// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tiili_lib::claude_skill;

fn main() {
    // Subcommands run before the GUI starts and exit without opening a window.
    if std::env::args().nth(1).as_deref() == Some(claude_skill::SUBCOMMAND) {
        std::process::exit(claude_skill::run_install());
    }
    tiili_lib::run()
}
