//! Claude Code subagent panes: `tiili claude-hook [--pid PID]` is the command of Claude Code's `SubagentStart` and
//! `SubagentStop` hooks, and this module installs those hooks into `~/.claude/settings.json` for Settings →
//! Integrations (src/integrations.rs).
//!
//! On `SubagentStart` the hook opens a pane beside the one Claude Code runs in, keyed to the subagent, that runs
//! `tiili follow` on the subagent's transcript (`<session>/subagents/agent-<id>.jsonl`) with a done marker in the temp
//! folder and Claude Code's process id. On `SubagentStop` it creates that marker, so the pane says the subagent
//! finished and closes. A Claude Code transcript has no end record of its own, which is why the marker is needed.
//!
//! The hook reads the hook's JSON input on stdin. Outside a tiili pane (no `TIILI_SOCKET`), with
//! `TIILI_SUBAGENT_PANES=0`, or for anything it does not recognise, it does nothing and prints nothing.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::de::{Deserialize, Deserializer, MapAccess, Visitor};
use serde_json::value::RawValue;
use serde_json::{json, Map, Value};

/// Set to `0` to keep subagents out of panes; the omp extension reads it too.
pub const PANES_VAR: &str = "TIILI_SUBAGENT_PANES";

/// What every hook command tiili installs contains, so its own entries can be told from the user's.
pub const HOOK_MARK: &str = "tiili claude-hook";

/// The hook command: nothing outside a tiili pane (so no error when `tiili` is not on `PATH`), else `tiili
/// claude-hook` with the hook's parent, Claude Code, as the process to watch.
pub const HOOK_COMMAND: &str = r#"[ -z "$TIILI_SOCKET" ] || tiili claude-hook --pid "$PPID""#;

/// The hook events tiili installs its command for, and whether each runs in the background (`async`): opening a
/// pane must not hold up the subagent, while the stop marker is quick and should land before Claude Code moves on.
pub const HOOK_EVENTS: &[(&str, bool)] = &[("SubagentStart", true), ("SubagentStop", false)];

/// What one hook call asks for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Hook {
    /// A subagent started (or was resumed): open its pane, or reuse the one still open for it.
    Start {
        /// The pane's key, one per subagent.
        key: String,
        title: String,
        cwd: Option<String>,
        /// The subagent's transcript.
        file: PathBuf,
        markers: Markers,
    },
    /// A subagent stopped: mark it done, if tiili opened a pane for it.
    Stop(Markers),
    /// Not a subagent hook tiili acts on.
    Ignore,
}

/// The files that say a subagent's pane was opened and that the subagent is done.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Markers {
    pub started: PathBuf,
    pub done: PathBuf,
}

/// The folder the markers go in: `tiili-claude-subagents` in the temp folder.
pub fn marker_dir() -> PathBuf {
    std::env::temp_dir().join("tiili-claude-subagents")
}

/// Whether `id` is safe in a file name and a pane key: letters, digits, `-` and `_`.
fn plain_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// The hook call that JSON `input` describes, with markers in `markers`. Claude Code's own helper agents (prompt
/// suggestions and the like) come with no agent type and are ignored.
pub fn parse(input: &str, markers: &Path) -> Hook {
    let Ok(input) = serde_json::from_str::<Value>(input) else {
        return Hook::Ignore;
    };
    let text = |key: &str| input[key].as_str().filter(|s| !s.is_empty());
    let Some(id) = text("agent_id").filter(|id| plain_id(id)) else {
        return Hook::Ignore;
    };
    let marks = Markers {
        started: markers.join(format!("{id}.started")),
        done: markers.join(format!("{id}.done")),
    };
    match text("hook_event_name") {
        Some("SubagentStart") => {
            let Some(agent) = text("agent_type") else {
                return Hook::Ignore;
            };
            let file = match (text("agent_transcript_path"), text("transcript_path")) {
                (Some(own), _) => PathBuf::from(own),
                // `<session>.jsonl` keeps its subagents in `<session>/subagents/`.
                (None, Some(session)) => Path::new(session)
                    .with_extension("")
                    .join("subagents")
                    .join(format!("agent-{id}.jsonl")),
                (None, None) => return Hook::Ignore,
            };
            let short: String = id.chars().take(8).collect();
            Hook::Start {
                key: format!("claude-subagent-{id}"),
                title: format!("{agent} · {short}"),
                cwd: text("cwd").map(str::to_string),
                file,
                markers: marks,
            }
        }
        Some("SubagentStop") => Hook::Stop(marks),
        _ => Hook::Ignore,
    }
}

