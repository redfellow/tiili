//! The shells a pane can start: the ones installed on this machine, offered in Settings, and the shell a pane runs
//! for the choice saved there. Free of Tauri types; [`parse_etc_shells`] and [`resolve`] are testable without a
//! shell.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use portable_pty::CommandBuilder;
use serde::Serialize;

/// What the Settings dialogue's Shell menu lists: the system default shell's program name and the installed shells'
/// paths.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InstalledShells {
    pub default: String,
    pub shells: Vec<String>,
}

/// The absolute paths `/etc/shells` lists, in file order, without comments, blank lines or repeats.
pub fn parse_etc_shells(text: &str) -> Vec<String> {
    parse_with(text, |path| path.to_string())
}

/// Like [`parse_etc_shells`], a path counting as a repeat when `key` gives it the same key as an earlier one.
fn parse_with(text: &str, key: impl Fn(&str) -> String) -> Vec<String> {
    let mut seen = HashSet::new();
    text.lines()
        .map(|line| line.split('#').next().unwrap_or_default().trim())
        .filter(|path| path.starts_with('/'))
        .filter(|path| seen.insert(key(path)))
        .map(str::to_string)
        .collect()
}

/// The same shell under another folder name, such as `/bin/bash` and `/usr/bin/bash` where `/bin` links to
/// `/usr/bin`: the path with its folder canonicalised.
fn same_shell_key(path: &str) -> String {
    let path = Path::new(path);
    match (
        path.parent().and_then(|dir| dir.canonicalize().ok()),
        path.file_name(),
    ) {
        (Some(dir), Some(name)) => dir.join(name).to_string_lossy().into_owned(),
        _ => path.to_string_lossy().into_owned(),
    }
}

/// The shells installed on this machine. On macOS and Linux, those `/etc/shells` lists whose files exist, the same
/// shell under a linked folder listed once; on Windows, Windows PowerShell, PowerShell 7 when `pwsh.exe` is on `PATH`,
/// and Command Prompt (`%COMSPEC%`).
pub fn installed() -> Vec<String> {
    if cfg!(windows) {
        return installed_windows();
    }
    let text = std::fs::read_to_string("/etc/shells").unwrap_or_default();
    parse_with(&text, same_shell_key)
        .into_iter()
        .filter(|path| Path::new(path).is_file())
        .collect()
}

fn installed_windows() -> Vec<String> {
    let var = |name: &str| std::env::var_os(name).filter(|v| !v.is_empty());
    let powershell = var("SystemRoot").map(|root| {
        PathBuf::from(root)
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe")
    });
    let pwsh = var("PATH").and_then(|path| {
        std::env::split_paths(&path)
            .map(|dir| dir.join("pwsh.exe"))
            .find(|exe| exe.is_file())
    });
    let comspec = var("COMSPEC").map(PathBuf::from);
    let mut shells: Vec<String> = Vec::new();
    for shell in [powershell, pwsh, comspec].into_iter().flatten() {
        let shell = shell.to_string_lossy().into_owned();
        if Path::new(&shell).is_file() && !shells.contains(&shell) {
            shells.push(shell);
        }
    }
    shells
}

/// Whether `path` is a file this user may run.
fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let Ok(c_path) = std::ffi::CString::new(path.as_os_str().as_bytes()) else {
            return false;
        };
        // SAFETY: access only reads the NUL-terminated path it is given.
        path.is_file() && unsafe { libc::access(c_path.as_ptr(), libc::X_OK) } == 0
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// The shell to start for the choice saved in Settings: the chosen path when it is a file this user may run, else
/// `None`, the system default (an empty or absent choice included).
pub fn resolve(chosen: Option<&str>) -> Option<PathBuf> {
    let chosen = chosen.map(str::trim).filter(|c| !c.is_empty())?;
    let path = PathBuf::from(chosen);
    is_executable(&path).then_some(path)
}

