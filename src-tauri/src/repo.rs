//! Finds the git repository a folder belongs to, so panes in one repository can share a tint. A linked worktree
//! belongs to the repository it was added from: its `.git` file points at a git dir holding `commondir`.

use std::fs;
use std::path::{Path, PathBuf};

/// A git repository: the root of the checkout a folder is in, the name the pane's chip shows, the key its tint is
/// assigned by and, in a linked worktree, the worktree's branch or name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repo {
    /// The checkout's root folder: the folder holding the nearest `.git`.
    pub root: PathBuf,
    /// The repository's name, the same in its main checkout and all its linked worktrees.
    pub name: String,
    /// What identifies the repository: for a local one its canonicalised common git folder, shared by the main
    /// checkout and every linked worktree; for a remote one its root.
    pub key: PathBuf,
    /// In a linked worktree, its branch, or git's worktree name on a detached HEAD; `None` in a main checkout.
    pub worktree: Option<String>,
}

/// The nearest folder at or above `path` that holds a `.git` folder or file (worktrees and
/// submodules have a `.git` file), or `None` outside any repository.
pub fn find_repo_root(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|dir| dir.join(".git").exists())
        .map(Path::to_path_buf)
}

/// The last component of `path` as text, or the whole path when it has none.
fn file_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into_owned()
}

/// `path` with symlinks and `..` resolved, without Windows' `\\?\` prefix on a drive path; `None` when it doesn't
/// exist.
fn canonical(path: &Path) -> Option<PathBuf> {
    let path = fs::canonicalize(path).ok()?;
    if cfg!(windows) {
        let text = path.to_string_lossy();
        if let Some(rest) = text.strip_prefix(r"\\?\") {
            if !rest.starts_with(r"UNC\") {
                return Some(PathBuf::from(rest));
            }
        }
    }
    Some(path)
}

/// A repository's name from its common git folder: `X/.git` is `X`, a bare `foo.git` is `foo`, and a dot-named
/// folder such as `.bare` takes its parent's name.
fn name_of_common_dir(common: &Path) -> String {
    let name = file_name(common);
    let parent = || {
        common
            .parent()
            .map(file_name)
            .unwrap_or_else(|| name.clone())
    };
    if name == ".git" || name.starts_with('.') {
        parent()
    } else if let Some(stem) = name.strip_suffix(".git").filter(|s| !s.is_empty()) {
        stem.to_string()
    } else {
        name
    }
}

/// The git dir a `.git` file in `root` points at (`gitdir: <path>`, relative to `root`), when it exists.
fn pointed_git_dir(root: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(root.join(".git")).ok()?;
    let target = text.lines().next()?.strip_prefix("gitdir:")?.trim();
    if target.is_empty() {
        return None;
    }
    let git_dir = root.join(target);
    git_dir.is_dir().then_some(git_dir)
}

/// What a linked worktree with git dir `git_dir` shows: its branch from `HEAD`, else (detached or unreadable) the
/// git dir's name, which is git's worktree name.
fn worktree_label(git_dir: &Path) -> String {
    fs::read_to_string(git_dir.join("HEAD"))
        .ok()
        .and_then(|head| {
            head.trim()
                .strip_prefix("ref: refs/heads/")
                .map(str::to_string)
        })
        .unwrap_or_else(|| file_name(git_dir))
}

