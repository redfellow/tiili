//! The pane control protocol, free of sockets so it can be tested: what a request to the running app looks like,
//! the token check, the replies and the `tiili` command line. The control server
//! ([`control_server`](crate::control_server)) and the CLI ([`cli`](crate::cli)) carry it out.
//!
//! A request is one JSON line, `{"protocol":1,"token","pane","op":"open"|"list"|"attention"|"close",...}`; the reply
//! is one JSON line, `{"ok":true,"protocol":1,"pane":7,"reused":false}`, `{"ok":true,"protocol":1,"panes":[...]}`,
//! `{"ok":true,"protocol":1,"done":true}` or `{"ok":false,"protocol":1,"code","error","suggestion"}`. The command line is one table, [`COMMANDS`], and its
//! failures one, [`ERRORS`].

use serde::{Deserialize, Serialize};

use crate::pty::SessionId;

/// The variable naming the control endpoint (socket path or pipe name) in every pane.
pub const SOCKET_VAR: &str = "TIILI_SOCKET";
/// The variable holding this run's token in every pane.
pub const TOKEN_VAR: &str = "TIILI_TOKEN";
/// The variable holding the pane's own session id.
pub const PANE_VAR: &str = "TIILI_PANE";

/// What a request asks for.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Op {
    /// Open a pane in the caller's window running `command` in `cwd`, titled `title`; `path` is the caller's `PATH`,
    /// which the command is looked up on and runs with (the app's own when absent).
    Open {
        cwd: Option<String>,
        title: Option<String>,
        command: Vec<String>,
        #[serde(default)]
        path: Option<String>,
        /// Reuse the caller's live pane opened with this key instead of opening another.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        key: Option<String>,
    },
    /// List the panes of the caller's window.
    List,
    /// Mark the caller's own pane for attention with `message`, or clear its mark.
    Attention {
        #[serde(default)]
        message: Option<String>,
        #[serde(default)]
        clear: bool,
    },
    /// Close pane `target`, which the caller must have opened. (Not `pane`: that is the caller.)
    Close { target: SessionId },
}

/// A request that passed the token check: the caller's pane and what it asks for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Request {
    pub pane: SessionId,
    pub op: Op,
}

#[derive(Serialize)]
struct WireRequest<'a> {
    protocol: u32,
    token: &'a str,
    pane: SessionId,
    #[serde(flatten)]
    op: &'a Op,
}

#[derive(Deserialize)]
struct Body {
    pane: SessionId,
    #[serde(flatten)]
    op: Op,
}

/// The control protocol version every request and reply carries; nothing compares it yet.
pub const PROTOCOL: u32 = 1;

/// A `tiili` failure's stable code and what it means: the exit code, when it happens and the fix to suggest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ErrorSpec {
    pub code: &'static str,
    pub exit: i32,
    pub summary: &'static str,
    pub suggestion: &'static str,
}

/// Every error `tiili` reports, once, by code. [`CliError`] and `tiili describe` read it.
pub const ERRORS: &[ErrorSpec] = &[
    ErrorSpec {
        code: "usage",
        exit: 2,
        summary: "the arguments are not a tiili command",
        suggestion: "run tiili help to see the commands",
    },
    ErrorSpec {
        code: "not_in_pane",
        exit: 3,
        summary: "TIILI_SOCKET or TIILI_PANE is not set, or TIILI_PANE is not a pane id",
        suggestion: "run tiili from a pane of the running tiili app",
    },
    ErrorSpec {
        code: "unreachable",
        exit: 4,
        summary: "the tiili app at TIILI_SOCKET could not be reached",
        suggestion: "check that the tiili app that opened this pane is still running",
    },
    ErrorSpec {
        code: "bad_token",
        exit: 1,
        summary: "the app refused the request: TIILI_TOKEN is missing or not this run's",
        suggestion: "run tiili from a pane of the running tiili app",
    },
    ErrorSpec {
        code: "malformed_request",
        exit: 1,
        summary: "the app could not read the request",
        suggestion: "use the tiili command of the running app, so both speak the same protocol",
    },
    ErrorSpec {
        code: "open_failed",
        exit: 1,
        summary: "the app could not open the pane",
        suggestion: "check that the command is on PATH and the folder exists",
    },
    ErrorSpec {
        code: "list_failed",
        exit: 1,
        summary: "the app could not list the panes",
        suggestion: "check that this pane is still open in a tiili window",
    },
    ErrorSpec {
        code: "bad_reply",
        exit: 1,
        summary: "the app sent a reply tiili could not read, or one without an error code",
        suggestion: "restart the tiili app, or update it to match this tiili command",
    },
    ErrorSpec {
        code: "install_failed",
        exit: 1,
        summary: "the skill could not be written under the home folder",
        suggestion:
            "set HOME (USERPROFILE on Windows) to a home folder you can write to and run it again",
    },
    ErrorSpec {
        code: "not_opened_by_you",
        exit: 1,
        summary: "the pane to close was not opened by this pane with tiili open",
        suggestion: "ask the user to close it",
    },
    ErrorSpec {
        code: "no_such_pane",
        exit: 1,
        summary: "no open pane has that id",
        suggestion: "run tiili list to see the open panes",
    },
    ErrorSpec {
        code: "attention_failed",
        exit: 1,
        summary: "the app could not mark or clear this pane",
        suggestion: "check that this pane is still open in a tiili window",
    },
    ErrorSpec {
        code: "close_failed",
        exit: 1,
        summary: "the app could not close the pane",
        suggestion: "check that the pane is still open, or ask the user to close it",
    },
];

/// Why a `tiili` command failed, in the app or on the command line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CliError {
    /// The arguments are wrong; the text says how.
    Usage(String),
    /// Not inside a tiili pane; the text says which variable is missing or wrong.
    NotInPane(String),
    /// The app could not be reached; the text says where and why.
    Unreachable(String),
    /// The token is missing or not this run's.
    BadToken,
    /// The line is not a valid control message.
    Malformed(String),
    /// The app could not open the pane.
    OpenFailed(String),
    /// The app could not list the panes.
    ListFailed(String),
    /// The app's reply could not be read, or carried no known code.
    BadReply(String),
    /// The Claude skill could not be installed.
    InstallFailed(String),
    /// The pane to close was not opened by the caller; the text names it.
    NotOpenedByYou(String),
    /// No open pane has the id; the text names it.
    NoSuchPane(String),
    /// The app could not mark or clear the caller's pane.
    AttentionFailed(String),
    /// The app could not close the pane.
    CloseFailed(String),
    /// An error the app replied with, carrying the app's own suggestion, which may differ from this binary's
    /// [`ERRORS`] when the two are different versions.
    FromApp {
        error: Box<CliError>,
        suggestion: String,
    },
}