/// The `tiili open …` arguments that open a started subagent's pane; `pid` is the process to watch.
pub fn open_args(hook: &Hook, pid: Option<u32>) -> Option<Vec<String>> {
    let Hook::Start {
        key,
        title,
        cwd,
        file,
        markers,
    } = hook
    else {
        return None;
    };
    let mut args: Vec<String> = vec!["open".into(), "--key".into(), key.clone()];
    args.extend(["--title".into(), title.clone()]);
    if let Some(cwd) = cwd {
        args.extend(["--cwd".into(), cwd.clone()]);
    }
    args.extend(["--".into(), "tiili".into(), "follow".into()]);
    args.push(file.to_string_lossy().into_owned());
    args.extend(["--title".into(), title.clone()]);
    args.extend(["--done".into(), markers.done.to_string_lossy().into_owned()]);
    if let Some(pid) = pid {
        args.extend(["--pid".into(), pid.to_string()]);
    }
    Some(args)
}

/// The process id a hook was given, when it can be watched. Windows runs hooks in Git Bash, whose `$PPID` is not a
/// Windows process id, so there the done marker alone ends following.
pub fn watchable_pid(pid: Option<u32>) -> Option<u32> {
    pid.filter(|&pid| pid > 1 && cfg!(unix))
}

/// Records that a subagent's pane is being opened: a resumed subagent's old done marker is removed so its pane does
/// not end at once.
pub fn mark_started(markers: &Markers) -> io::Result<()> {
    if let Some(dir) = markers.started.parent() {
        fs::create_dir_all(dir)?;
    }
    remove(&markers.done)?;
    fs::write(&markers.started, "")
}

/// Marks a subagent done when tiili opened a pane for it; one without a pane leaves nothing behind.
pub fn mark_stopped(markers: &Markers) -> io::Result<()> {
    if !markers.started.exists() {
        return Ok(());
    }
    fs::write(&markers.done, "")?;
    remove(&markers.started)
}

fn remove(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Err(err) if err.kind() != io::ErrorKind::NotFound => Err(err),
        _ => Ok(()),
    }
}

/// Where Claude Code's user settings are under a home folder: `<home>/.claude/settings.json`.
pub fn settings_path(home: &Path) -> PathBuf {
    home.join(".claude").join("settings.json")
}

/// Whether a hook handler is one tiili installed.
fn is_ours(handler: &Value) -> bool {
    handler["command"]
        .as_str()
        .is_some_and(|command| command.contains(HOOK_MARK))
}

/// Whether `settings` holds tiili's `SubagentStart` hook.
pub fn has_hooks(settings: &Value) -> bool {
    settings["hooks"]["SubagentStart"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|group| group["hooks"].as_array())
        .flatten()
        .any(is_ours)
}

/// `settings` without tiili's hook handlers, dropping hook groups and events left empty. Everything else stays as
/// it was, in its order.
pub fn without_hooks(mut settings: Value) -> Value {
    let Some(hooks) = settings.get_mut("hooks").and_then(Value::as_object_mut) else {
        return settings;
    };
    for (_, groups) in hooks.iter_mut() {
        let Some(list) = groups.as_array_mut() else {
            continue;
        };
        list.retain_mut(|group| {
            let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else {
                return true;
            };
            let before = handlers.len();
            handlers.retain(|handler| !is_ours(handler));
            !(handlers.is_empty() && before > 0)
        });
    }
    hooks.retain(|_, groups| !groups.as_array().is_some_and(Vec::is_empty));
    if hooks.is_empty() {
        if let Some(object) = settings.as_object_mut() {
            object.remove("hooks");
        }
    }
    settings
}

/// `settings` with tiili's hooks, replacing any it had: one group per event in [`HOOK_EVENTS`].
pub fn with_hooks(settings: Value) -> Value {
    let mut settings = without_hooks(settings);
    if !settings.is_object() {
        settings = Value::Object(Map::new());
    }
    let object = settings.as_object_mut().expect("settings is an object");
    let hooks = object
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    if !hooks.is_object() {
        *hooks = Value::Object(Map::new());
    }
    let hooks = hooks.as_object_mut().expect("hooks is an object");
    for (event, background) in HOOK_EVENTS {
        let mut handler = json!({"type": "command", "command": HOOK_COMMAND, "timeout": 30});
        if *background {
            handler["async"] = Value::Bool(true);
        }
        let groups = hooks
            .entry(*event)
            .or_insert_with(|| Value::Array(Vec::new()));
        if !groups.is_array() {
            *groups = Value::Array(Vec::new());
        }
        groups
            .as_array_mut()
            .expect("groups is an array")
            .push(json!({"hooks": [handler]}));
    }
    settings
}

