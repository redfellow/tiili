// @harvaaja-test-tier: fast
//! Settings → Integrations: status from disk and the search path, turning integrations on and off with a fake
//! `omp`, and the login shell's `PATH`.

use std::cell::RefCell;
use std::ffi::{OsStr, OsString};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tiili_lib::claude_skill;
use tiili_lib::integrations::{
    apply, omp_dir, refresh_installed, search_path, status, version_stamp, Change, Env, Outcome,
    Ran, Runner, CLAUDE_SKILL, OMP_FILES, OMP_PLUGIN, OMP_SUBAGENT_PANES,
};

/// A scratch folder, removed afterwards, holding the app data folder, a home folder and `PATH` folders.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir =
            std::env::temp_dir().join(format!("tiili-integrations-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn app_data(&self) -> PathBuf {
        self.0.join("app-data")
    }

    fn home(&self) -> PathBuf {
        self.0.join("home")
    }

    /// A `PATH` folder `dir` holding programs named `tools`.
    fn bin(&self, dir: &str, tools: &[&str]) -> PathBuf {
        let bin = self.0.join(dir);
        fs::create_dir_all(&bin).unwrap();
        for tool in tools {
            let file = bin.join(if cfg!(windows) {
                format!("{tool}.exe")
            } else {
                tool.to_string()
            });
            fs::write(&file, "").unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&file, fs::Permissions::from_mode(0o755)).unwrap();
            }
        }
        bin
    }

    fn env<'a>(&self, path: Vec<PathBuf>, runner: &'a dyn Runner) -> Env<'a> {
        Env {
            app_data: self.app_data(),
            home: Some(self.home()),
            path,
            runner,
        }
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// A fake `omp`: records each run (program, arguments, `PATH`) and answers with `reply`.
struct FakeOmp {
    reply: fn(&[&str]) -> io::Result<Ran>,
    runs: RefCell<Vec<(PathBuf, Vec<String>, OsString)>>,
}

impl FakeOmp {
    fn new(reply: fn(&[&str]) -> io::Result<Ran>) -> Self {
        Self {
            reply,
            runs: RefCell::new(Vec::new()),
        }
    }

    fn args(&self) -> Vec<Vec<String>> {
        self.runs.borrow().iter().map(|run| run.1.clone()).collect()
    }
}

impl Runner for FakeOmp {
    fn run(&self, program: &Path, args: &[&str], path: &OsStr) -> io::Result<Ran> {
        self.runs.borrow_mut().push((
            program.to_path_buf(),
            args.iter().map(|arg| arg.to_string()).collect(),
            path.to_os_string(),
        ));
        (self.reply)(args)
    }
}

fn ran(success: bool, stdout: &str, stderr: &str) -> io::Result<Ran> {
    Ok(Ran {
        success,
        stdout: stdout.to_string(),
        stderr: stderr.to_string(),
    })
}

/// omp lists the extension and every other command works.
fn omp_ok(args: &[&str]) -> io::Result<Ran> {
    if args.get(1) == Some(&"list") {
        ran(
            true,
            r#"{"npm":[{"name":"tiili-subagent-panes"}],"marketplace":[]}"#,
            "",
        )
    } else {
        ran(true, "", "")
    }
}

/// `omp plugin link` fails with a message, so omp does not list the extension.
fn link_fails(args: &[&str]) -> io::Result<Ran> {
    match args.get(1) {
        Some(&"link") => ran(false, "", "linking\nerror: no bun on PATH\n"),
        Some(&"list") => ran(true, r#"{"npm":[],"marketplace":[]}"#, ""),
        _ => ran(true, "", ""),
    }
}

fn row<'a>(
    rows: &'a [tiili_lib::integrations::Status],
    id: &str,
) -> &'a tiili_lib::integrations::Status {
    rows.iter().find(|row| row.id == id).unwrap()
}

fn on(id: &str, on: bool) -> Change {
    Change {
        id: id.to_string(),
        on,
    }
}

