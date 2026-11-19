//! What a second launch of tiili asks the one already running to do. Pure, so it tests without a window.

/// The argument the Windows jump list and the Linux desktop action start tiili with to open a new window.
pub const NEW_WINDOW_ARG: &str = "--new-window";

/// What the running tiili does when tiili is started again.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LaunchAction {
    /// Bring the last focused window to the front.
    Focus,
    /// Open a new window on the current desktop and focus it.
    NewWindow,
}

/// What the running tiili does for a second launch whose command line is `argv` (the program path first, as the
/// OS passes it): a new window when it holds `--new-window`, else focus the last focused window.
pub fn launch_action<S: AsRef<str>>(argv: &[S]) -> LaunchAction {
    if argv.iter().any(|arg| arg.as_ref() == NEW_WINDOW_ARG) {
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
        ];
        for (name, argv, expected) in cases {
            assert_eq!(launch_action(argv), *expected, "{name}");
        }
    }
}