impl CliError {
    /// The stable code, one of [`ERRORS`].
    pub fn code(&self) -> &'static str {
        match self {
            CliError::Usage(_) => "usage",
            CliError::NotInPane(_) => "not_in_pane",
            CliError::Unreachable(_) => "unreachable",
            CliError::BadToken => "bad_token",
            CliError::Malformed(_) => "malformed_request",
            CliError::OpenFailed(_) => "open_failed",
            CliError::ListFailed(_) => "list_failed",
            CliError::BadReply(_) => "bad_reply",
            CliError::InstallFailed(_) => "install_failed",
            CliError::NotOpenedByYou(_) => "not_opened_by_you",
            CliError::NoSuchPane(_) => "no_such_pane",
            CliError::AttentionFailed(_) => "attention_failed",
            CliError::CloseFailed(_) => "close_failed",
            CliError::FromApp { error, .. } => error.code(),
        }
    }

    fn spec(&self) -> &'static ErrorSpec {
        let code = self.code();
        ERRORS
            .iter()
            .find(|e| e.code == code)
            .expect("every error code is in ERRORS")
    }

    /// The process exit code.
    pub fn exit(&self) -> i32 {
        self.spec().exit
    }

    /// The fix to suggest: the app's own for an error it replied with, else this binary's from [`ERRORS`].
    pub fn suggestion(&self) -> &str {
        match self {
            CliError::FromApp { suggestion, .. } => suggestion,
            _ => self.spec().suggestion,
        }
    }

    /// What went wrong, without the `tiili:` prefix.
    pub fn message(&self) -> String {
        match self {
            CliError::Usage(why) => why.clone(),
            CliError::NotInPane(why) => format!("not inside a tiili pane ({why})"),
            CliError::Unreachable(why) => format!("could not reach tiili at {why}"),
            CliError::BadToken => "wrong or missing token".to_string(),
            CliError::Malformed(why) => format!("malformed request: {why}"),
            CliError::OpenFailed(why)
            | CliError::ListFailed(why)
            | CliError::BadReply(why)
            | CliError::InstallFailed(why)
            | CliError::NotOpenedByYou(why)
            | CliError::NoSuchPane(why)
            | CliError::AttentionFailed(why)
            | CliError::CloseFailed(why) => why.clone(),
            CliError::FromApp { error, .. } => error.message(),
        }
    }

    /// The error an app reply with `code`, `message` and `suggestion` stands for; a missing or unknown code is a
    /// bad reply that keeps the app's message. The reply's suggestion, when it has one, is the one to print.
    fn from_reply(code: Option<&str>, message: String, suggestion: Option<String>) -> CliError {
        let error = match code {
            Some("bad_token") => CliError::BadToken,
            Some("malformed_request") => CliError::Malformed(
                message
                    .strip_prefix("malformed request: ")
                    .map(str::to_string)
                    .unwrap_or(message),
            ),
            Some("open_failed") => CliError::OpenFailed(message),
            Some("list_failed") => CliError::ListFailed(message),
            Some("not_opened_by_you") => CliError::NotOpenedByYou(message),
            Some("no_such_pane") => CliError::NoSuchPane(message),
            Some("attention_failed") => CliError::AttentionFailed(message),
            Some("close_failed") => CliError::CloseFailed(message),
            _ => CliError::BadReply(message),
        };
        match suggestion.filter(|s| !s.is_empty()) {
            Some(suggestion) => CliError::FromApp {
                error: Box::new(error),
                suggestion,
            },
            None => error,
        }
    }
}

/// Whether `given` is this run's `token`, compared in time that does not depend on where they differ. An empty
/// token never matches.
pub fn check_token(given: &str, token: &str) -> bool {
    !token.is_empty() && crate::bridge::same(given.as_bytes(), token.as_bytes())
}

/// Reads one request line and checks its token against this run's `token` before anything else in it.
pub fn parse_request(line: &str, token: &str) -> Result<Request, CliError> {
    let value: serde_json::Value =
        serde_json::from_str(line).map_err(|e| CliError::Malformed(e.to_string()))?;
    let object = value
        .as_object()
        .ok_or_else(|| CliError::Malformed("not an object".into()))?;
    match object.get("token").and_then(|t| t.as_str()) {
        Some(given) if check_token(given, token) => {}
        _ => return Err(CliError::BadToken),
    }
    let body: Body =
        serde_json::from_value(value).map_err(|e| CliError::Malformed(e.to_string()))?;
    match &body.op {
        Op::Open { command, .. } if command.is_empty() || command[0].is_empty() => {
            return Err(CliError::Malformed("no command to run".into()));
        }
        Op::Open { key: Some(key), .. } if key.is_empty() => {
            return Err(CliError::Malformed("an empty key".into()));
        }
        Op::Attention {
            message: Some(_),
            clear: true,
        } => return Err(CliError::Malformed("a message with clear".into())),
        _ => {}
    }
    Ok(Request {
        pane: body.pane,
        op: body.op,
    })
}

/// The request line the CLI sends for `op` from pane `pane`, with the `token` it found.
pub fn request_line(token: &str, pane: SessionId, op: &Op) -> String {
    serde_json::to_string(&WireRequest {
        protocol: PROTOCOL,
        token,
        pane,
        op,
    })
    .unwrap_or_default()
}

/// A pane as `tiili list` shows it. Every field is sent, `null` when unknown; one missing from an older app's reply
/// reads as its default.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(default)]
pub struct PaneInfo {
    pub id: SessionId,
    /// Whether this is the pane the request came from.
    #[serde(rename = "self")]
    pub is_self: bool,
    /// The label of the window the pane is in.
    pub window: String,
    pub cwd: String,
    /// The host a remote pane is on; `None` for this machine.
    pub host: Option<String>,
    pub repo: Option<RepoRecord>,
    /// The title `tiili open --title` gave the pane.
    pub title: Option<String>,
    /// The pane's chip name.
    pub label: String,
    /// What runs in the pane; `None` at the prompt.
    pub running: Option<RunningRecord>,
    /// The pane's attention mark, when it has one.
    pub attention: Option<AttentionRecord>,
    /// The tab it is in, counting from 1.
    pub tab: Option<u32>,
    /// The key it was opened with by `tiili open --key`.
    pub key: Option<String>,
    /// Whether the pane the request came from opened it with `tiili open`, so may close it.
    pub opened_by_you: bool,
}

/// A pane's repository: root folder, name and, in a linked worktree, its branch or worktree name.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(default)]
pub struct RepoRecord {
    pub root: String,
    pub name: String,
    pub worktree: Option<String>,
}

/// What runs in a pane: its command line and the foreground program's name, each when known.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(default)]
pub struct RunningRecord {
    pub command: Option<String>,
    pub program: Option<String>,
}

/// A pane's attention mark and the message it came with.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(default)]
pub struct AttentionRecord {
    pub message: Option<String>,
}

/// A successful reply, its fields in the order they are printed.
#[derive(Serialize, Default)]
struct Success<'a> {
    ok: bool,
    protocol: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pane: Option<SessionId>,
    /// Set, to true, only when a keyed open found its pane already open.
    #[serde(skip_serializing_if = "Option::is_none")]
    reused: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    panes: Option<&'a [PaneInfo]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    done: Option<bool>,
}

/// The reply to an open that made pane `id`, or found it already open under its key (`reused`).
pub fn opened_reply(id: SessionId, reused: bool) -> String {
    serde_json::to_string(&Success {
        ok: true,
        protocol: PROTOCOL,
        pane: Some(id),
        reused: reused.then_some(true),
        ..Success::default()
    })
    .unwrap_or_default()
}

/// The reply to an attention or close that was carried out.
pub fn done_reply() -> String {
    serde_json::to_string(&Success {
        ok: true,
        protocol: PROTOCOL,
        done: Some(true),
        ..Success::default()
    })
    .unwrap_or_default()
}

/// The reply to a list.
pub fn listed_reply(panes: &[PaneInfo]) -> String {
    serde_json::to_string(&Success {
        ok: true,
        protocol: PROTOCOL,
        panes: Some(panes),
        ..Success::default()
    })
    .unwrap_or_default()
}

/// A failure, its fields in the order they are printed.
#[derive(Serialize)]
struct Failure<'a> {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    protocol: Option<u32>,
    code: &'a str,
    error: String,
    suggestion: &'a str,
}

impl<'a> Failure<'a> {
    fn of(error: &'a CliError, protocol: Option<u32>) -> String {
        serde_json::to_string(&Failure {
            ok: false,
            protocol,
            code: error.code(),
            error: error.message(),
            suggestion: error.suggestion(),
        })
        .unwrap_or_default()
    }
}

/// What `tiili list --json` and `tiili open --json` print on stdout when they fail: the error's code, message and
/// suggestion.
pub fn error_envelope(error: &CliError) -> String {
    Failure::of(error, None)
}

/// The reply to a refused or failed request: its code, message and suggestion.
pub fn error_reply(error: &CliError) -> String {
    Failure::of(error, Some(PROTOCOL))
}

/// A reply as the CLI reads it.
#[derive(Debug, PartialEq, Eq)]
pub enum Reply {
    Opened { pane: SessionId, reused: bool },
    Listed(Vec<PaneInfo>),
    Done,
}

#[derive(Deserialize)]
struct WireReply {
    ok: bool,
    pane: Option<SessionId>,
    #[serde(default)]
    reused: bool,
    #[serde(default)]
    done: bool,
    panes: Option<Vec<PaneInfo>>,
    error: Option<String>,
    code: Option<String>,
    suggestion: Option<String>,
}