/// Installed outside the app / Tool missing: each box shows what is on disk, and an integration whose tool is not
/// on PATH says so and cannot be changed.
#[test]
fn status_comes_from_disk_and_the_search_path() {
    // Name, tools on PATH, skill on disk, omp folder on disk, how omp answers `omp plugin list --json`, then
    // (installed, available) for omp and for the skill.
    type Reply = fn(&[&str]) -> io::Result<Ran>;
    type Case = (
        &'static str,
        &'static [&'static str],
        bool,
        bool,
        Reply,
        (bool, bool),
        (bool, bool),
    );
    let not_listed: Reply = |_| ran(true, r#"{"npm":[],"marketplace":[]}"#, "");
    let list_fails: Reply = |_| ran(false, "", "boom");
    let cases: &[Case] = &[
        (
            "nothing installed",
            &["omp", "claude"],
            false,
            false,
            omp_ok,
            (false, true),
            (false, true),
        ),
        (
            "Installed outside the app",
            &["omp", "claude"],
            true,
            false,
            omp_ok,
            (false, true),
            (true, true),
        ),
        (
            "omp linked",
            &["omp", "claude"],
            false,
            true,
            omp_ok,
            (true, true),
            (false, true),
        ),
        (
            "omp folder but not linked",
            &["omp"],
            false,
            true,
            not_listed,
            (false, true),
            (false, false),
        ),
        (
            "omp list unreadable",
            &["omp"],
            false,
            true,
            list_fails,
            (true, true),
            (false, false),
        ),
        (
            "Tool missing",
            &["claude"],
            false,
            false,
            omp_ok,
            (false, false),
            (false, true),
        ),
        (
            "Turn off without the tool",
            &[],
            true,
            true,
            omp_ok,
            (true, false),
            (true, false),
        ),
    ];
    for &(name, tools, skill, folder, reply, omp, claude) in cases {
        let scratch = Scratch::new(&name.replace(' ', "-"));
        let bin = scratch.bin("bin", tools);
        if skill {
            claude_skill::install(&scratch.home()).unwrap();
        }
        if folder {
            let dir = omp_dir(&scratch.app_data());
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("package.json"), "{}").unwrap();
        }
        let runner = FakeOmp::new(reply);
        let rows = status(&scratch.env(vec![bin], &runner));
        let got = |id| {
            let row = row(&rows, id);
            assert_eq!(row.reason.is_some(), !row.available, "{name}: {row:?}");
            assert!(!row.location.is_empty(), "{name}: {row:?}");
            (row.installed, row.available)
        };
        assert_eq!(got(OMP_SUBAGENT_PANES), omp, "{name}: omp");
        assert_eq!(got(CLAUDE_SKILL), claude, "{name}: skill");
        assert!(
            runner
                .args()
                .iter()
                .all(|args| args == &["plugin", "list", "--json"]),
            "{name}: status only lists: {:?}",
            runner.args()
        );
    }
}

/// Turn on: the folder holds the extension and `omp plugin link <folder>` was run; turning it off runs omp's
/// uninstall and removes the folder.
#[test]
fn turn_on_links_the_extension_and_turn_off_uninstalls_it() {
    let scratch = Scratch::new("omp");
    let bin = scratch.bin("bin", &["omp"]);
    let runner = FakeOmp::new(omp_ok);
    let env = scratch.env(vec![bin.clone()], &runner);
    let dir = omp_dir(&scratch.app_data());

    let outcomes = apply(&env, &[on(OMP_SUBAGENT_PANES, true)]);
    assert!(outcomes[0].ok, "{outcomes:?}");
    for (name, text) in OMP_FILES {
        assert_eq!(fs::read_to_string(dir.join(name)).unwrap(), *text, "{name}");
    }
    let runs = runner.runs.borrow().clone();
    assert_eq!(runs.len(), 1);
    let (program, args, _) = &runs[0];
    assert_eq!(program.parent(), Some(bin.as_path()));
    assert_eq!(args, &["plugin", "link", &dir.to_string_lossy()]);
    assert!(row(&status(&env), OMP_SUBAGENT_PANES).installed);

    let outcomes = apply(&env, &[on(OMP_SUBAGENT_PANES, false)]);
    assert!(outcomes[0].ok, "{outcomes:?}");
    assert_eq!(
        runner.args().last().unwrap(),
        &["plugin", "uninstall", OMP_PLUGIN]
    );
    assert!(!dir.exists());
}

/// One fails: with both ticked and linking into omp failing, the skill is installed and the Oh My Pi row has the
/// error, with what omp said, and a fix.
#[test]
fn one_fails_the_skill_is_installed_and_the_omp_row_has_the_error_and_a_fix() {
    let scratch = Scratch::new("one-fails");
    let bin = scratch.bin("bin", &["omp", "claude"]);
    let runner = FakeOmp::new(link_fails);
    let env = scratch.env(vec![bin], &runner);

    let outcomes = apply(
        &env,
        &[on(OMP_SUBAGENT_PANES, true), on(CLAUDE_SKILL, true)],
    );
    let ids: Vec<&str> = outcomes.iter().map(|o| o.id.as_str()).collect();
    assert_eq!(ids, [OMP_SUBAGENT_PANES, CLAUDE_SKILL]);
    let Outcome { ok, error, fix, .. } = &outcomes[0];
    assert!(!ok);
    assert!(
        error.as_deref().unwrap().contains("no bun on PATH"),
        "{error:?}"
    );
    assert!(fix.is_some());
    assert_eq!(
        outcomes[1],
        Outcome {
            id: CLAUDE_SKILL.to_string(),
            ok: true,
            error: None,
            fix: None
        }
    );
    assert_eq!(
        fs::read_to_string(claude_skill::skill_path(&scratch.home())).unwrap(),
        claude_skill::SKILL
    );
    let rows = status(&env);
    assert!(row(&rows, CLAUDE_SKILL).installed);
    assert!(!row(&rows, OMP_SUBAGENT_PANES).installed);
}

