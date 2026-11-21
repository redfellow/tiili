//! Settings → Integrations: tiili's integrations with coding agents, turned on and off from the app. Each one's
//! files are embedded in the binary, so an install needs nothing but tiili and the agent:
//!
//! - `omp-subagent-panes`: the Oh My Pi extension in `integrations/subagent-panes/omp/`, written to
//!   `<app data>/integrations/omp-subagent-panes` and linked with `omp plugin link`; turned off with
//!   `omp plugin uninstall tiili-subagent-panes`, then the folder is removed.
//! - `claude-skill`: the tiili-tiles Claude Code skill in `~/.claude/skills/tiili-tiles` (src/claude_skill.rs).
//!
//! Nothing here installs or removes an integration unless the user saves the tab with its box changed; on a new app
//! version [`refresh_installed`] rewrites the files of those already installed. Tools are looked up and run with a
//! search path of the login shell's `PATH` then the app's ([`search_path`]), because an app started from the Dock
//! or a desktop launcher does not get the `PATH` a terminal has. Commands go through a [`Runner`], so tests fake
//! `omp`.

use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::claude_skill;

/// The omp extension's files, as shipped in `integrations/subagent-panes/omp/`.
pub const OMP_FILES: &[(&str, &str)] = &[
    (
        "package.json",
        include_str!("../../integrations/subagent-panes/omp/package.json"),
    ),
    (
        "index.ts",
        include_str!("../../integrations/subagent-panes/omp/index.ts"),
    ),
];

/// The omp extension's package name, which `omp plugin list` shows and `omp plugin uninstall` takes.
pub const OMP_PLUGIN: &str = "tiili-subagent-panes";

/// How long the login shell gets to print its `PATH` before the app's own is used alone.
pub const LOGIN_SHELL_TIMEOUT: Duration = Duration::from_secs(3);

/// One integration as the Integrations tab lists it.
pub struct Integration {
    /// What the tab and [`apply`] call it.
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    /// The agent's command, which must be on the search path for the integration to be turned on or off.
    pub tool: &'static str,
}

pub const OMP_SUBAGENT_PANES: &str = "omp-subagent-panes";
pub const CLAUDE_SKILL: &str = "claude-skill";

/// Every integration, in the order the tab lists them.
pub const INTEGRATIONS: &[Integration] = &[
    Integration {
        id: OMP_SUBAGENT_PANES,
        name: "Oh My Pi subagent panes",
        description: "When omp runs in a tiili pane, each subagent it starts gets a pane of its own beside it that \
                      shows the subagent's work as it happens.",
        tool: "omp",
    },
    Integration {
        id: CLAUDE_SKILL,
        name: "Claude Code tiili-tiles skill",
        description: "Teaches Claude Code to open and arrange tiili panes with the tiili command.",
        tool: "claude",
    },
];

/// What a command run through a [`Runner`] gave back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ran {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Runs external commands: the real one starts a process, tests record what would have run.
pub trait Runner {
    /// Runs `program` (a path [`Env::find`] gave) with `args` and `PATH` set to `path`, and waits for it.
    fn run(&self, program: &Path, args: &[&str], path: &OsStr) -> io::Result<Ran>;
}

/// The [`Runner`] that starts real processes, without a console window on Windows.
pub struct SystemRunner;

impl Runner for SystemRunner {
    fn run(&self, program: &Path, args: &[&str], path: &OsStr) -> io::Result<Ran> {
        let mut command = Command::new(program);
        command.args(args).env("PATH", path).stdin(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let output = command.output()?;
        Ok(Ran {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

/// Where integrations go and how tools are found and run.
pub struct Env<'a> {
    /// The app data folder; the omp extension goes in its `integrations/omp-subagent-panes`.
    pub app_data: PathBuf,
    /// The user's home folder, under which the Claude Code skill goes; `None` when it is not known.
    pub home: Option<PathBuf>,
    /// The folders tools are looked up in, in order, and the `PATH` they run with.
    pub path: Vec<PathBuf>,
    pub runner: &'a dyn Runner,
}

impl Env<'_> {
    /// The first program named `tool` in the search path: on Windows `tool.exe`, `tool.cmd`, `tool.bat` or
    /// `tool.com`, elsewhere an executable file named `tool`.
    pub fn find(&self, tool: &str) -> Option<PathBuf> {
        self.path
            .iter()
            .flat_map(|dir| program_names(tool).map(move |name| dir.join(name)))
            .find(|candidate| is_program(candidate))
    }

    fn joined_path(&self) -> OsString {
        std::env::join_paths(&self.path).unwrap_or_default()
    }

    fn omp_dir(&self) -> PathBuf {
        omp_dir(&self.app_data)
    }
}

fn program_names(tool: &str) -> impl Iterator<Item = String> + '_ {
    let extensions: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat", ".com"]
    } else {
        &[""]
    };
    extensions.iter().map(move |ext| format!("{tool}{ext}"))
}

fn is_program(path: &Path) -> bool {
    let Ok(meta) = fs::metadata(path) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.is_file() && meta.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        meta.is_file()
    }
}