/// The path of the system default shell: `$SHELL` when it can be run, else the user's login shell (`/bin/sh` when
/// there is none) on macOS and Linux; `%COMSPEC%` on Windows.
pub fn system_default() -> String {
    CommandBuilder::new_default_prog().get_shell()
}

/// The path of the shell a pane starts for `chosen` (see [`resolve`]).
pub fn shell_path(chosen: Option<&str>) -> String {
    resolve(chosen)
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(system_default)
}

/// What the Shell menu offers: the system default's program name and [`installed`].
pub fn installed_shells() -> InstalledShells {
    InstalledShells {
        default: crate::command::program_name(&system_default()),
        shells: installed(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn etc_shells_parsed_in_order_without_comments_blanks_or_repeats() {
        let merged_usr = |path: &str| match path.strip_prefix("/bin/") {
            Some(name) => format!("/usr/bin/{name}"),
            None => path.to_string(),
        };
        let same = |path: &str| path.to_string();
        type Key = fn(&str) -> String;
        let cases: [(&str, Key, &[&str]); 6] = [
            ("", same, &[]),
            (
                "# /etc/shells: valid login shells\n\n/bin/sh\n/bin/bash\n/usr/bin/zsh\n/usr/bin/fish\n",
                same,
                &["/bin/sh", "/bin/bash", "/usr/bin/zsh", "/usr/bin/fish"],
            ),
            (
                "  /bin/zsh  \n/bin/zsh\n/bin/bash # bash\nbash\n\t\n",
                same,
                &["/bin/zsh", "/bin/bash"],
            ),
            ("/bin/bash\r\n/bin/dash\r\n", same, &["/bin/bash", "/bin/dash"]),
            // The same shell through a linked folder is listed once, at its first place.
            (
                "/bin/sh\n/bin/bash\n/usr/bin/sh\n/usr/bin/bash\n/usr/bin/zsh\n",
                merged_usr,
                &["/bin/sh", "/bin/bash", "/usr/bin/zsh"],
            ),
            (
                "/usr/bin/fish\n/bin/fish\n",
                merged_usr,
                &["/usr/bin/fish"],
            ),
        ];
        for (text, key, expected) in cases {
            assert_eq!(parse_with(text, key), expected, "{text:?}");
        }
        assert_eq!(
            parse_etc_shells("/bin/bash\n/usr/bin/bash\n/bin/bash\n"),
            ["/bin/bash", "/usr/bin/bash"]
        );
    }

    #[test]
    fn chosen_shell_resolves_only_when_it_can_run() {
        let dir = std::env::temp_dir().join(format!("tiili-shells-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp folder");
        let runnable = dir.join("tiili-sh");
        std::fs::write(&runnable, "#!/bin/sh\n").expect("shell written");
        let plain = dir.join("not-a-program");
        std::fs::write(&plain, "text\n").expect("file written");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&runnable, std::fs::Permissions::from_mode(0o755))
                .expect("shell runs");
            std::fs::set_permissions(&plain, std::fs::Permissions::from_mode(0o644))
                .expect("file does not run");
        }
        let runnable_text = runnable.to_string_lossy().into_owned();
        let padded = format!("  {runnable_text} ");
        let missing = dir.join("missing").to_string_lossy().into_owned();
        let folder = dir.to_string_lossy().into_owned();
        let plain_text = plain.to_string_lossy().into_owned();
        let mut cases: Vec<(Option<&str>, Option<PathBuf>)> = vec![
            (Some(&runnable_text), Some(runnable.clone())),
            (Some(&padded), Some(runnable.clone())),
            (Some(&missing), None),
            (Some(&folder), None),
            (Some(""), None),
            (Some("   "), None),
            (None, None),
        ];
        if cfg!(unix) {
            cases.push((Some(&plain_text), None));
        }
        for (chosen, expected) in cases {
            assert_eq!(resolve(chosen), expected, "{chosen:?}");
        }
        assert_eq!(shell_path(Some(&missing)), system_default());
        assert_eq!(shell_path(Some(&runnable_text)), runnable_text);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
