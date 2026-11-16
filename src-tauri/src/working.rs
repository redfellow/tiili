//! Which panes are working: a pane works while it is away from its shell ([`at_shell`]) and it printed output in the
//! last [`WORKING_WINDOW`]. Pure, so it is testable without a window or a pseudo-terminal; the app feeds it from each
//! pane's output and foreground reports, and the running app icon shows the working frames while any pane works.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::command::Running;
use crate::pty::SessionId;

/// Whether a pane whose shell reports `running` is at its shell: no command line runs and no other program is in
/// front. The command line counts where the foreground cannot be read (Windows), so panes running a command can work
/// there too.
pub fn at_shell(running: &Running) -> bool {
    running.command.is_none() && running.program.is_none()
}

/// How long after its last output a pane with a program in front still counts as working.
pub const WORKING_WINDOW: Duration = Duration::from_secs(3);

/// What is known about one pane.
#[derive(Clone, Copy, Debug)]
struct Pane {
    /// Whether the shell itself is in front; a pane starts with its shell there.
    is_shell_foreground: bool,
    last_output: Option<Instant>,
}

impl Default for Pane {
    fn default() -> Self {
        Self {
            is_shell_foreground: true,
            last_output: None,
        }
    }
}

/// Every open pane's foreground and latest output.
#[derive(Debug, Default)]
pub struct Working {
    panes: HashMap<SessionId, Pane>,
}

impl Working {
    /// Pane `id` printed output at `now`.
    pub fn output(&mut self, id: SessionId, now: Instant) {
        self.panes.entry(id).or_default().last_output = Some(now);
    }

    /// Pane `id`'s foreground is now its shell (`is_shell`) or another program.
    pub fn foreground(&mut self, id: SessionId, is_shell: bool) {
        self.panes.entry(id).or_default().is_shell_foreground = is_shell;
    }

    /// Pane `id` has closed.
    pub fn remove(&mut self, id: SessionId) {
        self.panes.remove(&id);
    }

    /// Whether some pane is working at `now`.
    pub fn any_working(&self, now: Instant) -> bool {
        self.panes.values().any(|pane| {
            !pane.is_shell_foreground
                && pane
                    .last_output
                    .is_some_and(|at| now.saturating_duration_since(at) <= WORKING_WINDOW)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pane's history, then whether anything is working.
    enum Step {
        Output(Duration),
        Foreground(bool),
        Reported(Running),
        Remove,
    }
    use Step::*;

    #[test]
    fn working_follows_the_foreground_and_the_last_output() {
        let start = Instant::now();
        let at = |secs: f32| start + Duration::from_secs_f32(secs);
        // (case, steps on pane 1 with output at the given offsets, checked at, working)
        let running = |command: Option<&str>, program: Option<&str>| Running {
            command: command.map(str::to_string),
            program: program.map(str::to_string),
        };
        let cases: [(&str, Vec<Step>, f32, bool); 10] = [
            (
                "Quiet foreground program: shell in front with output is idle",
                vec![Foreground(true), Output(Duration::ZERO)],
                1.0,
                false,
            ),
            (
                "Script running: a program with recent output is working",
                vec![Foreground(false), Output(Duration::from_secs(1))],
                2.0,
                true,
            ),
            (
                "Quiet foreground program: a program quiet for over 3 s is idle",
                vec![Foreground(false), Output(Duration::ZERO)],
                3.5,
                false,
            ),
            (
                "a closed pane is idle",
                vec![Foreground(false), Output(Duration::ZERO), Remove],
                0.5,
                false,
            ),
            (
                "a pane that has printed nothing is idle",
                vec![Foreground(false)],
                0.5,
                false,
            ),
            (
                "Script running: a reported command line without a known foreground (Windows) is working",
                vec![
                    Reported(running(Some("npm run build"), None)),
                    Output(Duration::ZERO),
                ],
                1.0,
                true,
            ),
            (
                "Script running: a foreground program without a command line is working",
                vec![
                    Reported(running(None, Some("python"))),
                    Output(Duration::ZERO),
                ],
                1.0,
                true,
            ),
            (
                "Quiet foreground program: no command line and the shell in front is idle",
                vec![Reported(running(None, None)), Output(Duration::ZERO)],
                1.0,
                false,
            ),
            (
                "Quiet foreground program: a reported command quiet for over 3 s is idle",
                vec![
                    Reported(running(Some("vim notes.md"), None)),
                    Output(Duration::ZERO),
                ],
                3.5,
                false,
            ),
            (
                "a new pane starts with its shell in front",
                vec![Output(Duration::ZERO)],
                0.5,
                false,
            ),
        ];
        for (case, steps, check, expected) in cases {
            let mut working = Working::default();
            for step in steps {
                match step {
                    Output(offset) => working.output(1, start + offset),
                    Foreground(is_shell) => working.foreground(1, is_shell),
                    Reported(running) => working.foreground(1, at_shell(&running)),
                    Remove => working.remove(1),
                }
            }
            assert_eq!(working.any_working(at(check)), expected, "{case}");
        }
    }

    #[test]
    fn one_working_pane_is_enough() {
        let now = Instant::now();
        let mut working = Working::default();
        working.foreground(1, true);
        working.output(1, now);
        working.foreground(2, false);
        working.output(2, now);
        assert!(working.any_working(now));
        working.remove(2);
        assert!(!working.any_working(now));
    }
}
