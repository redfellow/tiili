//! Finds the git repository a folder belongs to, so panes in one repository can share a tint.

use std::path::{Path, PathBuf};

/// A git repository: its root folder and the name the pane's chip shows.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repo {
    pub root: PathBuf,
    /// The root folder's name.
    pub name: String,
}

/// The nearest folder at or above `path` that holds a `.git` folder or file (worktrees and
/// submodules have a `.git` file), or `None` outside any repository.
pub fn find_repo_root(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|dir| dir.join(".git").exists())
        .map(Path::to_path_buf)
}

/// The repository `path` is in, named after its root folder.
pub fn find_repo(path: &Path) -> Option<Repo> {
    let root = find_repo_root(path)?;
    let name = root
        .file_name()
        .unwrap_or(root.as_os_str())
        .to_string_lossy()
        .into_owned();
    Some(Repo { root, name })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A fresh empty folder under the system temp folder.
    fn temp_dir() -> PathBuf {
        static NEXT: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "tiili-repo-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
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

    #[test]
    fn repository_is_named_after_its_root_folder() {
        let base = temp_dir();
        fs::create_dir_all(base.join("tiili/.git")).expect(".git dir");
        fs::create_dir_all(base.join("tiili/src")).expect("src");
        let repo = find_repo(&base.join("tiili/src")).expect("repo");
        assert_eq!(repo.name, "tiili");
        assert_eq!(repo.root, base.join("tiili"));
        let _ = fs::remove_dir_all(&base);
    }
}
