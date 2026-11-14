//! The bundled tiili-tiles Claude Code skill and `tiili install-claude-skill`, which writes it into the user's
//! `~/.claude/skills`. The skill text is embedded so the command works from any installed build.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// The subcommand that installs the skill instead of starting the app.
pub const SUBCOMMAND: &str = "install-claude-skill";

/// The skill file, as shipped in `integrations/claude/skills/tiili-tiles/SKILL.md`.
pub const SKILL: &str = include_str!("../../integrations/claude/skills/tiili-tiles/SKILL.md");

/// Where the skill goes under a home folder: `<home>/.claude/skills/tiili-tiles/SKILL.md`.
pub fn skill_path(home: &Path) -> PathBuf {
    home.join(".claude")
        .join("skills")
        .join("tiili-tiles")
        .join("SKILL.md")
}

/// Writes the bundled skill under `home`, creating folders as needed and overwriting an existing copy. Returns the
/// path written.
pub fn install(home: &Path) -> io::Result<PathBuf> {
    let path = skill_path(home);
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(&path, SKILL)?;
    Ok(path)
}

/// The user's home folder: `HOME`, or `USERPROFILE` on Windows when `HOME` is unset.
fn home_dir() -> Option<PathBuf> {
    ["HOME", "USERPROFILE"]
        .iter()
        .filter_map(std::env::var_os)
        .find(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// Runs `tiili install-claude-skill`: installs the skill, prints where it went and returns the process exit code.
pub fn run_install() -> i32 {
    let Some(home) = home_dir() else {
        eprintln!("Could not install the tiili-tiles skill: no home folder (HOME is not set).");
        return 1;
    };
    match install(&home) {
        Ok(path) => {
            println!("Installed the tiili-tiles skill to {}", path.display());
            0
        }
        Err(err) => {
            eprintln!(
                "Could not install the tiili-tiles skill to {}: {err}",
                skill_path(&home).display()
            );
            1
        }
    }
}

#[cfg(test)]
mod tests {
    // @harvaaja-test-tier: integration
    use super::*;

    struct TempHome(PathBuf);

    impl TempHome {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir()
                .join(format!("tiili-claude-skill-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempHome {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn fresh_install_creates_the_folders_and_writes_the_skill() {
        let home = TempHome::new("fresh");
        let path = install(&home.0).unwrap();
        assert_eq!(
            path,
            home.0.join(".claude/skills/tiili-tiles/SKILL.md").as_path()
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), SKILL);
    }

    #[test]
    fn reinstall_overwrites_the_existing_skill() {
        let home = TempHome::new("reinstall");
        let path = skill_path(&home.0);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "an older skill").unwrap();
        assert_eq!(install(&home.0).unwrap(), path);
        assert_eq!(fs::read_to_string(&path).unwrap(), SKILL);
    }
}
