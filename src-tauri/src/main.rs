// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tiili_lib::claude_skill;

fn main() {
    // Subcommands run before the GUI starts and exit without opening a window.
    if std::env::args().nth(1).as_deref() == Some(claude_skill::SUBCOMMAND) {
        attach_parent_console();
        std::process::exit(claude_skill::run_install());
    }
    // `tiili open` and `tiili list`, run from inside a pane, talk to the running app instead of starting one.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if tiili_lib::cli::is_cli(&args) {
        tiili_lib::cli::main(&args)
    }
    tiili_lib::run()
}

/// Release builds on Windows are GUI-subsystem apps, which start without a console, so a subcommand's output would
/// go nowhere. Attaching to the console of the shell that started tiili makes it show there. Fails harmlessly when
/// there is no such console (started from Explorer) or one is already attached (debug builds).
#[cfg(windows)]
fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // SAFETY: AttachConsole takes a process id and has no other preconditions.
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
fn attach_parent_console() {}
