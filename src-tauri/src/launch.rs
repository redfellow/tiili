//! What a second launch of tiili asks the one already running to do. Pure, so it tests without a window.

/// The argument the Windows jump list and the Linux desktop action start tiili with to open a new window.
pub const NEW_WINDOW_ARG: &str = "--new-window";
/// The argument another app (Piippu, say) starts tiili with to bring one pane forward: `--focus-pane ID`, the
/// pane's `TIILI_PANE`.
pub const FOCUS_PANE_ARG: &str = "--focus-pane";

/// What the running tiili does when tiili is started again.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LaunchAction {
    /// Bring the last focused window to the front.
    Focus,
    /// Open a new window on the current desktop and focus it.
    NewWindow,
    /// Bring pane `id`'s window to the front and focus the pane (the last focused window where it is gone).
    FocusPane(crate::pty::SessionId),
}

/// What the running tiili does for a second launch whose command line is `argv` (the program path first, as the
/// OS passes it): a new window when it holds `--new-window`, pane ID when it holds `--focus-pane ID` (or
/// `--focus-pane=ID`), else focus the last focused window.
pub fn launch_action<S: AsRef<str>>(argv: &[S]) -> LaunchAction {
    let args: Vec<&str> = argv.iter().map(AsRef::as_ref).collect();
    let pane = args.iter().enumerate().find_map(|(i, arg)| match arg.strip_prefix(FOCUS_PANE_ARG) {
        Some("") => args.get(i + 1).and_then(|id| id.parse().ok()),
        Some(rest) => rest.strip_prefix('=').and_then(|id| id.parse().ok()),
        None => None,
    });
    if let Some(id) = pane {
        LaunchAction::FocusPane(id)
    } else if args.iter().any(|arg| *arg == NEW_WINDOW_ARG) {
        LaunchAction::NewWindow
    } else {
        LaunchAction::Focus
    }
}

#[cfg(test)]
mod tests {
    // @harvaaja-test-tier: fast
    use super::*;

    /// Plain relaunch focuses, Relaunch with new-window: what the running tiili does for each command line.
    #[test]
    fn plain_relaunch_focuses_and_relaunch_with_new_window_opens_one() {
        let cases: &[(&str, &[&str], LaunchAction)] = &[
            ("no command line at all", &[], LaunchAction::Focus),
            ("plain relaunch", &["/usr/bin/tiili"], LaunchAction::Focus),
            (
                "an argument tiili does not know",
                &["/usr/bin/tiili", "--psn_0_12345"],
                LaunchAction::Focus,
            ),
            (
                "Linux desktop action",
                &["/usr/bin/tiili", "--new-window"],
                LaunchAction::NewWindow,
            ),
            (
                "Windows jump list",
                &[r"C:\Program Files\tiili\tiili.exe", "--new-window"],
                LaunchAction::NewWindow,
            ),
            (
                "new-window after another argument",
                &["tiili", "--psn_0_1", "--new-window"],
                LaunchAction::NewWindow,
            ),
            (
                "a look-alike is not the flag",
                &["tiili", "--new-window=1"],
                LaunchAction::Focus,
            ),
            ("Piippu focusing a pane", &["tiili", "--focus-pane", "7"], LaunchAction::FocusPane(7)),
            ("focus-pane with =", &["tiili", "--focus-pane=12"], LaunchAction::FocusPane(12)),
            ("focus-pane without an id", &["tiili", "--focus-pane"], LaunchAction::Focus),
            ("focus-pane with a bad id", &["tiili", "--focus-pane", "x"], LaunchAction::Focus),
        ];
        for (name, argv, expected) in cases {
            assert_eq!(launch_action(argv), *expected, "{name}");
        }
    }

    /// The `key=value` lines of the .desktop group `[group]`.
    fn desktop_group<'a>(entry: &'a str, group: &str) -> Vec<(&'a str, &'a str)> {
        let header = format!("[{group}]");
        entry
            .lines()
            .skip_while(|line| line.trim() != header)
            .skip(1)
            .take_while(|line| !line.starts_with('['))
            .filter_map(|line| line.split_once('='))
            .collect()
    }

    /// Linux desktop action: the .deb's and AppImage's desktop entry offers New Window, which starts tiili with the
    /// flag the running tiili opens a window for.
    #[test]
    fn linux_desktop_action_starts_tiili_with_new_window() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
        assert_eq!(
            config["bundle"]["linux"]["deb"]["desktopTemplate"],
            "linux/tiili.desktop"
        );
        let entry = include_str!("../linux/tiili.desktop");
        assert!(desktop_group(entry, "Desktop Entry").contains(&("Actions", "new-window;")));
        let action = desktop_group(entry, "Desktop Action new-window");
        assert!(action.contains(&("Name", "New Window")));
        let exec = action
            .iter()
            .find(|(key, _)| *key == "Exec")
            .map(|(_, value)| *value)
            .expect("the action has an Exec line");
        assert_eq!(exec, "{{exec}} --new-window");
        let argv: Vec<&str> = exec.split_whitespace().collect();
        assert_eq!(launch_action(&argv), LaunchAction::NewWindow);
    }
}