/// The settings file at `path` as text: empty when it does not exist.
fn read_text(path: &Path) -> io::Result<String> {
    match fs::read_to_string(path) {
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(String::new()),
        read => read,
    }
}

fn invalid(why: impl Into<Box<dyn std::error::Error + Send + Sync>>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, why)
}

/// Settings text as JSON: an empty object when blank, an error unless it is an object whose `hooks`, if any, is an
/// object too.
fn parse_settings(text: &str) -> io::Result<Value> {
    if text.trim().is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    let settings: Value = serde_json::from_str(text).map_err(invalid)?;
    if !settings.is_object()
        || settings
            .get("hooks")
            .is_some_and(|hooks| !hooks.is_object())
    {
        return Err(invalid("it is not a JSON object with a \"hooks\" object"));
    }
    Ok(settings)
}

/// The entries of a JSON object, in the order written, each value as its original text.
struct Entries(Vec<(String, Box<RawValue>)>);

impl<'de> Deserialize<'de> for Entries {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Visit;
        impl<'de> Visitor<'de> for Visit {
            type Value = Entries;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a JSON object")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Entries, A::Error> {
                let mut entries = Vec::new();
                while let Some(entry) = map.next_entry()? {
                    entries.push(entry);
                }
                Ok(Entries(entries))
            }
        }
        deserializer.deserialize_map(Visit)
    }
}

/// JSON object `text` with its `hooks` entry set to `hooks`, or taken out when `None`. Every other entry keeps its
/// place and its text as written, so tiili leaves the rest of a user's settings exactly as they were.
pub fn replace_hooks(text: &str, hooks: Option<&Value>) -> io::Result<String> {
    let text = if text.trim().is_empty() { "{}" } else { text };
    let Entries(entries) = serde_json::from_str(text).map_err(invalid)?;
    let pretty = |value: &Value| -> io::Result<String> {
        let text = serde_json::to_string_pretty(value).map_err(io::Error::other)?;
        Ok(text.replace('\n', "\n  "))
    };
    let mut lines = Vec::new();
    let mut placed = false;
    for (key, raw) in &entries {
        let value = if key == "hooks" {
            if placed {
                continue;
            }
            placed = true;
            match hooks {
                Some(hooks) => pretty(hooks)?,
                None => continue,
            }
        } else {
            raw.get().to_string()
        };
        lines.push(format!("  {}: {value}", Value::String(key.clone())));
    }
    if let (false, Some(hooks)) = (placed, hooks) {
        lines.push(format!("  \"hooks\": {}", pretty(hooks)?));
    }
    Ok(if lines.is_empty() {
        "{}\n".to_string()
    } else {
        format!("{{\n{}\n}}\n", lines.join(",\n"))
    })
}

/// Writes `text` to `path`, creating its folder; through a temporary file beside it, so a failed write never leaves
/// Claude Code half a settings file.
fn write_text(path: &Path, text: &str) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let temporary = path.with_extension("json.tiili-tmp");
    fs::write(&temporary, text)?;
    fs::rename(&temporary, path)
}

/// Adds tiili's hooks to the Claude Code settings under `home` (replacing older ones), or removes them, changing
/// only the file's `hooks` entry. Returns the settings file. A file that is not a JSON object is left as it is and
/// reported as [`io::ErrorKind::InvalidData`].
pub fn set_hooks(home: &Path, on: bool) -> io::Result<PathBuf> {
    let path = settings_path(home);
    let text = read_text(&path)?;
    let settings = parse_settings(&text)?;
    let changed = if on {
        with_hooks(settings.clone())
    } else {
        without_hooks(settings.clone())
    };
    if changed != settings || (on && text.trim().is_empty()) {
        write_text(&path, &replace_hooks(&text, changed.get("hooks"))?)?;
    }
    Ok(path)
}

/// Whether the Claude Code settings under `home` hold tiili's hooks; a missing or unreadable file holds none.
pub fn installed(home: &Path) -> bool {
    read_text(&settings_path(home))
        .and_then(|text| parse_settings(&text))
        .is_ok_and(|settings| has_hooks(&settings))
}