/// The repository `path` is in. A `.git` folder makes its parent the main checkout. A `.git` file whose git dir
/// holds `commondir` makes a linked worktree of the repository at that common folder; one without `commondir`
/// (a submodule, a separate git dir) is its own repository. A pointer that can't be followed leaves the folder
/// holding the `.git` file as the repository, keyed by its path. HEAD is read afresh on every call.
pub fn find_repo(path: &Path) -> Option<Repo> {
    let root = find_repo_root(path)?;
    let dot_git = root.join(".git");
    let folder = |key: PathBuf| Repo {
        name: file_name(&root),
        key,
        worktree: None,
        root: root.clone(),
    };
    if dot_git.is_dir() {
        return Some(folder(canonical(&dot_git).unwrap_or_else(|| root.clone())));
    }
    let Some(git_dir) = pointed_git_dir(&root) else {
        return Some(folder(root.clone()));
    };
    let common = match fs::read_to_string(git_dir.join("commondir")) {
        Ok(text) => git_dir.join(text.trim()),
        Err(_) => return Some(folder(canonical(&git_dir).unwrap_or_else(|| root.clone()))),
    };
    let Some(key) = canonical(&common) else {
        return Some(folder(root.clone()));
    };
    Some(Repo {
        name: name_of_common_dir(&key),
        worktree: Some(worktree_label(&git_dir)),
        key,
        root,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A fresh empty folder under the system temp folder, with its canonical path (macOS's temp folder is behind a
    /// symlink).
    fn temp_dir() -> PathBuf {
        static NEXT: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "tiili-repo-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        canonical(&dir).expect("canonical")
    }

    struct Case {
        name: &'static str,
        /// Folders that get a `.git` folder.
        git_dirs: &'static [&'static str],
        /// A folder that gets a `.git` file, as worktrees and submodules have.
        git_file: Option<&'static str>,
        ask: &'static str,
        expected: Option<&'static str>,
    }

    #[test]
    fn finds_the_nearest_repository_root() {
        let cases = [
            Case {
                name: "git dir",
                git_dirs: &["proj"],
                git_file: None,
                ask: "proj/src",
                expected: Some("proj"),
            },
            Case {
                name: "git dir at root",
                git_dirs: &["proj"],
                git_file: None,
                ask: "proj",
                expected: Some("proj"),
            },
            Case {
                name: "git file",
                git_dirs: &[],
                git_file: Some("wt"),
                ask: "wt/a/b",
                expected: Some("wt"),
            },
            Case {
                name: "nested",
                git_dirs: &["outer", "outer/inner"],
                git_file: None,
                ask: "outer/inner/x",
                expected: Some("outer/inner"),
            },
            Case {
                name: "none",
                git_dirs: &[],
                git_file: None,
                ask: "plain/sub",
                expected: None,
            },
        ];
        for case in cases {
            let base = temp_dir();
            fs::create_dir_all(base.join(case.ask)).expect("dirs");
            for g in case.git_dirs {
                fs::create_dir_all(base.join(g).join(".git")).expect(".git dir");
            }
            if let Some(f) = case.git_file {
                fs::write(base.join(f).join(".git"), "gitdir: /elsewhere\n").expect(".git file");
            }
            assert_eq!(
                find_repo_root(&base.join(case.ask)),
                case.expected.map(|e| base.join(e)),
                "{}",
                case.name
            );
            let _ = fs::remove_dir_all(&base);
        }
    }

    /// Lays out a git folder at `git_dir` (relative to `base`) with `HEAD`.
    fn git_folder(base: &Path, git_dir: &str, head: &str) {
        fs::create_dir_all(base.join(git_dir)).expect("git dir");
        fs::write(base.join(git_dir).join("HEAD"), format!("{head}\n")).expect("HEAD");
    }

    /// Adds linked worktree `name` at `checkout` (relative to `base`) to the repository whose common git folder is
    /// `common`, as `git worktree add` does: an absolute `gitdir:` and a relative `commondir`.
    fn worktree(base: &Path, common: &str, name: &str, checkout: &str, head: &str) {
        let git_dir = format!("{common}/worktrees/{name}");
        git_folder(base, &git_dir, head);
        fs::write(base.join(&git_dir).join("commondir"), "../..\n").expect("commondir");
        fs::create_dir_all(base.join(checkout).join("src")).expect("checkout");
        fs::write(
            base.join(checkout).join(".git"),
            format!("gitdir: {}\n", base.join(&git_dir).display()),
        )
        .expect(".git file");
    }

    const BRANCH: &str = "ref: refs/heads/brand/app-icon-15";
    const DETACHED: &str = "0123456789abcdef0123456789abcdef01234567";

    /// Each layout, and the (folder asked, root, name, key, worktree) it resolves to, relative to the layout's base.
    type Want = (
        &'static str,
        &'static str,
        &'static str,
        &'static str,
        Option<&'static str>,
    );

    /// A layout's name, how to lay it out under a base folder, and what it resolves to.
    type Layout = (&'static str, fn(&Path), &'static [Want]);

    #[test]
    fn resolves_main_checkouts_worktrees_and_their_shared_key() {
        let cases: [Layout; 7] = [
            (
                "Main checkout: named after its folder, keyed by its .git",
                |b| git_folder(b, "tiili/.git", "ref: refs/heads/main"),
                &[("tiili/src", "tiili", "tiili", "tiili/.git", None)],
            ),
            (
                "Two worktrees: share the main checkout's key and name, show their branch",
                |b| {
                    git_folder(b, "tiili/.git", "ref: refs/heads/main");
                    worktree(b, "tiili/.git", "tiili-icon", "tiili-icon", BRANCH);
                    worktree(
                        b,
                        "tiili/.git",
                        "other",
                        "elsewhere/other",
                        "ref: refs/heads/x",
                    );
                },
                &[
                    ("tiili", "tiili", "tiili", "tiili/.git", None),
                    (
                        "tiili-icon/src",
                        "tiili-icon",
                        "tiili",
                        "tiili/.git",
                        Some("brand/app-icon-15"),
                    ),
                    (
                        "elsewhere/other",
                        "elsewhere/other",
                        "tiili",
                        "tiili/.git",
                        Some("x"),
                    ),
                ],
            ),
            (
                "Detached HEAD shows worktree name",
                |b| {
                    git_folder(b, "tiili/.git", "ref: refs/heads/main");
                    worktree(b, "tiili/.git", "_main", "cards/_main", DETACHED);
                },
                &[(
                    "cards/_main",
                    "cards/_main",
                    "tiili",
                    "tiili/.git",
                    Some("_main"),
                )],
            ),
            (
                "Worktree of a bare repository: named without .git",
                |b| {
                    git_folder(b, "api.git", "ref: refs/heads/main");
                    worktree(b, "api.git", "main", "api-main", "ref: refs/heads/main");
                    worktree(b, "api.git", "fix", "api-fix", "ref: refs/heads/fix");
                },
                &[
                    ("api-main", "api-main", "api", "api.git", Some("main")),
                    ("api-fix", "api-fix", "api", "api.git", Some("fix")),
                ],
            ),
            (
                "Dot-named bare folder: named after its parent",
                |b| {
                    git_folder(b, "proj/.bare", "ref: refs/heads/main");
                    fs::write(b.join("proj/.git"), "gitdir: ./.bare\n").expect(".git file");
                    worktree(b, "proj/.bare", "main", "proj/main", "ref: refs/heads/main");
                },
                &[
                    (
                        "proj/main/src",
                        "proj/main",
                        "proj",
                        "proj/.bare",
                        Some("main"),
                    ),
                    ("proj", "proj", "proj", "proj/.bare", None),
                ],
            ),
            (
                "Submodule keeps its own tint: no commondir, its own repository",
                |b| {
                    git_folder(b, "app/.git", "ref: refs/heads/main");
                    git_folder(b, "app/.git/modules/lib", DETACHED);
                    fs::create_dir_all(b.join("app/lib/src")).expect("submodule");
                    fs::write(b.join("app/lib/.git"), "gitdir: ../.git/modules/lib\n")
                        .expect(".git file");
                },
                &[
                    (
                        "app/lib/src",
                        "app/lib",
                        "lib",
                        "app/.git/modules/lib",
                        None,
                    ),
                    ("app", "app", "app", "app/.git", None),
                ],
            ),
            (
                "Missing main checkout falls back: the worktree folder is the repository",
                |b| {
                    fs::create_dir_all(b.join("wt/src")).expect("wt");
                    fs::write(b.join("wt/.git"), "gitdir: /nowhere/.git/worktrees/wt\n")
                        .expect(".git file");
                },
                &[("wt/src", "wt", "wt", "wt", None)],
            ),
        ];
        for (name, lay_out, wants) in cases {
            let base = temp_dir();
            lay_out(&base);
            for &(ask, root, repo_name, key, worktree) in wants {
                let got = find_repo(&base.join(ask)).unwrap_or_else(|| panic!("{name}: {ask}"));
                let want = Repo {
                    root: base.join(root),
                    name: repo_name.to_string(),
                    key: base.join(key),
                    worktree: worktree.map(str::to_string),
                };
                assert_eq!(got, want, "{name}: {ask}");
            }
            let _ = fs::remove_dir_all(&base);
        }
    }

    #[test]
    fn mid_run_git_switch_head_is_read_on_every_lookup() {
        let base = temp_dir();
        git_folder(&base, "tiili/.git", "ref: refs/heads/main");
        worktree(&base, "tiili/.git", "wt", "wt", BRANCH);
        let ask = base.join("wt/src");
        assert_eq!(
            find_repo(&ask).and_then(|r| r.worktree).as_deref(),
            Some("brand/app-icon-15")
        );
        fs::write(
            base.join("tiili/.git/worktrees/wt/HEAD"),
            "ref: refs/heads/other\n",
        )
        .expect("HEAD");
        assert_eq!(
            find_repo(&ask).and_then(|r| r.worktree).as_deref(),
            Some("other")
        );
        let _ = fs::remove_dir_all(&base);
    }
}
