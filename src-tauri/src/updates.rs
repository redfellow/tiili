//! How this copy of tiili was installed, which decides whether it may update itself. Pure apart from
//! the command, so it is testable on any platform.

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

#[cfg(test)]
mod tests {
    use super::*;

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