/// The search path: the login shell's `PATH` (`login`) first, then the app's (`app`), each folder once.
pub fn search_path(login: Option<&OsStr>, app: Option<&OsStr>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    for dir in [login, app]
        .into_iter()
        .flatten()
        .flat_map(std::env::split_paths)
    {
        if !dir.as_os_str().is_empty() && !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

/// The `PATH` a login shell `shell` sets up, or `None` when it fails, prints nothing or takes longer than
/// `timeout` (it is then killed). Only the last line it prints counts, so a profile that prints is harmless.
pub fn login_shell_path(shell: &Path, timeout: Duration) -> Option<OsString> {
    let mut child = Command::new(shell)
        .args(["-l", "-c", r#"printf '\n%s\n' "$PATH""#])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdout = child.stdout.take()?;
    let (sent, got) = mpsc::channel();
    std::thread::spawn(move || {
        let mut text = String::new();
        let read = stdout.read_to_string(&mut text);
        let _ = sent.send(read.map(|_| text));
    });
    let Ok(Ok(text)) = got.recv_timeout(timeout) else {
        let _ = child.kill();
        let _ = child.wait();
        return None;
    };
    if !child.wait().ok()?.success() {
        return None;
    }
    let path = text.lines().rev().find(|line| !line.trim().is_empty())?;
    Some(OsString::from(path.trim()))
}

/// The search path this machine gives: on macOS and Linux the login shell's (`$SHELL`, else `/bin/sh`) `PATH`
/// then the app's; on Windows the app's, which already comes from the registry.
pub fn system_path() -> Vec<PathBuf> {
    let app = std::env::var_os("PATH");
    let login = if cfg!(unix) {
        let shell = std::env::var_os("SHELL")
            .filter(|shell| !shell.is_empty())
            .map_or_else(|| PathBuf::from("/bin/sh"), PathBuf::from);
        login_shell_path(&shell, LOGIN_SHELL_TIMEOUT)
    } else {
        None
    };
    search_path(login.as_deref(), app.as_deref())
}

/// Where the omp extension goes: `<app data>/integrations/omp-subagent-panes`.
pub fn omp_dir(app_data: &Path) -> PathBuf {
    app_data.join("integrations").join(OMP_SUBAGENT_PANES)
}

/// One integration's row in the tab.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Status {
    pub id: String,
    pub name: String,
    pub description: String,
    /// The folder it installs to.
    pub location: String,
    /// Whether it is installed now.
    pub installed: bool,
    /// Whether it can be turned on or off: its tool is on the search path and its folder is known.
    pub available: bool,
    /// Why it is not available.
    pub reason: Option<String>,
}

/// Every integration's row, read from disk and the search path. The omp one counts as installed when its folder
/// is there and `omp plugin list` names it (or that list could not be read).
pub fn status(env: &Env) -> Vec<Status> {
    INTEGRATIONS
        .iter()
        .map(|integration| {
            let tool = env.find(integration.tool);
            let (location, installed) = match integration.id {
                OMP_SUBAGENT_PANES => {
                    let dir = env.omp_dir();
                    let installed = dir.join("package.json").is_file()
                        && tool
                            .as_deref()
                            .and_then(|omp| omp_lists_plugin(env, omp))
                            .unwrap_or(true);
                    (Some(dir), installed)
                }
                _ => {
                    let skill = env.home.as_deref().map(claude_skill::skill_path);
                    let installed = skill.as_deref().is_some_and(Path::is_file);
                    (
                        skill.and_then(|path| path.parent().map(Path::to_path_buf)),
                        installed,
                    )
                }
            };
            let reason = if location.is_none() {
                Some(
                    "Your home folder is not known: HOME (or USERPROFILE on Windows) is not set."
                        .to_string(),
                )
            } else if tool.is_none() {
                Some(format!("{} is not on PATH.", integration.tool))
            } else {
                None
            };
            Status {
                id: integration.id.to_string(),
                name: integration.name.to_string(),
                description: integration.description.to_string(),
                location: location.map_or_else(String::new, |dir| dir.display().to_string()),
                installed,
                available: reason.is_none(),
                reason,
            }
        })
        .collect()
}

/// Whether `omp plugin list --json` names the extension; `None` when the list could not be read.
fn omp_lists_plugin(env: &Env, omp: &Path) -> Option<bool> {
    let ran = env
        .runner
        .run(omp, &["plugin", "list", "--json"], &env.joined_path())
        .ok()
        .filter(|ran| ran.success)?;
    let list: serde_json::Value = serde_json::from_str(&ran.stdout).ok()?;
    Some(names_plugin(&list))
}

fn names_plugin(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Object(map) => {
            map.get("name").and_then(|name| name.as_str()) == Some(OMP_PLUGIN)
                || map.values().any(names_plugin)
        }
        serde_json::Value::Array(items) => items.iter().any(names_plugin),
        _ => false,
    }
}

/// One box the user changed: turn integration `id` on or off.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Change {
    pub id: String,
    pub on: bool,
}

/// What came of one [`Change`]: `error` and a `fix` to try when it failed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Outcome {
    pub id: String,
    pub ok: bool,
    pub error: Option<String>,
    pub fix: Option<String>,
}