/// Changes that cannot be made fail on their own, each with an error and a fix: omp off PATH, no home folder, an
/// unknown integration.
#[test]
fn changes_that_cannot_be_made_say_why() {
    let scratch = Scratch::new("cannot");
    let runner = FakeOmp::new(omp_ok);
    let mut env = scratch.env(vec![scratch.bin("bin", &[])], &runner);
    env.home = None;
    let outcomes = apply(
        &env,
        &[
            on(OMP_SUBAGENT_PANES, true),
            on(OMP_SUBAGENT_PANES, false),
            on(CLAUDE_SKILL, true),
            on("nope", true),
        ],
    );
    for outcome in &outcomes {
        assert!(
            !outcome.ok && outcome.error.is_some() && outcome.fix.is_some(),
            "{outcome:?}"
        );
    }
    assert!(runner.args().is_empty());
    assert!(!omp_dir(&scratch.app_data()).exists());
}

/// Turn off / Turn off without the tool: unticking the skill removes `~/.claude/skills/tiili-tiles` and leaves
/// other skills alone, whether or not `claude` is on PATH.
#[test]
fn turn_off_removes_the_skill_and_leaves_other_skills() {
    let cases: &[(&str, &[&str])] = &[
        ("claude on PATH", &["claude"]),
        ("Turn off without the tool", &[]),
    ];
    for &(name, tools) in cases {
        let scratch = Scratch::new(&format!("skill-off-{}", name.replace(' ', "-")));
        let runner = FakeOmp::new(omp_ok);
        let env = scratch.env(vec![scratch.bin("bin", tools)], &runner);
        let skills = scratch.home().join(".claude").join("skills");
        let other = skills.join("other").join("SKILL.md");
        fs::create_dir_all(other.parent().unwrap()).unwrap();
        fs::write(&other, "mine").unwrap();
        claude_skill::install(&scratch.home()).unwrap();

        let outcomes = apply(&env, &[on(CLAUDE_SKILL, false)]);
        assert!(outcomes[0].ok, "{name}: {outcomes:?}");
        assert!(!skills.join("tiili-tiles").exists(), "{name}");
        assert_eq!(fs::read_to_string(&other).unwrap(), "mine", "{name}");
        // Removing it again is not an error.
        assert!(apply(&env, &[on(CLAUDE_SKILL, false)])[0].ok, "{name}");
    }
}

/// Turn off without the tool: with omp gone from PATH, turning the omp integration off fails with an error and a
/// fix, runs nothing and keeps its folder, so omp is not left linked to a missing one.
#[test]
fn turn_off_without_the_tool_keeps_the_omp_folder_and_says_how() {
    let scratch = Scratch::new("omp-off-missing");
    let runner = FakeOmp::new(omp_ok);
    let env = scratch.env(vec![scratch.bin("bin", &[])], &runner);
    let dir = omp_dir(&scratch.app_data());
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("package.json"), "{}").unwrap();

    let outcomes = apply(&env, &[on(OMP_SUBAGENT_PANES, false)]);
    let Outcome { ok, error, fix, .. } = &outcomes[0];
    assert!(!ok && error.is_some(), "{outcomes:?}");
    assert!(
        fix.as_deref().unwrap().contains(&dir.display().to_string()),
        "{fix:?}"
    );
    assert!(runner.args().is_empty());
    assert!(dir.join("package.json").is_file());
}

