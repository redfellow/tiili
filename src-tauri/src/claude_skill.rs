//! The bundled tiili-tiles Claude Code skill and `tiili install-claude-skill`, which writes it into the user's
//! `~/.claude/skills`; Settings → Integrations installs and removes it too (src/integrations.rs). The skill text is
//! embedded so the command works from any installed build.

use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::control::CliError;

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

/// Removes the skill's own folder, `<home>/.claude/skills/tiili-tiles`, and nothing else; other skills stay. A skill
/// that is not there is not an error.
pub fn uninstall(home: &Path) -> io::Result<()> {
    let path = skill_path(home);
    let Some(dir) = path.parent() else {
        return Ok(());
    };
    match fs::remove_dir_all(dir) {
        Err(err) if err.kind() != io::ErrorKind::NotFound => Err(err),
        _ => Ok(()),
    }
}

/// The user's home folder from the variables `env` reads: `HOME`, or `USERPROFILE` on Windows when `HOME` is unset.
pub fn home_dir(env: &dyn Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    ["HOME", "USERPROFILE"]
        .iter()
        .filter_map(|name| env(name))
        .find(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// Runs `tiili install-claude-skill` with the variables `env` reads: installs the skill and returns where it went.
pub fn install_from_env(env: &dyn Fn(&str) -> Option<OsString>) -> Result<PathBuf, CliError> {
    let home = home_dir(env).ok_or_else(|| {
        CliError::InstallFailed(
            "could not install the tiili-tiles skill: HOME (or USERPROFILE on Windows) is not set"
                .into(),
        )
    })?;
    install(&home).map_err(|err| {
        CliError::InstallFailed(format!(
            "could not install the tiili-tiles skill to {}: {err}",
            skill_path(&home).display()
        ))
    })
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
