//! Project tints, assigned once for the whole app so a repository has the same tint in every window. Free of
//! Tauri types: `lib.rs` keeps one [`Tints`] as managed state and asks it for a session's tint whenever it sends
//! that session's `pane-cwd`.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::pty::SessionId;

/// How many project tints the brand defines (`--tint-1` … `--tint-16`).
pub const TINT_COUNT: u8 = 16;

/// Open panes per tint number; tints missing from the map have none.
pub type TintCounts = HashMap<u8, usize>;

/// Counts open panes per tint, from each pane's tint (`None` for untinted panes).
pub fn tint_counts(tints: impl IntoIterator<Item = Option<u8>>) -> TintCounts {
    let mut counts = TintCounts::new();
    for tint in tints.into_iter().flatten() {
        *counts.entry(tint).or_default() += 1;
    }
    counts
}

/// Gives each repository key a project tint for the session: the first sixteen keys get tints 1 to 16 in the
/// order they appear, and a key keeps its tint even after its panes close. Once all sixteen are taken, a new key
/// gets the tint with the fewest open panes, ties going to the lowest number.
#[derive(Default)]
pub struct TintAssigner {
    tints: HashMap<String, u8>,
}

impl TintAssigner {
    /// The tint of `key`, assigning one if it is new; `open` are the open panes per tint.
    pub fn assign(&mut self, key: &str, open: &TintCounts) -> u8 {
        if let Some(&known) = self.tints.get(key) {
            return known;
        }
        let tint = match u8::try_from(self.tints.len() + 1) {
            Ok(next) if next <= TINT_COUNT => next,
            _ => {
                let count = |t: u8| open.get(&t).copied().unwrap_or(0);
                // `min_by_key` keeps the first of equal counts, so ties go to the lowest number.
                (1..=TINT_COUNT).min_by_key(|&t| count(t)).unwrap_or(1)
            }
        };
        self.tints.insert(key.to_string(), tint);
        tint
    }
}

/// The key a pane's tint is assigned by: a local repository's root; for a remote pane, its host and repository
/// root, else its host alone. A local pane outside any repository has none and stays untinted. NUL can't occur in
/// a path or a host, so remote keys never equal a local root or another host's key.
pub fn tint_key(repo_root: Option<&str>, host: Option<&str>) -> Option<String> {
    match (host, repo_root) {
        (None, root) => root.map(str::to_string),
        (Some(host), Some(root)) => Some(format!("remote\0{host}\0{root}")),
        (Some(host), None) => Some(format!("remote\0{host}")),
    }
}

#[derive(Default)]
struct TintsInner {
    assigner: TintAssigner,
    /// The tint each open session shows; untinted sessions are missing.
    sessions: HashMap<SessionId, u8>,
}

/// The app-wide tints: the assigner and the tint of every open session in every window.
#[derive(Default)]
pub struct Tints(Mutex<TintsInner>);

impl Tints {
    /// Session `session` is now at `key` (`None` outside a repository): its tint, counted from now on, with the
    /// least-used rule counting every other open session.
    pub fn tint_for(&self, session: SessionId, key: Option<&str>) -> Option<u8> {
        let mut inner = self.0.lock().ok()?;
        let Some(key) = key else {
            inner.sessions.remove(&session);
            return None;
        };
        let others = tint_counts(
            inner
                .sessions
                .iter()
                .filter(|(&id, _)| id != session)
                .map(|(_, &t)| Some(t)),
        );
        let tint = inner.assigner.assign(key, &others);
        inner.sessions.insert(session, tint);
        Some(tint)
    }

