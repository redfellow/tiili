// @harvaaja-test-tier: fast
//! Claude Code subagent panes: reading the hook input, the pane it opens, the done markers, and adding tiili's
//! hooks to `~/.claude/settings.json` and taking them out again without touching the user's own settings.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tiili_lib::claude_hook::{
    has_hooks, mark_started, mark_stopped, open_args, parse, set_hooks, settings_path, with_hooks,
    without_hooks, Hook, Markers, HOOK_COMMAND, HOOK_MARK,
};
use tiili_lib::integrations::{apply, status, Change, Env, Ran, Runner, CLAUDE_SUBAGENT_PANES};

/// A scratch folder, removed afterwards.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir =
            std::env::temp_dir().join(format!("tiili-claude-hook-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn markers(dir: &Path, id: &str) -> Markers {
    Markers {
        started: dir.join(format!("{id}.started")),
        done: dir.join(format!("{id}.done")),
    }
}

/// SubagentStart opens a pane keyed to the subagent that follows its transcript; SubagentStop marks it done; helper
/// agents with no type, unsafe ids and other events are ignored. (Shapes as Claude Code sent them.)
#[test]
fn hook_input_becomes_a_start_a_stop_or_nothing() {
    let dir = Path::new("/m");
    let start = json!({
        "session_id": "s1",
        "transcript_path": "/p/s1.jsonl",
        "cwd": "/work",
        "agent_id": "a68a814dc4450571f",
        "agent_type": "Explore",
        "hook_event_name": "SubagentStart",
    });
    let expected = Hook::Start {
        key: "claude-subagent-a68a814dc4450571f".to_string(),
        title: "Explore · a68a814d".to_string(),
        cwd: Some("/work".to_string()),
        file: PathBuf::from("/p/s1/subagents/agent-a68a814dc4450571f.jsonl"),
        markers: markers(dir, "a68a814dc4450571f"),
    };
    assert_eq!(parse(&start.to_string(), dir), expected);

    let mut own_path = start.clone();
    own_path["agent_transcript_path"] = json!("/q/agent.jsonl");
    let Hook::Start { file, .. } = parse(&own_path.to_string(), dir) else {
        panic!("a start");
    };
    assert_eq!(file, PathBuf::from("/q/agent.jsonl"));

    let mut stop = start.clone();
    stop["hook_event_name"] = json!("SubagentStop");
    stop["agent_type"] = json!("");
    assert_eq!(
        parse(&stop.to_string(), dir),
        Hook::Stop(markers(dir, "a68a814dc4450571f"))
    );

    let ignored: Vec<(&str, Value)> = vec![
        ("helper agent", {
            let mut v = start.clone();
            v["agent_type"] = json!("");
            v
        }),
        ("unsafe id", {
            let mut v = start.clone();
            v["agent_id"] = json!("../x");
            v
        }),
        ("other event", {
            let mut v = start.clone();
            v["hook_event_name"] = json!("Stop");
            v
        }),
        ("no transcript", {
            let mut v = start.clone();
            v.as_object_mut().unwrap().remove("transcript_path");
            v
        }),
    ];
    for (name, input) in ignored {
        assert_eq!(parse(&input.to_string(), dir), Hook::Ignore, "{name}");
    }
    assert_eq!(parse("not json", dir), Hook::Ignore);
}

/// The pane is opened with the subagent's key and title in its folder, running `tiili follow` on the transcript with
/// the done marker and, when given, Claude Code's process.
#[test]
fn a_start_opens_a_keyed_pane_running_tiili_follow() {
    let hook = Hook::Start {
        key: "claude-subagent-a1".to_string(),
        title: "Explore · a1".to_string(),
        cwd: Some("/work".to_string()),
        file: PathBuf::from("/p/agent-a1.jsonl"),
        markers: markers(Path::new("/m"), "a1"),
    };
    let done = Path::new("/m").join("a1.done");
    let done = done.to_string_lossy();
    let mut expected = vec![
        "open",
        "--key",
        "claude-subagent-a1",
        "--title",
        "Explore · a1",
        "--cwd",
        "/work",
        "--",
        "tiili",
        "follow",
        "/p/agent-a1.jsonl",
        "--title",
        "Explore · a1",
        "--done",
        &done,
    ];
    assert_eq!(open_args(&hook, None).unwrap(), expected);
    expected.extend(["--pid", "42"]);
    assert_eq!(open_args(&hook, Some(42)).unwrap(), expected);
    assert_eq!(open_args(&Hook::Ignore, None), None);
}

/// A stop marks the subagent done only when its pane was opened; a resumed subagent's old done marker is cleared.
#[test]
fn done_markers_follow_start_and_stop() {
    let scratch = Scratch::new("markers");
    let dir = scratch.0.join("markers");
    let marks = markers(&dir, "a1");

    mark_stopped(&marks).unwrap();
    assert!(!marks.done.exists(), "a stop with no pane leaves nothing");

    mark_started(&marks).unwrap();
    assert!(marks.started.exists() && !marks.done.exists());
    mark_stopped(&marks).unwrap();
    assert!(marks.done.exists() && !marks.started.exists());

    // Resumed: the old done marker goes, so the new pane does not end at once.
    mark_started(&marks).unwrap();
    assert!(!marks.done.exists());
}

/// The user's settings and hooks stay as they were, in their order: tiili's hooks are added once, replaced on a
/// second add, and taking them out gives back the settings it started from.
#[test]
fn hooks_are_added_and_removed_around_the_users_settings() {
    let users = json!({
        "model": "opus",
        "hooks": {
            "SubagentStop": [{"matcher": "Explore", "hooks": [{"type": "command", "command": "say done"}]}],
            "PreToolUse": [{"hooks": [{"type": "command", "command": "lint"}]}],
        },
        "permissions": {"allow": ["Bash(ls)"]},
    });
    assert!(!has_hooks(&users));
    let added = with_hooks(users.clone());
    assert!(has_hooks(&added));
    let start = &added["hooks"]["SubagentStart"];
    assert_eq!(start.as_array().unwrap().len(), 1, "{added:#}");
    assert_eq!(start[0]["hooks"][0]["command"], HOOK_COMMAND);
    assert_eq!(start[0]["hooks"][0]["async"], true);
    let stop = added["hooks"]["SubagentStop"].as_array().unwrap();
    assert_eq!(stop.len(), 2, "the user's stop hook stays: {added:#}");
    assert_eq!(stop[0]["hooks"][0]["command"], "say done");
    assert!(stop[1]["hooks"][0].get("async").is_none());

    assert_eq!(with_hooks(added.clone()), added, "adding twice adds once");
    assert_eq!(without_hooks(added), users);
    assert_eq!(without_hooks(with_hooks(json!({}))), json!({}));
    assert!(HOOK_COMMAND.contains(HOOK_MARK));
}

/// In the file only the `hooks` entry changes: every other entry keeps its place and its text. The file is created
/// when missing, and one that is not a JSON object is reported and left as it was.
#[test]
fn settings_file_is_created_or_left_alone_when_unreadable() {
    let scratch = Scratch::new("settings");
    let home = scratch.0.join("home");
    let path = settings_path(&home);

    assert_eq!(set_hooks(&home, false).unwrap(), path);
    assert!(!path.exists(), "turning off writes no file");
    set_hooks(&home, true).unwrap();
    let written: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert!(has_hooks(&written));
    set_hooks(&home, false).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap().trim(), "{}");

    let users = "{\n  \"model\": \"opus\",\n  \"env\": {\"B\": \"2\", \"A\": \"1\"},\n  \"hooks\": {\"Stop\": [{\"hooks\": [{\"type\": \"command\", \"command\": \"say\"}]}]},\n  \"alwaysThinkingEnabled\": true\n}\n";
    fs::write(&path, users).unwrap();
    set_hooks(&home, true).unwrap();
    let text = fs::read_to_string(&path).unwrap();
    let at = |needle: &str| {
        text.find(needle)
            .unwrap_or_else(|| panic!("{needle} in {text}"))
    };
    assert!(
        at("\"model\"") < at("\"env\"") && at("\"env\"") < at("\"hooks\""),
        "{text}"
    );
    assert!(at("\"hooks\"") < at("\"alwaysThinkingEnabled\""), "{text}");
    assert!(
        text.contains("\"env\": {\"B\": \"2\", \"A\": \"1\"}"),
        "{text}"
    );
    assert!(
        text.contains(HOOK_MARK) && text.contains("\"say\""),
        "{text}"
    );
    set_hooks(&home, false).unwrap();
    let back: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(back, serde_json::from_str::<Value>(users).unwrap());
    assert!(fs::read_to_string(&path)
        .unwrap()
        .contains("{\"B\": \"2\", \"A\": \"1\"}"));

    for broken in ["{ not json", "[1, 2]", r#"{"hooks": []}"#] {
        fs::write(&path, broken).unwrap();
        let err = set_hooks(&home, true).unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidData, "{broken}");
        assert_eq!(fs::read_to_string(&path).unwrap(), broken);
    }
}

