//! `tiili <command>` as a console program. A release build of the app's own `tiili` binary is a GUI program on
//! Windows, which interactive shells start without waiting for or reading its exit code; this one is not, so the
//! app installs it as `bin\tiili.exe` on Windows (see `install_cli` in `control_app.rs`). It runs the same
//! command-line mode as `tiili <command>`, but never starts the app.

fn main() {
    let raw: Vec<std::ffi::OsString> = std::env::args_os().skip(1).collect();
    tiili_lib::cli::main(&raw)
}