/// What an unreadable reply is reported as.
fn unreadable() -> CliError {
    CliError::BadReply("tiili sent an unreadable reply".to_string())
}

/// Reads a reply line; a refusal, a failure or anything malformed is the error to show. A reply's code picks the
/// error and its suggestion is the one shown; a reply without a code, from an older app, is a bad reply that keeps
/// the app's message, and one without a suggestion falls back to this binary's [`ERRORS`].
pub fn parse_reply(line: &str) -> Result<Reply, CliError> {
    let reply: WireReply = serde_json::from_str(line).map_err(|_| unreadable())?;
    match reply {
        WireReply {
            ok: true,
            pane: Some(pane),
            reused,
            ..
        } => Ok(Reply::Opened { pane, reused }),
        WireReply {
            ok: true,
            panes: Some(panes),
            ..
        } => Ok(Reply::Listed(panes)),
        WireReply {
            ok: true,
            done: true,
            ..
        } => Ok(Reply::Done),
        WireReply {
            ok: false,
            error: Some(error),
            code,
            suggestion,
            ..
        } => Err(CliError::from_reply(code.as_deref(), error, suggestion)),
        _ => Err(unreadable()),
    }
}

/// `tiili list`'s output: one line per pane, id, folder and title (its chip name when it has none) separated by tabs.
pub fn list_lines(panes: &[PaneInfo]) -> String {
    panes
        .iter()
        .map(|p| {
            let title = p.title.as_deref().unwrap_or(&p.label);
            format!("{}\t{}\t{title}\n", p.id, p.cwd)
        })
        .collect()
}

/// A window's `sessions` in the grid order its frontend last reported (`grid`, left to right, top to bottom); sessions
/// it has not reported yet follow in the order given, and reported sessions no longer in the window are left out.
pub fn grid_order(sessions: Vec<SessionId>, grid: &[SessionId]) -> Vec<SessionId> {
    let mut ordered: Vec<SessionId> = grid
        .iter()
        .copied()
        .filter(|id| sessions.contains(id))
        .collect();
    ordered.extend(sessions.into_iter().filter(|id| !grid.contains(id)));
    ordered
}

/// A pane's chip name as the frontend shows it: the repository's name, with ` › worktree` in a linked worktree,
/// else the folder's name; `host:` before it in a remote pane.
pub fn place_name(cwd: &str, repo: Option<(&str, Option<&str>)>, host: Option<&str>) -> String {
    let name = match repo {
        Some((name, Some(worktree))) => format!("{name} › {worktree}"),
        Some((name, None)) => name.to_string(),
        None => cwd
            .split(['/', '\\'])
            .rfind(|part| !part.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| cwd.to_string()),
    };
    match host {
        Some(host) => format!("{host}:{name}"),
        None => name,
    }
}

/// A new random token for this run: 32 bytes from the OS as 64 hex characters.
pub fn new_token() -> std::io::Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

/// What `tiili ARGS` asks for.
#[derive(Debug, PartialEq, Eq)]
pub enum CliCommand {
    Open {
        cwd: Option<String>,
        title: Option<String>,
        key: Option<String>,
        command: Vec<String>,
        json: bool,
    },
    List {
        json: bool,
    },
    /// `tiili attention [MSG]` or `tiili attention --clear`.
    Attention {
        message: Option<String>,
        clear: bool,
    },
    /// `tiili close PANE`.
    Close(SessionId),
    /// `tiili prompt`.
    Prompt,
    InstallClaudeSkill,
    /// `tiili describe [CMD]`.
    Describe(Option<String>),
    /// `tiili help [CMD]`, `--help` or `-h`.
    Help(Option<String>),
    /// `tiili --version`.
    Version,
}

/// An option a command takes before `--`, with the placeholder for its value; a flag has none.
#[derive(Debug, Clone, Copy)]
pub struct OptSpec {
    pub name: &'static str,
    pub value: Option<&'static str>,
    pub summary: &'static str,
}

/// A positional argument, or the words after `--`.
#[derive(Debug, Clone, Copy)]
pub struct ArgSpec {
    pub name: &'static str,
    pub required: bool,
    pub summary: &'static str,
}

/// One `tiili` command: how it is called, what it needs, prints and fails with.
#[derive(Debug, Clone, Copy)]
pub struct CommandSpec {
    pub name: &'static str,
    pub summary: &'static str,
    pub usage: &'static str,
    pub options: &'static [OptSpec],
    pub positionals: &'static [ArgSpec],
    /// The words after `--`, when the command takes them.
    pub rest: Option<ArgSpec>,
    /// The variables it needs set.
    pub needs: &'static [&'static str],
    /// What it prints on stdout.
    pub output_text: &'static str,
    /// The JSON schema of its stdout, when that is JSON.
    pub output_schema: Option<&'static str>,
    pub exit_codes: &'static [i32],
    /// The codes of the [`ERRORS`] it can fail with.
    pub errors: &'static [&'static str],
}

/// The variables a command run inside a pane needs.
const PANE_NEEDS: &[&str] = &[SOCKET_VAR, TOKEN_VAR, PANE_VAR];

/// The JSON schema of `tiili describe`'s output.
const DESCRIBE_OUTPUT_SCHEMA: &str = r#"{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schema", "version", "protocol", "env", "commands", "intents"],
  "properties": {
    "schema": { "const": "tiili.describe/1" },
    "version": { "type": "string" },
    "protocol": { "type": "integer" },
    "env": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "summary"],
        "properties": { "name": { "type": "string" }, "summary": { "type": "string" } }
      }
    },
    "commands": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "summary", "usage", "args", "needs", "output", "exit_codes", "errors"],
        "properties": {
          "name": { "type": "string" },
          "summary": { "type": "string" },
          "usage": { "type": "string" },
          "args": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "kind", "required", "summary"],
              "properties": {
                "name": { "type": "string" },
                "kind": { "enum": ["option", "positional", "rest"] },
                "value": { "type": "string" },
                "required": { "type": "boolean" },
                "summary": { "type": "string" }
              }
            }
          },
          "needs": { "type": "array", "items": { "type": "string" } },
          "output": {
            "type": "object",
            "required": ["text", "json"],
            "properties": { "text": { "type": "string" }, "json": { "type": ["object", "null"] } }
          },
          "exit_codes": { "type": "array", "items": { "type": "integer" } },
          "errors": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["code", "exit", "summary", "suggestion"],
              "properties": {
                "code": { "type": "string" },
                "exit": { "type": "integer" },
                "summary": { "type": "string" },
                "suggestion": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "intents": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "when", "recipe", "notes"],
        "properties": {
          "name": { "type": "string" },
          "when": { "type": "string" },
          "recipe": { "type": "string" },
          "notes": { "type": "string" }
        }
      }
    }
  }
}"#;

/// The `--json` flag of the commands that can print JSON.
const JSON_OPTION: OptSpec = OptSpec {
    name: "--json",
    value: None,
    summary: "print one JSON object instead of text, also when it fails",
};

/// The JSON schema of the error object `--json` prints on failure.
macro_rules! error_schema {
    () => {
        r#"{
      "type": "object",
      "required": ["ok", "code", "error", "suggestion"],
      "properties": {
        "ok": { "const": false },
        "code": { "type": "string" },
        "error": { "type": "string" },
        "suggestion": { "type": "string" }
      }
    }"#
    };
}

/// The JSON schema of `tiili open --json`'s output.
const OPEN_OUTPUT_SCHEMA: &str = concat!(
    r#"{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "required": ["ok", "protocol", "pane"],
      "properties": {
        "ok": { "const": true },
        "protocol": { "type": "integer" },
        "pane": { "type": "integer" },
        "reused": { "const": true }
      }
    },
    "#,
    error_schema!(),
    r#"
  ]
}"#
);