/// Why a change failed and what to try.
struct Failure {
    error: String,
    fix: String,
}

/// Applies each change on its own, in order: a failure leaves the others applied.
pub fn apply(env: &Env, changes: &[Change]) -> Vec<Outcome> {
    changes
        .iter()
        .map(|change| {
            let result = match change.id.as_str() {
                OMP_SUBAGENT_PANES if change.on => install_omp(env),
                OMP_SUBAGENT_PANES => uninstall_omp(env),
                CLAUDE_SKILL => change_skill(env, change.on),
                _ => Err(Failure {
                    error: format!("There is no integration called {}.", change.id),
                    fix: "Reopen Settings and try again.".to_string(),
                }),
            };
            match result {
                Ok(()) => Outcome {
                    id: change.id.clone(),
                    ok: true,
                    error: None,
                    fix: None,
                },
                Err(failure) => Outcome {
                    id: change.id.clone(),
                    ok: false,
                    error: Some(failure.error),
                    fix: Some(failure.fix),
                },
            }
        })
        .collect()
}

fn find_omp(env: &Env) -> Result<PathBuf, Failure> {
    env.find("omp").ok_or_else(|| Failure {
        error: "omp is not on PATH.".to_string(),
        fix: "Install Oh My Pi, check that omp runs in a new terminal, then reopen Settings."
            .to_string(),
    })
}

/// Writes the bundled omp extension into `dir`, creating it, and overwriting older copies.
fn write_omp_files(dir: &Path) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    for (name, text) in OMP_FILES {
        fs::write(dir.join(name), text)?;
    }
    Ok(())
}

/// Runs `omp <args>`, failing with omp's own last words and the command to run by hand.
fn run_omp(env: &Env, omp: &Path, args: &[&str]) -> Result<(), Failure> {
    let by_hand = format!("omp {}", args.join(" "));
    let fix = format!("Run `{by_hand}` in a terminal to see what omp says.");
    let ran = env
        .runner
        .run(omp, args, &env.joined_path())
        .map_err(|err| Failure {
            error: format!("Could not run omp: {err}"),
            fix: fix.clone(),
        })?;
    if ran.success {
        return Ok(());
    }
    let said = [&ran.stderr, &ran.stdout]
        .into_iter()
        .flat_map(|text| text.lines().rev())
        .map(str::trim)
        .find(|line| !line.is_empty());
    Err(Failure {
        error: match said {
            Some(said) => format!("`{by_hand}` failed: {said}"),
            None => format!("`{by_hand}` failed."),
        },
        fix,
    })
}

fn install_omp(env: &Env) -> Result<(), Failure> {
    let omp = find_omp(env)?;
    let dir = env.omp_dir();
    write_omp_files(&dir).map_err(|err| Failure {
        error: format!("Could not write {}: {err}", dir.display()),
        fix: format!("Check that you can write to {}.", dir.display()),
    })?;
    // The folder stays when linking fails, so the command in the fix works as it stands.
    let dir_arg = dir.to_string_lossy();
    run_omp(env, &omp, &["plugin", "link", &dir_arg])
}