/// A tool only the login shell's PATH has is found, and runs from there with the login shell's folders first.
#[test]
fn a_tool_only_on_the_login_shell_path_is_found_and_run() {
    let scratch = Scratch::new("login-path");
    let login = scratch.bin("login", &["omp"]);
    let app = scratch.bin("app", &["claude"]);
    let join = |dirs: &[&Path]| std::env::join_paths(dirs).unwrap();
    // The app's PATH repeats a login folder; it is searched once.
    let path = search_path(
        Some(&join(&[&login, &app])),
        Some(&join(&[&app, Path::new("")])),
    );
    assert_eq!(path, [login.clone(), app.clone()]);
    assert_eq!(
        search_path(None, Some(&join(&[&app]))),
        std::slice::from_ref(&app)
    );

    let runner = FakeOmp::new(omp_ok);
    let env = scratch.env(path, &runner);
    let rows = status(&env);
    assert!(row(&rows, OMP_SUBAGENT_PANES).available, "{rows:?}");
    assert!(row(&rows, CLAUDE_SKILL).available, "{rows:?}");

    assert!(apply(&env, &[on(OMP_SUBAGENT_PANES, true)])[0].ok);
    let runs = runner.runs.borrow();
    let (program, _, run_path) = runs.last().unwrap();
    assert_eq!(program.parent(), Some(login.as_path()));
    assert_eq!(
        std::env::split_paths(run_path).collect::<Vec<_>>(),
        [login.clone(), app.clone()]
    );

    // Without the login shell's PATH, omp is not found.
    let without = scratch.env(vec![app], &runner);
    assert!(!row(&status(&without), OMP_SUBAGENT_PANES).available);
}

/// The login shell's PATH is the last line it prints; a shell that fails or hangs gives none.
#[cfg(unix)]
#[test]
fn login_shell_path_is_read_with_a_timeout() {
    use std::time::{Duration, Instant};
    use tiili_lib::integrations::login_shell_path;

    let scratch = Scratch::new("login-shell");
    // Name, the shell script, the PATH it gives.
    let cases: &[(&str, &str, Option<&str>)] = &[
        (
            "a profile that prints",
            "#!/bin/sh\necho 'Welcome!'\nprintf '\\n/login/bin:/usr/bin\\n'\n",
            Some("/login/bin:/usr/bin"),
        ),
        ("fails", "#!/bin/sh\nexit 1\n", None),
        ("hangs", "#!/bin/sh\nexec sleep 30\n", None),
    ];
    for (name, script, expected) in cases {
        let shell = scratch.0.join(name.replace(' ', "-"));
        fs::write(&shell, script).unwrap();
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&shell, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let started = Instant::now();
        let got = login_shell_path(&shell, Duration::from_millis(500));
        assert_eq!(got.as_deref(), expected.map(OsStr::new), "{name}");
        assert!(started.elapsed() < Duration::from_secs(5), "{name}");
    }
}

/// First run / Update with skill on: a new app version rewrites only the integrations that are installed, without
/// running omp, and installs none; the same version rewrites nothing.
#[test]
fn a_new_version_refreshes_only_installed_integrations() {
    // Name, the stamped version, skill on disk, omp folder on disk, then whether each is rewritten afterwards.
    type Case = (&'static str, Option<&'static str>, bool, bool, bool, bool);
    let cases: &[Case] = &[
        ("First run", None, false, false, false, false),
        (
            "Update with skill on",
            Some("0.1.0"),
            true,
            false,
            true,
            false,
        ),
        (
            "update with omp on",
            Some("0.1.0"),
            false,
            true,
            false,
            true,
        ),
        ("same version", Some("0.2.0"), true, true, false, false),
    ];
    for &(name, stamped, skill, folder, skill_new, omp_new) in cases {
        let scratch = Scratch::new(&name.replace(' ', "-"));
        let (app_data, home) = (scratch.app_data(), scratch.home());
        let skill_path = claude_skill::skill_path(&home);
        let dir = omp_dir(&app_data);
        if let Some(stamped) = stamped {
            fs::create_dir_all(version_stamp(&app_data).parent().unwrap()).unwrap();
            fs::write(version_stamp(&app_data), stamped).unwrap();
        }
        if skill {
            fs::create_dir_all(skill_path.parent().unwrap()).unwrap();
            fs::write(&skill_path, "older").unwrap();
        }
        if folder {
            fs::create_dir_all(&dir).unwrap();
            for (file, _) in OMP_FILES {
                fs::write(dir.join(file), "older").unwrap();
            }
        }

        refresh_installed(&app_data, Some(&home), "0.2.0").unwrap();

        let read = |path: &Path| fs::read_to_string(path).ok();
        let skill_text = if skill_new {
            claude_skill::SKILL
        } else {
            "older"
        };
        assert_eq!(
            read(&skill_path).as_deref(),
            skill.then_some(skill_text),
            "{name}: skill"
        );
        for (file, text) in OMP_FILES {
            let text = if omp_new { *text } else { "older" };
            assert_eq!(
                read(&dir.join(file)).as_deref(),
                folder.then_some(text),
                "{name}: {file}"
            );
        }
        assert_eq!(
            read(&version_stamp(&app_data)).as_deref(),
            Some("0.2.0"),
            "{name}"
        );
    }
}