/// The JSON schema of `tiili list --json`'s output.
const LIST_OUTPUT_SCHEMA: &str = concat!(
    r#"{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "required": ["ok", "protocol", "panes"],
      "properties": {
        "ok": { "const": true },
        "protocol": { "type": "integer" },
        "panes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "self", "window", "cwd", "host", "repo", "title", "label", "running", "attention", "tab", "key", "opened_by_you"],
            "properties": {
              "id": { "type": "integer" },
              "self": { "type": "boolean" },
              "window": { "type": "string" },
              "cwd": { "type": "string" },
              "host": { "type": ["string", "null"] },
              "repo": {
                "type": ["object", "null"],
                "required": ["root", "name", "worktree"],
                "properties": {
                  "root": { "type": "string" },
                  "name": { "type": "string" },
                  "worktree": { "type": ["string", "null"] }
                }
              },
              "title": { "type": ["string", "null"] },
              "label": { "type": "string" },
              "running": {
                "type": ["object", "null"],
                "required": ["command", "program"],
                "properties": {
                  "command": { "type": ["string", "null"] },
                  "program": { "type": ["string", "null"] }
                }
              },
              "attention": {
                "type": ["object", "null"],
                "required": ["message"],
                "properties": { "message": { "type": ["string", "null"] } }
              },
              "tab": { "type": ["integer", "null"] },
              "key": { "type": ["string", "null"] },
              "opened_by_you": { "type": "boolean" }
            }
          }
        }
      }
    },
    "#,
    error_schema!(),
    r#"
  ]
}"#
);

/// Every `tiili` command. The CLI's dispatch, parser, help and `tiili describe` all read it.
pub const COMMANDS: &[CommandSpec] = &[
    CommandSpec {
        name: "open",
        summary: "Open a pane in this pane's window running a command",
        usage: "tiili open [--cwd DIR] [--title TITLE] [--key KEY] [--json] -- CMD [ARGS...]",
        options: &[
            OptSpec {
                name: "--cwd",
                value: Some("DIR"),
                summary: "folder the command runs in (default: the current folder)",
            },
            OptSpec {
                name: "--title",
                value: Some("TITLE"),
                summary: "the pane's title",
            },
            OptSpec {
                name: "--key",
                value: Some("KEY"),
                summary: "reuse this pane's live pane opened with KEY instead of opening another",
            },
            JSON_OPTION,
        ],
        positionals: &[],
        rest: Some(ArgSpec {
            name: "CMD",
            required: true,
            summary: "the command and its arguments, looked up on the caller's PATH",
        }),
        needs: PANE_NEEDS,
        output_text: "the new pane's id on one line; with --key, opened ID or reused ID; with --json, one JSON object",
        output_schema: Some(OPEN_OUTPUT_SCHEMA),
        exit_codes: &[0, 1, 2, 3, 4],
        errors: &[
            "usage",
            "not_in_pane",
            "unreachable",
            "bad_token",
            "malformed_request",
            "open_failed",
            "bad_reply",
        ],
    },
    CommandSpec {
        name: "list",
        summary: "List the panes of this pane's window in grid order",
        usage: "tiili list [--json]",
        options: &[JSON_OPTION],
        positionals: &[],
        rest: None,
        needs: PANE_NEEDS,
        output_text:
            "one line per pane: id, folder and title separated by tabs; with --json, one JSON object",
        output_schema: Some(LIST_OUTPUT_SCHEMA),
        exit_codes: &[0, 1, 2, 3, 4],
        errors: &[
            "usage",
            "not_in_pane",
            "unreachable",
            "bad_token",
            "malformed_request",
            "list_failed",
            "bad_reply",
        ],
    },
    CommandSpec {
        name: "attention",
        summary: "Mark this pane for the user's attention, or clear its mark",
        usage: "tiili attention [MSG] | tiili attention --clear",
        options: &[OptSpec {
            name: "--clear",
            value: None,
            summary: "clear this pane's mark instead",
        }],
        positionals: &[ArgSpec {
            name: "MSG",
            required: false,
            summary: "what the user is needed for, shown with the mark",
        }],
        rest: None,
        needs: PANE_NEEDS,
        output_text: "nothing",
        output_schema: None,
        exit_codes: &[0, 1, 2, 3, 4],
        errors: &[
            "usage",
            "not_in_pane",
            "unreachable",
            "bad_token",
            "malformed_request",
            "attention_failed",
            "bad_reply",
        ],
    },
    CommandSpec {
        name: "close",
        summary: "Close a pane this pane opened with tiili open",
        usage: "tiili close PANE",
        options: &[],
        positionals: &[ArgSpec {
            name: "PANE",
            required: true,
            summary: "the id of the pane to close",
        }],
        rest: None,
        needs: PANE_NEEDS,
        output_text: "nothing",
        output_schema: None,
        exit_codes: &[0, 1, 2, 3, 4],
        errors: &[
            "usage",
            "not_in_pane",
            "unreachable",
            "bad_token",
            "malformed_request",
            "not_opened_by_you",
            "no_such_pane",
            "close_failed",
            "bad_reply",
        ],
    },
    CommandSpec {
        name: "prompt",
        summary: "Print the agent intents as text to paste into an agent's prompt, without contacting the app",
        usage: "tiili prompt",
        options: &[],
        positionals: &[],
        rest: None,
        needs: &[],
        output_text: "the intents and their recipes as plain text",
        output_schema: None,
        exit_codes: &[0, 2],
        errors: &["usage"],
    },
    CommandSpec {
        name: "install-claude-skill",
        summary: "Install the tiili-tiles Claude Code skill into ~/.claude/skills",
        usage: "tiili install-claude-skill",
        options: &[],
        positionals: &[],
        rest: None,
        needs: &["HOME"],
        output_text: "the path the skill was written to",
        output_schema: None,
        exit_codes: &[0, 1, 2],
        errors: &["usage", "install_failed"],
    },
    CommandSpec {
        name: "describe",
        summary: "Print this command line's contract as JSON, without contacting the app",
        usage: "tiili describe [CMD]",
        options: &[],
        positionals: &[ArgSpec {
            name: "CMD",
            required: false,
            summary: "describe only this command",
        }],
        rest: None,
        needs: &[],
        output_text: "JSON, the same on every run of the same binary",
        output_schema: Some(DESCRIBE_OUTPUT_SCHEMA),
        exit_codes: &[0, 2],
        errors: &["usage"],
    },
    CommandSpec {
        name: "help",
        summary: "Print the commands, or one command's usage",
        usage: "tiili help [CMD]",
        options: &[],
        positionals: &[ArgSpec {
            name: "CMD",
            required: false,
            summary: "show only this command",
        }],
        rest: None,
        needs: &[],
        output_text: "help text",
        output_schema: None,
        exit_codes: &[0, 2],
        errors: &["usage"],
    },
];

/// The variables `tiili` reads, for `tiili describe`.
const ENV: &[(&str, &str)] = &[
    (
        SOCKET_VAR,
        "the control endpoint of the app that opened this pane; set in every pane",
    ),
    (TOKEN_VAR, "this run's token; set in every pane"),
    (PANE_VAR, "this pane's id; set in every pane"),
    (
        "PATH",
        "sent with open, so the command is looked up on and runs with the caller's PATH",
    ),
    (
        "HOME",
        "the home folder install-claude-skill writes under (USERPROFILE on Windows when unset)",
    ),
];

/// The schema name `tiili describe` stamps its output with.
pub const DESCRIBE_SCHEMA: &str = "tiili.describe/1";

/// The command named `name`.
pub fn command(name: &str) -> Option<&'static CommandSpec> {
    COMMANDS.iter().find(|c| c.name == name)
}

fn unknown_command(name: &str) -> CliError {
    CliError::Usage(format!("unknown command {name}"))
}

/// The command `name`, or the usage error for an unknown one.
fn known(name: &str) -> Result<&'static CommandSpec, CliError> {
    command(name).ok_or_else(|| unknown_command(name))
}