fn uninstall_omp(env: &Env) -> Result<(), Failure> {
    let omp = find_omp(env)?;
    run_omp(env, &omp, &["plugin", "uninstall", OMP_PLUGIN])?;
    let dir = env.omp_dir();
    match fs::remove_dir_all(&dir) {
        Err(err) if err.kind() != io::ErrorKind::NotFound => Err(Failure {
            error: format!(
                "omp no longer loads it, but {} could not be removed: {err}",
                dir.display()
            ),
            fix: format!("Delete {} by hand.", dir.display()),
        }),
        _ => Ok(()),
    }
}

fn change_skill(env: &Env, on: bool) -> Result<(), Failure> {
    let home = env.home.as_deref().ok_or_else(|| Failure {
        error: "Your home folder is not known: HOME (or USERPROFILE on Windows) is not set."
            .to_string(),
        fix: "Set HOME (USERPROFILE on Windows) and restart tiili.".to_string(),
    })?;
    let path = claude_skill::skill_path(home);
    let dir = path.parent().unwrap_or(home).to_path_buf();
    if on {
        claude_skill::install(home)
            .map(drop)
            .map_err(|err| Failure {
                error: format!("Could not write {}: {err}", path.display()),
                fix: format!("Check that you can write to {}.", dir.display()),
            })
    } else {
        claude_skill::uninstall(home).map_err(|err| Failure {
            error: format!("Could not remove {}: {err}", dir.display()),
            fix: format!("Delete {} by hand.", dir.display()),
        })
    }
}

/// Where the app version that last refreshed the integrations is kept: `<app data>/integrations/version`.
pub fn version_stamp(app_data: &Path) -> PathBuf {
    app_data.join("integrations").join("version")
}

/// Run at startup: on the first launch of app `version` (the stamp holds another or none), rewrites the files of
/// each integration whose files are there with this version's (the skill under `home`, the omp folder in
/// `app_data`), then stamps `version`. It never installs one that is not there and never runs omp: a linked
/// folder only needs its files replaced.
pub fn refresh_installed(app_data: &Path, home: Option<&Path>, version: &str) -> io::Result<()> {
    let stamp = version_stamp(app_data);
    if fs::read_to_string(&stamp).is_ok_and(|stamped| stamped.trim() == version) {
        return Ok(());
    }
    if let Some(home) = home.filter(|home| claude_skill::skill_path(home).is_file()) {
        claude_skill::install(home)?;
    }
    let dir = omp_dir(app_data);
    if dir.join("package.json").is_file() {
        write_omp_files(&dir)?;
    }
    if let Some(parent) = stamp.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&stamp, version)
}

/// The app data folder and the home folder `tiili install-claude-skill` uses.
fn app_folders(app: &AppHandle) -> Result<(PathBuf, Option<PathBuf>), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok((
        app_data,
        claude_skill::home_dir(&|name| std::env::var_os(name)),
    ))
}

/// Runs `job` with this machine's [`Env`] off the async runtime's threads, since the login shell and omp may take
/// seconds.
async fn with_env<T: Send + 'static>(
    app: AppHandle,
    job: impl FnOnce(&Env) -> T + Send + 'static,
) -> Result<T, String> {
    let (app_data, home) = app_folders(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        job(&Env {
            app_data,
            home,
            path: system_path(),
            runner: &SystemRunner,
        })
    })
    .await
    .map_err(|e| e.to_string())
}

/// Every integration's row, for the Integrations tab when the settings dialogue opens.
#[tauri::command]
pub async fn integrations_status(app: AppHandle) -> Result<Vec<Status>, String> {
    with_env(app, status).await
}

/// Turns each changed integration on or off, on its own, and says how each went.
#[tauri::command]
pub async fn integrations_apply(
    app: AppHandle,
    changes: Vec<Change>,
) -> Result<Vec<Outcome>, String> {
    with_env(app, move |env| apply(env, &changes)).await
}

/// [`refresh_installed`] for this app, at startup; a failure is only reported.
pub fn refresh_at_startup(app: &AppHandle) {
    let version = app.package_info().version.to_string();
    let result = app_folders(app).and_then(|(app_data, home)| {
        refresh_installed(&app_data, home.as_deref(), &version).map_err(|e| e.to_string())
    });
    if let Err(e) = result {
        eprintln!("tiili: could not refresh the installed integrations: {e}");
    }
}