    /// Session `session` has closed; its pane no longer counts.
    pub fn forget(&self, session: SessionId) {
        if let Ok(mut inner) = self.0.lock() {
            inner.sessions.remove(&session);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roots(n: usize) -> Vec<String> {
        (1..=n).map(|i| format!("/repo{i}")).collect()
    }

    /// One open pane per tint, except the tints given.
    fn counts(except: &[(u8, usize)]) -> TintCounts {
        (1..=TINT_COUNT)
            .map(|t| {
                let n = except.iter().find(|(e, _)| *e == t).map_or(1, |(_, n)| *n);
                (t, n)
            })
            .collect()
    }

    fn strs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn tint_assigner_cases() {
        let sixteen = roots(16);
        // (case, keys assigned before, key, open panes per tint, expected tint)
        let cases: Vec<(&str, Vec<String>, &str, TintCounts, u8)> = vec![
            (
                "First repository: gets tint 1",
                vec![],
                "/a",
                TintCounts::new(),
                1,
            ),
            (
                "Order: the third repository gets tint 3",
                strs(&["/a", "/b"]),
                "/c",
                TintCounts::new(),
                3,
            ),
            (
                "Two panes, one repository: both show the same tint",
                strs(&["/a", "/b"]),
                "/a",
                TintCounts::new(),
                1,
            ),
            (
                "Stability: a repository with no open panes keeps its tint",
                strs(&["/a", "/b"]),
                "/a",
                TintCounts::from([(2, 3)]),
                1,
            ),
            (
                "Sixteenth repository: gets tint 16",
                roots(15),
                "/repo16",
                TintCounts::new(),
                16,
            ),
            (
                "Seventeenth repository: gets the tint with the fewest open panes",
                sixteen.clone(),
                "/new",
                counts(&[(1, 3), (7, 0)]),
                7,
            ),
            (
                "Seventeenth repository: ties go to the lowest number",
                sixteen.clone(),
                "/new",
                counts(&[(4, 0), (9, 0)]),
                4,
            ),
            (
                "Seventeenth repository: tints missing from the counts have no panes",
                sixteen.clone(),
                "/new",
                TintCounts::from([(1, 2)]),
                2,
            ),
            (
                "After sixteen, a known repository keeps its tint",
                sixteen.clone(),
                "/repo5",
                counts(&[(1, 0)]),
                5,
            ),
        ];
        for (name, before, key, open, expected) in cases {
            let mut tints = TintAssigner::default();
            for k in &before {
                tints.assign(k, &TintCounts::new());
            }
            assert_eq!(tints.assign(key, &open), expected, "{name}");
        }
    }

    #[test]
    fn seventeenth_repository_keeps_its_shared_tint_once_assigned() {
        let mut tints = TintAssigner::default();
        for k in roots(16) {
            tints.assign(&k, &TintCounts::new());
        }
        assert_eq!(tints.assign("/new", &counts(&[(3, 0)])), 3);
        assert_eq!(tints.assign("/new", &counts(&[(8, 0)])), 3);
    }

    #[test]
    fn tint_counts_skip_untinted_panes() {
        assert_eq!(
            tint_counts([Some(1), Some(2), Some(1), None]),
            TintCounts::from([(1, 2), (2, 1)])
        );
    }

    #[test]
    fn tint_key_cases() {
        type Place = (Option<&'static str>, Option<&'static str>);
        let local = |root: Option<&'static str>| -> Place { (root, None) };
        let remote =
            |host: &'static str, root: Option<&'static str>| -> Place { (root, Some(host)) };
        // (case, first pane, second pane, whether they share a tint)
        let pairs = [
            (
                "Two agents in one remote repository: same tint",
                remote("build-box", Some("/srv/api")),
                remote("build-box", Some("/srv/api")),
                true,
            ),
            (
                "Same path on two hosts: own tints",
                remote("build-box", Some("/srv/api")),
                remote("staging", Some("/srv/api")),
                false,
            ),
            (
                "Remote without the snippet: the host's tint",
                remote("build-box", None),
                remote("build-box", None),
                true,
            ),
            (
                "Same path exists locally: not the local tint",
                remote("build-box", Some("/Users/red/tiili")),
                local(Some("/Users/red/tiili")),
                false,
            ),
            (
                "Remote host never takes a local root's tint",
                remote("build-box", None),
                local(Some("build-box")),
                false,
            ),
            (
                "A host's repository is not the host's own tint",
                remote("build-box", Some("/srv/api")),
                remote("build-box", None),
                false,
            ),
            (
                "Local panes in one repository: same tint",
                local(Some("/a")),
                local(Some("/a")),
                true,
            ),
        ];
        for (name, first, second, shared) in pairs {
            let mut tints = TintAssigner::default();
            let mut tint_of = |(root, host): Place| {
                tint_key(root, host).map(|k| tints.assign(&k, &TintCounts::new()))
            };
            assert_eq!(tint_of(first) == tint_of(second), shared, "{name}");
        }
        assert_eq!(
            tint_key(None, None),
            None,
            "Outside a repository: a local pane has no tint key"
        );
    }

    #[test]
    fn same_repository_in_two_windows_shares_one_tint() {
        let tints = Tints::default();
        // Sessions 1 and 2 are panes in two windows; both run in the same repository.
        assert_eq!(tints.tint_for(1, Some("/work/tiili")), Some(1));
        assert_eq!(tints.tint_for(2, Some("/work/other")), Some(2));
        assert_eq!(tints.tint_for(3, Some("/work/tiili")), Some(1));
        assert_eq!(tints.tint_for(3, None), None);
    }

    #[test]
    fn least_used_rule_counts_open_panes_in_every_window() {
        let tints = Tints::default();
        for (i, key) in roots(16).iter().enumerate() {
            let session = SessionId::try_from(i + 1).unwrap();
            tints.tint_for(session, Some(key));
        }
        // Every tint has one open pane; closing tint 6's pane makes it the least used.
        tints.forget(6);
        assert_eq!(tints.tint_for(100, Some("/new")), Some(6));
        // A session moving into another repository stops counting for its old tint.
        tints.tint_for(3, None);
        assert_eq!(tints.tint_for(101, Some("/newer")), Some(3));
    }
}