/// Reads `tiili`'s arguments (without the program name) against [`COMMANDS`]. Options come before `--`; everything
/// after it is the command to run.
pub fn parse_args(args: &[String]) -> Result<CliCommand, CliError> {
    let (first, rest) = args
        .split_first()
        .ok_or_else(|| CliError::Usage("no command".to_string()))?;
    match first.as_str() {
        "--help" | "-h" if rest.is_empty() => return Ok(CliCommand::Help(None)),
        "--version" if rest.is_empty() => return Ok(CliCommand::Version),
        "--help" | "-h" | "--version" => {
            return Err(CliError::Usage(format!(
                "{first} takes no arguments: {}",
                rest.join(" ")
            )))
        }
        _ => {}
    }
    let spec = known(first)?;
    let mut options: Vec<(&str, String)> = Vec::new();
    let mut positionals: Vec<String> = Vec::new();
    let mut words: Option<Vec<String>> = None;
    let mut iter = rest.iter();
    while let Some(arg) = iter.next() {
        if arg == "--" && spec.rest.is_some() {
            words = Some(iter.cloned().collect());
            break;
        }
        if let Some(opt) = spec.options.iter().find(|o| o.name == arg) {
            let value = match opt.value {
                Some(_) => iter
                    .next()
                    .cloned()
                    .ok_or_else(|| CliError::Usage(format!("{} needs a value", opt.name)))?,
                None => String::new(),
            };
            options.push((opt.name, value));
        } else if arg.starts_with('-') {
            let hint = if spec.rest.is_some() {
                " (put the command after --)"
            } else {
                ""
            };
            return Err(CliError::Usage(format!(
                "{} has no option {arg}{hint}",
                spec.name
            )));
        } else if positionals.len() < spec.positionals.len() {
            positionals.push(arg.clone());
        } else {
            return Err(CliError::Usage(format!(
                "{} does not take {arg}{}",
                spec.name,
                if spec.rest.is_some() {
                    " (put the command after --)"
                } else {
                    ""
                }
            )));
        }
    }
    if let Some(missing) = spec
        .positionals
        .iter()
        .skip(positionals.len())
        .find(|p| p.required)
    {
        return Err(CliError::Usage(format!(
            "{} needs {}",
            spec.name, missing.name
        )));
    }
    if let Some(rest) = spec.rest.filter(|r| r.required) {
        if words
            .as_ref()
            .is_none_or(|w| w.first().is_none_or(String::is_empty))
        {
            return Err(CliError::Usage(format!(
                "{} needs -- {} after its options",
                spec.name, rest.name
            )));
        }
    }
    let option = |name: &str| {
        options
            .iter()
            .rev()
            .find(|(n, _)| *n == name)
            .map(|(_, v)| v.clone())
    };
    let target = |positionals: Vec<String>| -> Result<Option<String>, CliError> {
        match positionals.into_iter().next() {
            Some(name) => known(&name).map(|c| Some(c.name.to_string())),
            None => Ok(None),
        }
    };
    let flag = |name: &str| options.iter().any(|(n, _)| *n == name);
    let json = flag(JSON_OPTION.name);
    Ok(match spec.name {
        "open" => CliCommand::Open {
            cwd: option("--cwd"),
            title: option("--title"),
            key: match option("--key") {
                Some(key) if key.is_empty() => {
                    return Err(CliError::Usage("--key needs a non-empty KEY".to_string()))
                }
                key => key,
            },
            command: words.unwrap_or_default(),
            json,
        },
        "list" => CliCommand::List { json },
        "attention" => {
            let message = positionals.into_iter().next();
            let clear = flag("--clear");
            if clear && message.is_some() {
                return Err(CliError::Usage(
                    "attention takes MSG or --clear, not both".to_string(),
                ));
            }
            CliCommand::Attention { message, clear }
        }
        "close" => {
            let pane = &positionals[0];
            CliCommand::Close(
                pane.parse()
                    .map_err(|_| CliError::Usage(format!("close needs a pane id, not {pane}")))?,
            )
        }
        "prompt" => CliCommand::Prompt,
        "install-claude-skill" => CliCommand::InstallClaudeSkill,
        "describe" => CliCommand::Describe(target(positionals)?),
        "help" => CliCommand::Help(target(positionals)?),
        other => unreachable!("command {other} in COMMANDS has no parser"),
    })
}

/// Whether `args` ask a command that can print JSON for it, so that its failure, even a usage error, is printed as
/// JSON too.
pub fn wants_json(args: &[String]) -> bool {
    let Some(spec) = args.first().and_then(|name| command(name)) else {
        return false;
    };
    spec.options.iter().any(|o| o.name == JSON_OPTION.name)
        && args[1..]
            .iter()
            .take_while(|a| *a != "--")
            .any(|a| a == JSON_OPTION.name)
}

/// One command's help: usage, summary, options and arguments.
fn command_help(spec: &CommandSpec) -> String {
    let mut text = format!("usage: {}\n\n{}\n", spec.usage, spec.summary);
    let args: Vec<(String, &str)> = spec
        .options
        .iter()
        .map(|o| match o.value {
            Some(value) => (format!("{} {value}", o.name), o.summary),
            None => (o.name.to_string(), o.summary),
        })
        .chain(
            spec.positionals
                .iter()
                .chain(spec.rest.iter())
                .map(|a| (a.name.to_string(), a.summary)),
        )
        .collect();
    if !args.is_empty() {
        text.push('\n');
        for (name, summary) in args {
            text.push_str(&format!("  {name:<16}{summary}\n"));
        }
    }
    if !spec.needs.is_empty() {
        text.push_str(&format!("\nneeds: {}\n", spec.needs.join(", ")));
    }
    text
}

/// The help `tiili help [CMD]` prints: every command with its usage, or only `cmd`'s.
pub fn help_text(cmd: Option<&str>) -> Result<String, CliError> {
    if let Some(name) = cmd {
        return known(name).map(command_help);
    }
    let mut text = "usage: tiili <command> [ARGS]\n\ncommands:\n".to_string();
    for spec in COMMANDS {
        text.push_str(&format!("  {}\n      {}\n", spec.usage, spec.summary));
    }
    text.push_str(
        "\nRun tiili help <command> for one command, or tiili describe for all of it as JSON.\n",
    );
    Ok(text)
}

/// `tiili --version`'s line.
pub fn version_line() -> String {
    format!("tiili {}", env!("CARGO_PKG_VERSION"))
}

fn describe_command(spec: &CommandSpec) -> serde_json::Value {
    use serde_json::json;
    let mut args: Vec<serde_json::Value> = spec
        .options
        .iter()
        .map(|o| {
            let mut arg = json!({ "name": o.name, "kind": "option", "required": false, "summary": o.summary });
            if let Some(value) = o.value {
                arg["value"] = json!(value);
            }
            arg
        })
        .collect();
    args.extend(spec.positionals.iter().map(|a| {
        json!({ "name": a.name, "kind": "positional", "required": a.required, "summary": a.summary })
    }));
    args.extend(spec.rest.iter().map(
        |a| json!({ "name": a.name, "kind": "rest", "required": a.required, "summary": a.summary }),
    ));
    let errors: Vec<serde_json::Value> = spec
        .errors
        .iter()
        .map(|code| {
            let e = ERRORS
                .iter()
                .find(|e| e.code == *code)
                .expect("every command error is in ERRORS");
            json!({ "code": e.code, "exit": e.exit, "summary": e.summary, "suggestion": e.suggestion })
        })
        .collect();
    let schema = spec.output_schema.map(|s| {
        serde_json::from_str::<serde_json::Value>(s).expect("output schemas are valid JSON")
    });
    json!({
        "name": spec.name,
        "summary": spec.summary,
        "usage": spec.usage,
        "args": args,
        "needs": spec.needs,
        "output": { "text": spec.output_text, "json": schema },
        "exit_codes": spec.exit_codes,
        "errors": errors,
    })
}

