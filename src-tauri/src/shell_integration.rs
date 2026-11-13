//! Shell integration: how tiili starts zsh, bash and PowerShell so they show the prompt the user chose in
//! Settings, after the user's own startup files have loaded and only where those left the shell's default prompt.
//! Free of Tauri types; [`plan`] is pure so it can be tested without a shell.

use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use portable_pty::CommandBuilder;

/// The prompt choice that leaves shells exactly as they start without tiili.
pub const PROMPT_OFF: &str = "off";
/// Every prompt the integration scripts know, besides [`PROMPT_OFF`].
pub const PROMPTS: [&str; 3] = ["classic", "minimal", "tiili"];

/// The scripts, embedded in the binary and written to the integration folder before a shell needs them: each
/// path is relative to that folder.
const SCRIPTS: [(&str, &str); 6] = [
    (
        "zsh/.zshenv",
        include_str!("shell_integration/zsh/zshenv.zsh"),
    ),
    (
        "zsh/.zprofile",
        include_str!("shell_integration/zsh/zprofile.zsh"),
    ),
    (
        "zsh/.zshrc",
        include_str!("shell_integration/zsh/zshrc.zsh"),
    ),
    (
        "zsh/.zlogin",
        include_str!("shell_integration/zsh/zlogin.zsh"),
    ),
    (
        "bash/tiili.bash",
        include_str!("shell_integration/bash/tiili.bash"),
    ),
    (
        "pwsh/tiili.ps1",
        include_str!("shell_integration/pwsh/tiili.ps1"),
    ),
];

/// How to start a shell: `program` with `args` and extra `env`, or, when `program` is `None`, the default shell
/// exactly as without the integration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellPlan {
    pub program: Option<String>,
    pub args: Vec<OsString>,
    pub env: Vec<(String, OsString)>,
}

impl ShellPlan {
    fn plain() -> Self {
        Self {
            program: None,
            args: Vec::new(),
            env: Vec::new(),
        }
    }
}

/// How to start `shell` (a path, e.g. `$SHELL` or `%COMSPEC%`) so it shows `prompt`, with the integration scripts in
/// `dir`. `user_zdotdir` is the ZDOTDIR tiili itself was started with, if any. Off, an unknown prompt and shells
/// other than zsh, bash and PowerShell get the plain plan.
pub fn plan(shell: &str, prompt: &str, dir: &Path, user_zdotdir: Option<OsString>) -> ShellPlan {
    if !PROMPTS.contains(&prompt) {
        return ShellPlan::plain();
    }
    let program = Some(shell.to_string());
    let chosen = ("TIILI_PROMPT".to_string(), OsString::from(prompt));
    match crate::command::program_name(shell)
        .to_ascii_lowercase()
        .as_str()
    {
        "zsh" => {
            let mut env = vec![
                ("ZDOTDIR".to_string(), dir.join("zsh").into_os_string()),
                chosen,
            ];
            if let Some(user) = user_zdotdir.filter(|d| !d.is_empty()) {
                env.push(("TIILI_USER_ZDOTDIR".to_string(), user));
            }
            // A login shell, like the default spawn, so .zprofile and .zlogin load too.
            ShellPlan {
                program,
                args: vec!["-l".into()],
                env,
            }
        }
        "bash" => ShellPlan {
            program,
            args: vec![
                "--rcfile".into(),
                dir.join("bash").join("tiili.bash").into_os_string(),
                "-i".into(),
            ],
            env: vec![chosen],
        },
        "pwsh" | "powershell" => {
            let script = dir.join("pwsh").join("tiili.ps1");
            // A single-quoted PowerShell string: a quote inside is written twice.
            let quoted = script.to_string_lossy().replace('\'', "''");
            ShellPlan {
                program,
                args: vec![
                    "-NoExit".into(),
                    "-Command".into(),
                    format!(". '{quoted}'").into(),
                ],
                env: vec![chosen],
            }
        }
        _ => ShellPlan::plain(),
    }
}