/// A runner that is never needed: the Claude Code row runs nothing.
struct NoRunner;

impl Runner for NoRunner {
    fn run(&self, _: &Path, args: &[&str], _: &std::ffi::OsStr) -> std::io::Result<Ran> {
        panic!("ran {args:?}");
    }
}

/// Settings → Integrations: the Claude Code subagent panes row is ticked when the hooks are in the settings, and
/// saving it adds or removes them.
#[test]
fn the_integration_row_installs_and_removes_the_hooks() {
    let scratch = Scratch::new("row");
    let home = scratch.0.join("home");
    let env = Env {
        app_data: scratch.0.join("app-data"),
        home: Some(home.clone()),
        path: Vec::new(),
        runner: &NoRunner,
    };
    let row = |env: &Env| {
        status(env)
            .into_iter()
            .find(|row| row.id == CLAUDE_SUBAGENT_PANES)
            .unwrap()
    };
    let before = row(&env);
    assert!(!before.installed && !before.available, "{before:?}");
    assert_eq!(before.location, settings_path(&home).display().to_string());

    let change = |on| {
        apply(
            &env,
            &[Change {
                id: CLAUDE_SUBAGENT_PANES.to_string(),
                on,
            }],
        )
    };
    assert!(change(true)[0].ok);
    assert!(row(&env).installed);
    assert!(change(false)[0].ok);
    assert!(!row(&env).installed);

    fs::write(settings_path(&home), "{ broken").unwrap();
    let failed = &change(true)[0];
    assert!(!failed.ok);
    assert!(
        failed.fix.as_deref().unwrap().contains("valid JSON"),
        "{failed:?}"
    );
}

/// Refresh on app update: hooks an older tiili added are replaced with this version's; none are added when absent.
#[test]
fn a_new_version_rewrites_installed_hooks_only() {
    let scratch = Scratch::new("refresh");
    let (app_data, home) = (scratch.0.join("app-data"), scratch.0.join("home"));
    tiili_lib::integrations::refresh_installed(&app_data, Some(&home), "0.2.0").unwrap();
    assert!(!settings_path(&home).exists());

    let old = json!({"hooks": {"SubagentStart": [{"hooks": [{"type": "command", "command": "tiili claude-hook --old"}]}]}});
    fs::create_dir_all(settings_path(&home).parent().unwrap()).unwrap();
    fs::write(settings_path(&home), old.to_string()).unwrap();
    tiili_lib::integrations::refresh_installed(&app_data, Some(&home), "0.3.0").unwrap();
    let now: Value =
        serde_json::from_str(&fs::read_to_string(settings_path(&home)).unwrap()).unwrap();
    assert_eq!(now, with_hooks(json!({})));
}
