//! Undoes what a Linux AppImage's AppRun exports, so shells and the programs they start see the
//! session's own environment instead of the AppImage's bundled libraries and tools. Pure, so it is
//! testable on any platform.

/// One change to a shell's environment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnvEdit {
    Set(String, String),
    Remove(String),
}

/// Variables AppRun adds that mean nothing to a shell.
const APPRUN_ONLY: [&str; 4] = ["APPIMAGE", "APPDIR", "ARGV0", "OWD"];

/// Whether `entry` is `appdir` itself or inside it (by path component, so `/tmp/.mount_ABCdef`
/// is not inside `/tmp/.mount_ABC`).
fn inside(appdir: &str, entry: &str) -> bool {
    entry == appdir
        || entry
            .strip_prefix(appdir)
            .is_some_and(|rest| rest.starts_with('/'))
}

/// The edits that give a shell back the environment from before AppRun, for the AppImage mounted
/// at `appdir` (the `APPDIR` variable). No edits when `appdir` is unset, empty or `/`.
pub fn scrub(appdir: Option<&str>, env: impl Iterator<Item = (String, String)>) -> Vec<EnvEdit> {
    let Some(appdir) = appdir else {
        return Vec::new();
    };
    let appdir = if appdir == "/" {
        appdir
    } else {
        appdir.trim_end_matches('/')
    };
    if appdir.is_empty() || appdir == "/" {
        return Vec::new();
    }
    let mut edits = Vec::new();
    for (key, value) in env {
        if APPRUN_ONLY.contains(&key.as_str()) || (key == "GDK_BACKEND" && value == "x11") {
            edits.push(EnvEdit::Remove(key));
        } else if value.contains(':') {
            let entries: Vec<&str> = value.split(':').collect();
            let kept: Vec<&str> = entries
                .iter()
                .copied()
                .filter(|entry| !inside(appdir, entry))
                .collect();
            if kept.len() == entries.len() {
                // Nothing of the AppImage's in it: leave it as it was.
            } else if kept.iter().all(|entry| entry.is_empty()) {
                edits.push(EnvEdit::Remove(key));
            } else {
                edits.push(EnvEdit::Set(key, kept.join(":")));
            }
        } else if inside(appdir, &value) {
            edits.push(EnvEdit::Remove(key));
        }
    }
    edits
}

#[cfg(test)]
mod tests {
    // @harvaaja-test-tier: fast
    use super::*;

    const APPDIR: &str = "/tmp/.mount_ABC";

    fn run(appdir: Option<&str>, env: &[(&str, &str)]) -> Vec<EnvEdit> {
        let mut edits = scrub(
            appdir,
            env.iter().map(|(k, v)| (k.to_string(), v.to_string())),
        );
        edits.sort_by_key(|edit| match edit {
            EnvEdit::Set(k, _) | EnvEdit::Remove(k) => k.clone(),
        });
        edits
    }

    fn remove(key: &str) -> EnvEdit {
        EnvEdit::Remove(key.into())
    }

    fn set(key: &str, value: &str) -> EnvEdit {
        EnvEdit::Set(key.into(), value.into())
    }

    type Case<'a> = (
        &'a str,
        Option<&'a str>,
        Vec<(&'a str, &'a str)>,
        Vec<EnvEdit>,
    );

    #[test]
    fn scrubs_what_apprun_exported() {
        let cases: Vec<Case> = vec![
            (
                "LD_LIBRARY_PATH with only AppImage paths is removed",
                Some(APPDIR),
                vec![(
                    "LD_LIBRARY_PATH",
                    "/tmp/.mount_ABC/usr/lib:/tmp/.mount_ABC/lib",
                )],
                vec![remove("LD_LIBRARY_PATH")],
            ),
            (
                "PATH mixed keeps system entries in order",
                Some(APPDIR),
                vec![(
                    "PATH",
                    "/tmp/.mount_ABC/usr/bin:/usr/bin:/tmp/.mount_ABC:/bin",
                )],
                vec![set("PATH", "/usr/bin:/bin")],
            ),
            (
                "single value inside APPDIR is removed",
                Some(APPDIR),
                vec![(
                    "GSETTINGS_SCHEMA_DIR",
                    "/tmp/.mount_ABC/usr/share/glib-2.0/schemas",
                )],
                vec![remove("GSETTINGS_SCHEMA_DIR")],
            ),
            (
                "sibling mount path is kept",
                Some(APPDIR),
                vec![
                    ("PATH", "/tmp/.mount_ABCdef/bin:/usr/bin"),
                    ("FOO", "/tmp/.mount_ABCdef/x"),
                ],
                vec![],
            ),
            (
                "AppRun-only variables are removed",
                Some(APPDIR),
                vec![
                    ("APPIMAGE", "/home/u/tiili.AppImage"),
                    ("APPDIR", APPDIR),
                    ("ARGV0", "tiili"),
                    ("OWD", "/home/u"),
                ],
                vec![
                    remove("APPDIR"),
                    remove("APPIMAGE"),
                    remove("ARGV0"),
                    remove("OWD"),
                ],
            ),
            (
                "GDK_BACKEND=x11 is removed",
                Some(APPDIR),
                vec![("GDK_BACKEND", "x11")],
                vec![remove("GDK_BACKEND")],
            ),
            (
                "GDK_BACKEND=wayland is kept",
                Some(APPDIR),
                vec![("GDK_BACKEND", "wayland")],
                vec![],
            ),
            (
                "unrelated variables are untouched",
                Some(APPDIR),
                vec![
                    ("HOME", "/home/u"),
                    ("PATH", "/usr/bin:/bin"),
                    ("EMPTY", ""),
                ],
                vec![],
            ),
            (
                "empty list entries are kept",
                Some(APPDIR),
                vec![("XDG_DATA_DIRS", "/tmp/.mount_ABC/usr/share::/usr/share")],
                vec![set("XDG_DATA_DIRS", ":/usr/share")],
            ),
            (
                "LD_LIBRARY_PATH left with only an empty entry is removed",
                Some(APPDIR),
                vec![("LD_LIBRARY_PATH", "/tmp/.mount_ABC/usr/lib/:")],
                vec![remove("LD_LIBRARY_PATH")],
            ),
            (
                "trailing empty entry is kept beside a surviving one",
                Some(APPDIR),
                vec![("XDG_DATA_DIRS", "/tmp/.mount_ABC/usr/share/:/usr/share:")],
                vec![set("XDG_DATA_DIRS", "/usr/share:")],
            ),
            (
                "list of only colons without AppImage entries is untouched",
                Some(APPDIR),
                vec![("FOO", ":"), ("MANPATH", "::")],
                vec![],
            ),
            (
                "trailing slash on APPDIR still matches",
                Some("/tmp/.mount_ABC/"),
                vec![("PATH", "/tmp/.mount_ABC/usr/bin:/usr/bin")],
                vec![set("PATH", "/usr/bin")],
            ),
            (
                "no edits when APPDIR is unset",
                None,
                vec![
                    ("PATH", "/tmp/.mount_ABC/usr/bin:/usr/bin"),
                    ("GDK_BACKEND", "x11"),
                ],
                vec![],
            ),
            (
                "no edits when APPDIR is empty",
                Some(""),
                vec![("APPIMAGE", "x"), ("PATH", "/usr/bin:/bin")],
                vec![],
            ),
            (
                "no edits when APPDIR is /",
                Some("/"),
                vec![("APPDIR", "/"), ("PATH", "/usr/bin:/bin")],
                vec![],
            ),
        ];
        for (name, appdir, env, want) in cases {
            assert_eq!(run(appdir, &env), want, "{name}");
        }
    }
}