/// `tiili describe [CMD]`: the command line's contract as JSON, built only from the tables, so the same binary
/// always prints the same bytes. With `cmd`, only that command.
pub fn describe(cmd: Option<&str>) -> Result<serde_json::Value, CliError> {
    let commands: Vec<serde_json::Value> = match cmd {
        Some(name) => vec![describe_command(known(name)?)],
        None => COMMANDS.iter().map(describe_command).collect(),
    };
    let env: Vec<serde_json::Value> = ENV
        .iter()
        .map(|(name, summary)| serde_json::json!({ "name": name, "summary": summary }))
        .collect();
    Ok(serde_json::json!({
        "schema": DESCRIBE_SCHEMA,
        "version": env!("CARGO_PKG_VERSION"),
        "protocol": PROTOCOL,
        "env": env,
        "commands": commands,
        "intents": crate::intents::describe_intents(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    fn open(cwd: Option<&str>, title: Option<&str>, command: &[&str], path: Option<&str>) -> Op {
        Op::Open {
            cwd: cwd.map(Into::into),
            title: title.map(Into::into),
            command: command.iter().map(|s| s.to_string()).collect(),
            path: path.map(Into::into),
            key: None,
        }
    }

    fn keyed(key: &str, command: &[&str]) -> Op {
        match open(None, None, command, None) {
            Op::Open {
                cwd,
                title,
                command,
                path,
                ..
            } => Op::Open {
                cwd,
                title,
                command,
                path,
                key: Some(key.into()),
            },
            other => other,
        }
    }

    fn pane(id: SessionId, cwd: &str, title: Option<&str>, label: &str) -> PaneInfo {
        PaneInfo {
            id,
            cwd: cwd.into(),
            title: title.map(Into::into),
            label: label.into(),
            ..PaneInfo::default()
        }
    }

    /// Every field of a pane is sent, `null` when unknown.
    #[test]
    fn pane_records_send_every_field() {
        let value = serde_json::to_value(pane(3, "/tmp", None, "tmp")).unwrap();
        let mut keys: Vec<&str> = value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "attention",
                "cwd",
                "host",
                "id",
                "key",
                "label",
                "opened_by_you",
                "repo",
                "running",
                "self",
                "tab",
                "title",
                "window"
            ]
        );
        assert!(value["title"].is_null() && value["running"].is_null());
    }

    #[test]
    fn request_with_the_right_token_is_read() {
        let cases = [
            (
                format!(r#"{{"token":"{TOKEN}","pane":3,"op":"list"}}"#),
                3,
                Op::List,
            ),
            (
                format!(
                    r#"{{"token":"{TOKEN}","pane":3,"op":"open","cwd":"/tmp","title":"logs","command":["tail","-f","x.log"]}}"#
                ),
                3,
                open(Some("/tmp"), Some("logs"), &["tail", "-f", "x.log"], None),
            ),
            (
                format!(r#"{{"token":"{TOKEN}","pane":2,"op":"open","command":["ls"]}}"#),
                2,
                open(None, None, &["ls"], None),
            ),
            (
                format!(
                    r#"{{"token":"{TOKEN}","pane":2,"op":"open","command":["npm"],"key":"dev"}}"#
                ),
                2,
                keyed("dev", &["npm"]),
            ),
            (
                format!(
                    r#"{{"token":"{TOKEN}","pane":3,"op":"attention","message":"Review ready"}}"#
                ),
                3,
                Op::Attention {
                    message: Some("Review ready".into()),
                    clear: false,
                },
            ),
            (
                format!(r#"{{"token":"{TOKEN}","pane":3,"op":"attention","clear":true}}"#),
                3,
                Op::Attention {
                    message: None,
                    clear: true,
                },
            ),
            (
                format!(r#"{{"token":"{TOKEN}","pane":3,"op":"close","target":8}}"#),
                3,
                Op::Close { target: 8 },
            ),
        ];
        for (line, pane, op) in cases {
            assert_eq!(
                parse_request(&line, TOKEN),
                Ok(Request { pane, op }),
                "{line}"
            );
        }
    }

    #[test]
    fn command_found_on_the_callers_path_the_request_carries_the_callers_path() {
        let line = format!(
            r#"{{"token":"{TOKEN}","pane":1,"op":"open","cwd":null,"title":null,"command":["npm"],"path":"/opt/bin:/usr/bin"}}"#
        );
        assert_eq!(
            parse_request(&line, TOKEN),
            Ok(Request {
                pane: 1,
                op: open(None, None, &["npm"], Some("/opt/bin:/usr/bin")),
            })
        );
    }

    #[test]
    fn request_without_the_token_is_refused_before_it_is_read() {
        let cases = [
            r#"{"pane":3,"op":"list"}"#.to_string(),
            r#"{"token":"","pane":3,"op":"list"}"#.to_string(),
            format!(r#"{{"token":"{}x","pane":3,"op":"list"}}"#, &TOKEN[1..]),
            format!(r#"{{"token":"{TOKEN}0","pane":3,"op":"list"}}"#),
            r#"{"token":7,"pane":3,"op":"list"}"#.to_string(),
            // A bad token is refused before the rest of the request is read.
            r#"{"token":"nope","op":"explode"}"#.to_string(),
        ];
        for line in cases {
            assert_eq!(
                parse_request(&line, TOKEN),
                Err(CliError::BadToken),
                "{line}"
            );
        }
    }

    #[test]
    fn malformed_request_is_refused() {
        let cases = [
            "not json".to_string(),
            "[1,2]".to_string(),
            format!(r#"{{"token":"{TOKEN}","op":"list"}}"#),
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"close"}}"#),
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"close","target":"x"}}"#),
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"frobnicate"}}"#),
            format!(
                r#"{{"token":"{TOKEN}","pane":3,"op":"attention","message":"hi","clear":true}}"#
            ),
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"open","command":["ls"],"key":""}}"#),
            format!(r#"{{"token":"{TOKEN}","pane":-1,"op":"list"}}"#),
            format!(r#"{{"token":"{TOKEN}","pane":3,"op":"open","cwd":null,"title":null}}"#),
            format!(
                r#"{{"token":"{TOKEN}","pane":3,"op":"open","cwd":null,"title":null,"command":[]}}"#
            ),
            format!(
                r#"{{"token":"{TOKEN}","pane":3,"op":"open","cwd":null,"title":null,"command":[""]}}"#
            ),
        ];
        for line in cases {
            let result = parse_request(&line, TOKEN);
            assert!(
                matches!(result, Err(CliError::Malformed(_))),
                "{line} gave {result:?}"
            );
        }
    }

    /// Refused request carries a code: the error reply has ok false, the code, the message and the suggestion.
    #[test]
    fn refused_request_carries_a_code_and_a_suggestion() {
        let line = format!(r#"{{"token":"{}","pane":3,"op":"list"}}"#, "f".repeat(64));
        let error = parse_request(&line, TOKEN).unwrap_err();
        let reply: serde_json::Value = serde_json::from_str(&error_reply(&error)).unwrap();
        assert_eq!(reply["ok"], false);
        assert_eq!(reply["protocol"], PROTOCOL);
        assert_eq!(reply["code"], "bad_token");
        assert_eq!(reply["error"], error.message());
        assert_eq!(reply["suggestion"], error.suggestion());
        let read = parse_reply(&error_reply(&error)).unwrap_err();
        assert_eq!(read.code(), "bad_token");
        assert_eq!(read.suggestion(), error.suggestion());
    }

    #[test]
    fn every_error_has_one_spec_and_every_command_names_known_errors() {
        let errors = [
            CliError::Usage(String::new()),
            CliError::NotInPane(String::new()),
            CliError::Unreachable(String::new()),
            CliError::BadToken,
            CliError::Malformed(String::new()),
            CliError::OpenFailed(String::new()),
            CliError::ListFailed(String::new()),
            CliError::BadReply(String::new()),
            CliError::InstallFailed(String::new()),
            CliError::NotOpenedByYou(String::new()),
            CliError::NoSuchPane(String::new()),
            CliError::AttentionFailed(String::new()),
            CliError::CloseFailed(String::new()),
        ];
        assert_eq!(errors.len(), ERRORS.len());
        for (error, spec) in errors.iter().zip(ERRORS) {
            assert_eq!(error.code(), spec.code);
            assert_eq!(error.exit(), spec.exit, "{}", spec.code);
            assert!(!error.suggestion().is_empty(), "{}", spec.code);
        }
        for spec in COMMANDS {
            for code in spec.errors {
                let exit = ERRORS.iter().find(|e| e.code == *code).map(|e| e.exit);
                assert!(
                    exit.is_some_and(|exit| spec.exit_codes.contains(&exit)),
                    "{} error {code}",
                    spec.name
                );
            }
        }
    }

    #[test]
    fn requests_and_replies_carry_the_protocol() {
        for line in [
            request_line(TOKEN, 1, &Op::List),
            opened_reply(1, false),
            listed_reply(&[]),
            done_reply(),
            error_reply(&CliError::BadToken),
        ] {
            let value: serde_json::Value = serde_json::from_str(&line).unwrap();
            assert_eq!(value["protocol"], PROTOCOL, "{line}");
        }
    }

    #[test]
    fn an_empty_run_token_matches_nothing() {
        assert!(!check_token("", ""));
        assert!(check_token(TOKEN, TOKEN));
    }

    #[test]
    fn the_cli_request_reads_back() {
        for op in [
            Op::List,
            open(
                Some("/tmp"),
                Some("logs"),
                &["tail", "-f", "x.log"],
                Some("/opt/bin"),
            ),
            open(None, None, &["sh", "-c", "echo \"hi\"\n"], None),
            keyed("dev", &["npm", "run", "dev"]),
            Op::Attention {
                message: Some("Review ready".into()),
                clear: false,
            },
            Op::Attention {
                message: None,
                clear: true,
            },
            Op::Close { target: 8 },
        ] {
            let line = request_line(TOKEN, 9, &op);
            assert!(!line.contains('\n'), "one line: {line}");
            assert_eq!(parse_request(&line, TOKEN), Ok(Request { pane: 9, op }));
        }
    }

    #[test]
    fn replies_read_back() {
        let panes = vec![
            pane(3, "/Users/red/src/app", None, "app"),
            PaneInfo {
                is_self: true,
                window: "main".into(),
                host: Some("box".into()),
                repo: Some(RepoRecord {
                    root: "/tmp".into(),
                    name: "tmp".into(),
                    worktree: None,
                }),
                running: Some(RunningRecord {
                    command: Some("tail -f x.log".into()),
                    program: None,
                }),
                attention: Some(AttentionRecord { message: None }),
                tab: Some(2),
                key: Some("dev".into()),
                opened_by_you: true,
                ..pane(7, "/tmp", Some("logs"), "tmp")
            },
        ];
        let unreadable = || Err(CliError::BadReply("tiili sent an unreadable reply".into()));
        let mut cases: Vec<(String, Result<Reply, CliError>)> = vec![
            (
                opened_reply(7, false),
                Ok(Reply::Opened {
                    pane: 7,
                    reused: false,
                }),
            ),
            (
                opened_reply(7, true),
                Ok(Reply::Opened {
                    pane: 7,
                    reused: true,
                }),
            ),
            // An older app's open reply, without reused.
            (
                r#"{"ok":true,"protocol":1,"pane":7}"#.into(),
                Ok(Reply::Opened {
                    pane: 7,
                    reused: false,
                }),
            ),
            (done_reply(), Ok(Reply::Done)),
            (listed_reply(&panes), Ok(Reply::Listed(panes.clone()))),
            (listed_reply(&[]), Ok(Reply::Listed(vec![]))),
            // An older app's panes carry only id, folder and title.
            (
                r#"{"ok":true,"protocol":1,"panes":[{"id":3,"cwd":"/tmp","title":"tmp"}]}"#.into(),
                Ok(Reply::Listed(vec![pane(3, "/tmp", Some("tmp"), "")])),
            ),
            ("garbage".into(), unreadable()),
            (r#"{"ok":true}"#.into(), unreadable()),
            // An older app's error, without code or suggestion.
            (
                r#"{"ok":false,"error":"wrong or missing token"}"#.into(),
                Err(CliError::BadReply("wrong or missing token".into())),
            ),
            // A newer app's code this CLI does not know, with no suggestion.
            (
                r#"{"ok":false,"code":"frobnicated","error":"no"}"#.into(),
                Err(CliError::BadReply("no".into())),
            ),
            // ... and with its own suggestion, which is the one kept.
            (
                r#"{"ok":false,"code":"frobnicated","error":"no","suggestion":"update tiili"}"#.into(),
                Err(CliError::FromApp {
                    error: Box::new(CliError::BadReply("no".into())),
                    suggestion: "update tiili".into(),
                }),
            ),
            // A known code whose suggestion differs from this binary's table keeps the app's.
            (
                r#"{"ok":false,"code":"bad_token","error":"wrong or missing token","suggestion":"reopen the pane"}"#
                    .into(),
                Err(CliError::FromApp {
                    error: Box::new(CliError::BadToken),
                    suggestion: "reopen the pane".into(),
                }),
            ),
        ];
        // Every error the app can send reads back as itself, with the suggestion it was sent with.
        for error in [
            CliError::BadToken,
            CliError::Malformed("not an object".into()),
            CliError::OpenFailed("no such program".into()),
            CliError::ListFailed("pane 9 is in no window".into()),
            CliError::NotOpenedByYou("pane 5 was not opened by this pane".into()),
            CliError::NoSuchPane("no open pane 9".into()),
            CliError::AttentionFailed("pane 9 is not open in tiili".into()),
            CliError::CloseFailed("the window did not answer in time".into()),
        ] {
            let suggestion = error.suggestion().to_string();
            cases.push((
                error_reply(&error),
                Err(CliError::FromApp {
                    error: Box::new(error),
                    suggestion,
                }),
            ));
        }
        for (line, expected) in cases {
            assert_eq!(parse_reply(&line), expected, "{line}");
        }
    }

    /// List panes: one tab-separated line per pane.
    #[test]
    fn list_panes_prints_one_line_per_pane() {
        let panes = [
            pane(3, "/Users/red/src/app", None, "app"),
            pane(7, "/tmp", Some("logs"), "tmp"),
            pane(9, "/tmp", None, ""),
        ];
        assert_eq!(
            list_lines(&panes),
            "3\t/Users/red/src/app\tapp\n7\t/tmp\tlogs\n9\t/tmp\t\n"
        );
        assert_eq!(list_lines(&[]), "");
    }

    #[test]
    fn place_names_follow_the_chip() {
        // Folder, repository name and worktree, host, and the name expected.
        type Repo<'a> = Option<(&'a str, Option<&'a str>)>;
        let cases: &[(&str, Repo, Option<&str>, &str)] = &[
            ("/Users/red/src/app", Some(("app", None)), None, "app"),
            ("/w/app-fix", Some(("app", Some("fix"))), None, "app › fix"),
            ("/Users/red/Downloads", None, None, "Downloads"),
            ("/Users/red/Downloads/", None, None, "Downloads"),
            ("C:\\Users\\red", None, None, "red"),
            ("/", None, None, "/"),
            ("/srv/app", Some(("app", None)), Some("box"), "box:app"),
        ];
        for (cwd, repo, host, expected) in cases {
            assert_eq!(place_name(cwd, *repo, *host), *expected, "{cwd}");
        }
    }

    #[test]
    fn tokens_are_random_hex() {
        let (a, b) = (new_token().unwrap(), new_token().unwrap());
        assert_eq!(a.len(), 64);
        assert!(crate::bridge::valid_token(&a));
        assert_ne!(a, b);
    }

    /// Missing command, and the other argv forms `tiili` accepts or refuses.
    #[test]
    fn missing_command_and_other_arguments_parse_as_usage() {
        let args = |s: &[&str]| s.iter().map(|a| a.to_string()).collect::<Vec<_>>();
        let cmd = |s: &[&str]| s.iter().map(|a| a.to_string()).collect::<Vec<_>>();
        let cases: Vec<(Vec<String>, Result<CliCommand, ()>)> = vec![
            (args(&["list"]), Ok(CliCommand::List { json: false })),
            (
                args(&["list", "--json"]),
                Ok(CliCommand::List { json: true }),
            ),
            (
                args(&["open", "--json", "--", "npm", "test"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    key: None,
                    command: cmd(&["npm", "test"]),
                    json: true,
                }),
            ),
            // --json after -- belongs to the command.
            (
                args(&["open", "--", "jq", "--json"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    key: None,
                    command: cmd(&["jq", "--json"]),
                    json: false,
                }),
            ),
            (args(&["describe", "--json"]), Err(())),
            (args(&["list", "-a"]), Err(())),
            (args(&["list", "--json", "x"]), Err(())),
            (
                args(&["open", "--", "npm", "run", "dev"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    key: None,
                    command: cmd(&["npm", "run", "dev"]),
                    json: false,
                }),
            ),
            (
                args(&[
                    "open", "--cwd", "/tmp", "--title", "logs", "--", "tail", "-f", "x.log",
                ]),
                Ok(CliCommand::Open {
                    cwd: Some("/tmp".into()),
                    title: Some("logs".into()),
                    key: None,
                    command: cmd(&["tail", "-f", "x.log"]),
                    json: false,
                }),
            ),
            // Options after -- belong to the command.
            (
                args(&["open", "--", "ls", "--cwd", "--"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    key: None,
                    command: cmd(&["ls", "--cwd", "--"]),
                    json: false,
                }),
            ),
            (
                args(&["open", "--key", "dev", "--", "npm", "run", "dev"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    key: Some("dev".into()),
                    command: cmd(&["npm", "run", "dev"]),
                    json: false,
                }),
            ),
            (args(&["open", "--key", "", "--", "ls"]), Err(())),
            (args(&["open", "--key", "--", "ls"]), Err(())),
            (
                args(&["attention", "Review ready"]),
                Ok(CliCommand::Attention {
                    message: Some("Review ready".into()),
                    clear: false,
                }),
            ),
            (
                args(&["attention"]),
                Ok(CliCommand::Attention {
                    message: None,
                    clear: false,
                }),
            ),
            (
                args(&["attention", "--clear"]),
                Ok(CliCommand::Attention {
                    message: None,
                    clear: true,
                }),
            ),
            (args(&["attention", "--clear", "hi"]), Err(())),
            (args(&["attention", "hi", "there"]), Err(())),
            (args(&["close", "8"]), Ok(CliCommand::Close(8))),
            (args(&["close", "abc"]), Err(())),
            (args(&["close", "-1"]), Err(())),
            (args(&["close", "8", "9"]), Err(())),
            (args(&["prompt"]), Ok(CliCommand::Prompt)),
            (args(&["prompt", "x"]), Err(())),
            (args(&["open"]), Err(())),
            (args(&["open", "--"]), Err(())),
            (args(&["open", "--", ""]), Err(())),
            (args(&["open", "--cwd", "/tmp"]), Err(())),
            (args(&["open", "--cwd"]), Err(())),
            (args(&["open", "--title"]), Err(())),
            (args(&["open", "ls"]), Err(())),
            (args(&["open", "--frobnicate", "--", "ls"]), Err(())),
            (args(&["close"]), Err(())),
            (args(&[]), Err(())),
            (
                args(&["install-claude-skill"]),
                Ok(CliCommand::InstallClaudeSkill),
            ),
            (args(&["install-claude-skill", "now"]), Err(())),
            (args(&["describe"]), Ok(CliCommand::Describe(None))),
            (
                args(&["describe", "open"]),
                Ok(CliCommand::Describe(Some("open".into()))),
            ),
            (args(&["describe", "frobnicate"]), Err(())),
            (args(&["describe", "open", "list"]), Err(())),
            (args(&["help"]), Ok(CliCommand::Help(None))),
            (
                args(&["help", "list"]),
                Ok(CliCommand::Help(Some("list".into()))),
            ),
            (args(&["help", "frobnicate"]), Err(())),
            (args(&["--help"]), Ok(CliCommand::Help(None))),
            (args(&["-h"]), Ok(CliCommand::Help(None))),
            (args(&["--version"]), Ok(CliCommand::Version)),
            (args(&["--version", "x"]), Err(())),
            (args(&["frobnicate"]), Err(())),
        ];
        for (argv, expected) in cases {
            let parsed = parse_args(&argv);
            if let Err(error) = &parsed {
                assert_eq!(error.code(), "usage", "{argv:?}");
            }
            assert_eq!(parsed.map_err(|_| ()), expected, "{argv:?}");
        }
    }

    /// Outside a pane: a failing open or list asked for JSON prints its error as JSON, even a usage error.
    #[test]
    fn json_is_wanted_by_open_and_list_with_the_flag_before_the_command() {
        let args = |s: &[&str]| s.iter().map(|a| a.to_string()).collect::<Vec<_>>();
        let cases: &[(&[&str], bool)] = &[
            (&["list", "--json"], true),
            (&["list", "--json", "extra"], true),
            (&["open", "--json"], true),
            (&["open", "--cwd", "/tmp", "--json", "--", "ls"], true),
            (&["list"], false),
            (&["open", "--", "jq", "--json"], false),
            (&["describe", "--json"], false),
            (&["--json"], false),
            (&[], false),
        ];
        for (argv, json) in cases {
            assert_eq!(wants_json(&args(argv)), *json, "{argv:?}");
        }
    }

    /// Help from a pane: the help lists every command's usage, and each command has its own help.
    #[test]
    fn help_lists_every_command_and_each_has_its_own() {
        let all = help_text(None).unwrap();
        for spec in COMMANDS {
            assert!(all.contains(spec.usage), "{} missing", spec.name);
            let one = help_text(Some(spec.name)).unwrap();
            assert!(one.contains(spec.usage), "{}", spec.name);
            for opt in spec.options {
                assert!(one.contains(opt.name), "{} {}", spec.name, opt.name);
            }
        }
        assert_eq!(
            help_text(Some("frobnicate")).map_err(|e| e.code()),
            Err("usage")
        );
    }

    /// Describe outside a pane, Describe one command, Describe an unknown command: the output matches the golden
    /// file (the version stands in as `<version>`), one command describes only itself, and an unknown one is a
    /// usage error.
    #[test]
    fn describe_matches_the_golden_file() {
        let golden = include_str!("../tests/fixtures/describe.json")
            .replace("<version>", env!("CARGO_PKG_VERSION"));
        let all = describe(None).unwrap();
        assert_eq!(serde_json::to_string_pretty(&all).unwrap() + "\n", golden);
        assert_eq!(all["schema"], DESCRIBE_SCHEMA);
        assert_eq!(all["commands"].as_array().unwrap().len(), COMMANDS.len());
        let one = describe(Some("open")).unwrap();
        assert_eq!(one["commands"], serde_json::json!([all["commands"][0]]));
        assert_eq!(one["commands"][0]["name"], "open");
        let list = &all["commands"][1];
        assert_eq!(list["name"], "list");
        // Describe intents: the four intents, also when describing one command.
        assert_eq!(all["intents"].as_array().map(Vec::len), Some(4));
        assert_eq!(one["intents"], all["intents"]);
        // Describe list: its JSON output's schema names the pane fields.
        let pane = &list["output"]["json"]["oneOf"][0]["properties"]["panes"]["items"];
        assert_eq!(
            pane["required"],
            serde_json::json!([
                "id",
                "self",
                "window",
                "cwd",
                "host",
                "repo",
                "title",
                "label",
                "running",
                "attention",
                "tab",
                "key",
                "opened_by_you"
            ])
        );
        for name in ["open", "list"] {
            let spec = command(name).unwrap();
            assert!(spec.options.iter().any(|o| o.name == "--json"), "{name}");
            assert!(spec.output_schema.is_some(), "{name}");
        }
        assert_eq!(
            describe(Some("frobnicate")).map_err(|e| e.code()),
            Err("usage")
        );
    }

    /// List panes: the panes come in grid order, also after two were swapped.
    #[test]
    fn list_panes_follow_the_grid_order() {
        let cases: &[(&[SessionId], &[SessionId], &[SessionId])] = &[
            (&[1, 2, 3], &[1, 2, 3], &[1, 2, 3]),
            // Panes 1 and 3 swapped in the grid.
            (&[1, 2, 3], &[3, 2, 1], &[3, 2, 1]),
            // Pane 4 opened since the last report.
            (&[1, 2, 3, 4], &[2, 1, 3], &[2, 1, 3, 4]),
            // Pane 2 has ended.
            (&[1, 3], &[3, 2, 1], &[3, 1]),
            (&[5, 6], &[], &[5, 6]),
        ];
        for (sessions, grid, expected) in cases {
            assert_eq!(
                grid_order(sessions.to_vec(), grid),
                expected.to_vec(),
                "{sessions:?} {grid:?}"
            );
        }
    }
}