/// Writes the integration scripts into `dir`, leaving files that already hold the right text alone.
pub fn install(dir: &Path) -> io::Result<()> {
    for (path, text) in SCRIPTS {
        let target = dir.join(path);
        if fs::read_to_string(&target).is_ok_and(|current| current == text) {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        // Written aside and renamed, so a shell starting in another pane never reads half a file.
        let aside = target.with_extension(format!("tmp{}", std::process::id()));
        fs::write(&aside, text)?;
        fs::rename(&aside, &target)?;
    }
    Ok(())
}

/// The folder tiili keeps the integration scripts in: `shell-integration` in the app's cache folder.
pub fn default_dir() -> Option<PathBuf> {
    let var = |name: &str| {
        std::env::var_os(name)
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
    };
    let cache = if cfg!(target_os = "macos") {
        var("HOME").map(|h| h.join("Library").join("Caches"))
    } else if cfg!(windows) {
        var("LOCALAPPDATA")
    } else {
        var("XDG_CACHE_HOME").or_else(|| var("HOME").map(|h| h.join(".cache")))
    }?;
    Some(cache.join("app.tiili").join("shell-integration"))
}

/// The command that starts `shell` with `prompt` through the integration, its scripts written to `dir`; `None`
/// when the shell should start plainly: Off, a shell without an integration, or scripts that cannot be written.
pub fn command_for(shell: &str, prompt: &str, dir: &Path) -> Option<CommandBuilder> {
    let plan = plan(shell, prompt, dir, std::env::var_os("ZDOTDIR"));
    let program = plan.program?;
    install(dir).ok()?;
    let mut cmd = CommandBuilder::new(program);
    cmd.args(&plan.args);
    for (key, value) in plan.env {
        cmd.env(key, value);
    }
    Some(cmd)
}

/// The command that starts the user's default shell with `prompt`, its scripts in `dir`; without a folder, or
/// wherever [`command_for`] gives `None`, the plain default shell.
pub fn shell_command(prompt: &str, dir: Option<&Path>) -> CommandBuilder {
    let default = CommandBuilder::new_default_prog();
    dir.and_then(|dir| command_for(&default.get_shell(), prompt, dir))
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(items: &[&str]) -> Vec<OsString> {
        items.iter().map(OsString::from).collect()
    }

    fn env(items: &[(&str, &str)]) -> Vec<(String, OsString)> {
        items
            .iter()
            .map(|(k, v)| (k.to_string(), OsString::from(v)))
            .collect()
    }

    fn joined(dir: &Path, parts: &[&str]) -> String {
        parts
            .iter()
            .fold(dir.to_path_buf(), |p, part| p.join(part))
            .to_string_lossy()
            .into_owned()
    }

    #[test]
    fn plans_per_shell_and_prompt() {
        let dir = Path::new("/cache/shell-integration");
        let windows = Path::new(r"C:\Users\O'Brien\AppData\Local\app.tiili\shell-integration");
        let zsh_dir = joined(dir, &["zsh"]);
        let rcfile = joined(dir, &["bash", "tiili.bash"]);
        let ps1 = joined(dir, &["pwsh", "tiili.ps1"]);
        let windows_ps1 = joined(windows, &["pwsh", "tiili.ps1"]).replace('\'', "''");
        let plain = ShellPlan::plain();
        let some = |s: &str| Some(s.to_string());
        type Case<'a> = (&'a str, &'a str, &'a Path, Option<&'a str>, ShellPlan);
        let cases: Vec<Case> = vec![
            // Off and unknown prompts leave every shell alone.
            ("/bin/zsh", "off", dir, None, plain.clone()),
            ("/bin/bash", "off", dir, None, plain.clone()),
            ("/bin/zsh", "fancy", dir, None, plain.clone()),
            ("/bin/zsh", "", dir, None, plain.clone()),
            // Shells without an integration start unchanged.
            ("/usr/local/bin/fish", "classic", dir, None, plain.clone()),
            ("/opt/homebrew/bin/nu", "classic", dir, None, plain.clone()),
            (
                r"C:\Windows\System32\cmd.exe",
                "classic",
                windows,
                None,
                plain.clone(),
            ),
            (
                "/bin/zsh",
                "classic",
                dir,
                None,
                ShellPlan {
                    program: some("/bin/zsh"),
                    args: strings(&["-l"]),
                    env: env(&[("ZDOTDIR", &zsh_dir), ("TIILI_PROMPT", "classic")]),
                },
            ),
            (
                "/usr/bin/zsh",
                "tiili",
                dir,
                Some("/home/me/.config/zsh"),
                ShellPlan {
                    program: some("/usr/bin/zsh"),
                    args: strings(&["-l"]),
                    env: env(&[
                        ("ZDOTDIR", &zsh_dir),
                        ("TIILI_PROMPT", "tiili"),
                        ("TIILI_USER_ZDOTDIR", "/home/me/.config/zsh"),
                    ]),
                },
            ),
            (
                "/bin/bash",
                "minimal",
                dir,
                None,
                ShellPlan {
                    program: some("/bin/bash"),
                    args: strings(&["--rcfile", &rcfile, "-i"]),
                    env: env(&[("TIILI_PROMPT", "minimal")]),
                },
            ),
            (
                "/usr/local/bin/pwsh",
                "classic",
                dir,
                None,
                ShellPlan {
                    program: some("/usr/local/bin/pwsh"),
                    args: strings(&["-NoExit", "-Command", &format!(". '{ps1}'")]),
                    env: env(&[("TIILI_PROMPT", "classic")]),
                },
            ),
            (
                r"C:\Program Files\PowerShell\7\pwsh.exe",
                "classic",
                windows,
                None,
                ShellPlan {
                    program: some(r"C:\Program Files\PowerShell\7\pwsh.exe"),
                    args: strings(&["-NoExit", "-Command", &format!(". '{windows_ps1}'")]),
                    env: env(&[("TIILI_PROMPT", "classic")]),
                },
            ),
            (
                r"C:\Windows\System32\WindowsPowerShell\v1.0\PowerShell.EXE",
                "tiili",
                windows,
                None,
                ShellPlan {
                    program: some(r"C:\Windows\System32\WindowsPowerShell\v1.0\PowerShell.EXE"),
                    args: strings(&["-NoExit", "-Command", &format!(". '{windows_ps1}'")]),
                    env: env(&[("TIILI_PROMPT", "tiili")]),
                },
            ),
        ];
        for (shell, prompt, dir, zdotdir, expected) in cases {
            assert_eq!(
                plan(shell, prompt, dir, zdotdir.map(OsString::from)),
                expected,
                "{shell} {prompt}"
            );
        }
    }
}
