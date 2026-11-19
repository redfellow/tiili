//! How this copy of tiili was installed, which decides whether it may update itself, and how it
//! restarts after an update. Pure apart from the commands, so it is testable on any platform.

use std::path::Path;

use tauri::AppHandle;

/// How tiili was installed: `deb` (a Linux `.deb`, which the updater can't replace, so the user is
/// sent to the release page) or `bundle` (macOS app, Windows setup or Linux AppImage).
pub fn install_kind(os: &str, appimage_set: bool) -> &'static str {
    if os == "linux" && !appimage_set {
        "deb"
    } else {
        "bundle"
    }
}

/// This copy's install kind: see [`install_kind`]. An AppImage runs with `APPIMAGE` set.
#[tauri::command]
pub fn update_install_kind() -> &'static str {
    install_kind(std::env::consts::OS, std::env::var_os("APPIMAGE").is_some())
}

/// The shell command that starts the updated macOS app once this one is gone: it waits until `pid`
/// has exited, then opens the `.app` bundle that holds `current_exe` (`…/<name>.app/Contents/MacOS/<bin>`).
/// Plain `open`, not `open -n`, and only after the old process is gone, so the Dock keeps one tiili.
/// `None` when the binary is not inside a `.app` bundle.
pub fn macos_relaunch_command(current_exe: &Path, pid: u32) -> Option<String> {
    let macos = current_exe.parent()?;
    let contents = macos.parent()?;
    let bundle = contents.parent()?;
    if macos.file_name()? != "MacOS" || contents.file_name()? != "Contents" {
        return None;
    }
    if bundle.extension()? != "app" {
        return None;
    }
    let quoted = bundle.to_str()?.replace('\'', "'\\''");
    Some(format!(
        "while kill -0 {pid} 2>/dev/null; do sleep 0.2; done; /usr/bin/open '{quoted}'"
    ))
}

/// Restarts tiili after an update has been installed. On macOS a detached shell starts the new
/// bundle once this process has exited, and the app exits the normal way, so the session is saved
/// and only one tiili is ever running. Elsewhere, or when that can't be set up, Tauri's restart.
#[tauri::command]
pub fn relaunch_after_update(app: AppHandle) {
    #[cfg(target_os = "macos")]
    if let Some(command) = std::env::current_exe()
        .ok()
        .and_then(|exe| macos_relaunch_command(&exe, std::process::id()))
    {
        use std::os::unix::process::CommandExt;
        use std::process::{Command, Stdio};
        let spawned = Command::new("/bin/sh")
            .arg("-c")
            .arg(command)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .process_group(0)
            .spawn();
        if spawned.is_ok() {
            app.exit(0);
            return;
        }
    }
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn macos_relaunch_command_by_path() {
        // @harvaaja-test-tier: fast
        let cases: [(&str, Option<&str>); 4] = [
            (
                "/Applications/tiili.app/Contents/MacOS/tiili",
                Some("while kill -0 42 2>/dev/null; do sleep 0.2; done; /usr/bin/open '/Applications/tiili.app'"),
            ),
            (
                "/Users/me/My Apps/red's tiili.app/Contents/MacOS/tiili",
                Some("while kill -0 42 2>/dev/null; do sleep 0.2; done; /usr/bin/open '/Users/me/My Apps/red'\\''s tiili.app'"),
            ),
            ("/usr/local/bin/tiili", None),
            ("/opt/tiili/Contents/MacOS/tiili", None),
        ];
        for (exe, expected) in cases {
            assert_eq!(
                macos_relaunch_command(&PathBuf::from(exe), 42).as_deref(),
                expected,
                "{exe}"
            );
        }
    }

    #[test]
    fn install_kind_by_platform() {
        let cases = [
            ("linux", false, "deb"),
            ("linux", true, "bundle"),
            ("macos", false, "bundle"),
            ("windows", false, "bundle"),
        ];
        for (os, appimage_set, expected) in cases {
            assert_eq!(
                install_kind(os, appimage_set),
                expected,
                "{os} with APPIMAGE set: {appimage_set}"
            );
        }
    }
}
