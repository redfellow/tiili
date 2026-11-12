//! Reads another process's working directory, so a new pane can start where the focused one is.

use std::path::PathBuf;

/// The working directory of process `pid`, or `None` when it cannot be read (always on Windows,
/// where ConPTY gives no way to read a child's working directory).
#[cfg(target_os = "linux")]
pub fn process_cwd(pid: u32) -> Option<PathBuf> {
    std::fs::read_link(format!("/proc/{pid}/cwd")).ok()
}

/// `proc_pidinfo`'s vnode path flavour, whose `pvi_cdir` is the process's working directory.
/// (libproc's own `pidcwd` is not implemented on macOS.)
#[cfg(target_os = "macos")]
struct VnodePathInfo(libc::proc_vnodepathinfo);

#[cfg(target_os = "macos")]
impl libproc::libproc::proc_pid::PIDInfo for VnodePathInfo {
    fn flavor() -> libproc::libproc::proc_pid::PidInfoFlavor {
        libproc::libproc::proc_pid::PidInfoFlavor::VNodePathInfo
    }
}

/// The working directory of process `pid`, or `None` when it cannot be read.
#[cfg(target_os = "macos")]
pub fn process_cwd(pid: u32) -> Option<PathBuf> {
    use std::os::unix::ffi::OsStringExt;

    let info: VnodePathInfo =
        libproc::libproc::proc_pid::pidinfo(i32::try_from(pid).ok()?, 0).ok()?;
    let path: Vec<u8> = info
        .0
        .pvi_cdir
        .vip_path
        .iter()
        .flatten()
        .take_while(|&&c| c != 0)
        .map(|&c| c as u8)
        .collect();
    (!path.is_empty()).then(|| PathBuf::from(std::ffi::OsString::from_vec(path)))
}

/// The working directory of process `pid`: never readable here, so new panes start in the home folder.
#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub fn process_cwd(_pid: u32) -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::process_cwd;

    #[test]
    fn cwd_of_this_process() {
        let found = process_cwd(std::process::id());
        if cfg!(any(target_os = "linux", target_os = "macos")) {
            let expected = std::env::current_dir().expect("current dir");
            assert_eq!(
                found.map(|p| p.canonicalize().expect("canonical")),
                Some(expected.canonicalize().expect("canonical"))
            );
        } else {
            assert_eq!(found, None);
        }
    }
}
