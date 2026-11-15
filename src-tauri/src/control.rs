//! The pane control protocol, free of sockets so it can be tested: what a request to the running app looks like,
//! the token check, the replies and the `tiili` command line. The control server
//! ([`control_server`](crate::control_server)) and the CLI ([`cli`](crate::cli)) carry it out.
//!
//! A request is one JSON line, `{"protocol":1,"token","pane","op":"open"|"list",...}`; the reply is one JSON line,
//! `{"ok":true,"protocol":1,"pane":7}`, `{"ok":true,"protocol":1,"panes":[...]}` or
//! `{"ok":false,"protocol":1,"code","error","suggestion"}`. The command line is one table, [`COMMANDS`], and its
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
    },
    /// List the panes of the caller's window.
    List,
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

    /// The fix to suggest.
    pub fn suggestion(&self) -> &'static str {
        self.spec().suggestion
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
            | CliError::InstallFailed(why) => why.clone(),
        }
    }

    /// The error an app reply with `code` and `message` stands for; a missing or unknown code is a bad reply that
    /// keeps the app's message.
    fn from_reply(code: Option<&str>, message: String) -> CliError {
        match code {
            Some("bad_token") => CliError::BadToken,
            Some("malformed_request") => CliError::Malformed(
                message
                    .strip_prefix("malformed request: ")
                    .map(str::to_string)
                    .unwrap_or(message),
            ),
            Some("open_failed") => CliError::OpenFailed(message),
            Some("list_failed") => CliError::ListFailed(message),
            _ => CliError::BadReply(message),
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
    if let Op::Open { command, .. } = &body.op {
        if command.is_empty() || command[0].is_empty() {
            return Err(CliError::Malformed("no command to run".into()));
        }
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

/// A pane as `tiili list` shows it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct PaneInfo {
    pub id: SessionId,
    pub cwd: String,
    pub title: String,
}

/// The reply to an open that made pane `id`.
pub fn opened_reply(id: SessionId) -> String {
    serde_json::json!({ "ok": true, "protocol": PROTOCOL, "pane": id }).to_string()
}

/// The reply to a list.
pub fn listed_reply(panes: &[PaneInfo]) -> String {
    serde_json::json!({ "ok": true, "protocol": PROTOCOL, "panes": panes }).to_string()
}

/// The reply to a refused or failed request: its code, message and suggestion.
pub fn error_reply(error: &CliError) -> String {
    serde_json::json!({
        "ok": false,
        "protocol": PROTOCOL,
        "code": error.code(),
        "error": error.message(),
        "suggestion": error.suggestion(),
    })
    .to_string()
}

/// A reply as the CLI reads it.
#[derive(Debug, PartialEq, Eq)]
pub enum Reply {
    Opened(SessionId),
    Listed(Vec<PaneInfo>),
}

#[derive(Deserialize)]
struct WireReply {
    ok: bool,
    pane: Option<SessionId>,
    panes: Option<Vec<PaneInfo>>,
    error: Option<String>,
    code: Option<String>,
}

/// What an unreadable reply is reported as.
fn unreadable() -> CliError {
    CliError::BadReply("tiili sent an unreadable reply".to_string())
}

/// Reads a reply line; a refusal, a failure or anything malformed is the error to show. A reply's code picks the
/// error (and so the suggestion, which comes from the same [`ERRORS`] table the app used); a reply without one,
/// from an older app, is a bad reply that keeps the app's message.
pub fn parse_reply(line: &str) -> Result<Reply, CliError> {
    let reply: WireReply = serde_json::from_str(line).map_err(|_| unreadable())?;
    match reply {
        WireReply {
            ok: true,
            pane: Some(id),
            ..
        } => Ok(Reply::Opened(id)),
        WireReply {
            ok: true,
            panes: Some(panes),
            ..
        } => Ok(Reply::Listed(panes)),
        WireReply {
            ok: false,
            error: Some(error),
            code,
            ..
        } => Err(CliError::from_reply(code.as_deref(), error)),
        _ => Err(unreadable()),
    }
}

/// `tiili list`'s output: one line per pane, id, folder and title separated by tabs.
pub fn list_lines(panes: &[PaneInfo]) -> String {
    panes
        .iter()
        .map(|p| format!("{}\t{}\t{}\n", p.id, p.cwd, p.title))
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
        command: Vec<String>,
    },
    List,
    InstallClaudeSkill,
    /// `tiili describe [CMD]`.
    Describe(Option<String>),
    /// `tiili help [CMD]`, `--help` or `-h`.
    Help(Option<String>),
    /// `tiili --version`.
    Version,
}

/// An option a command takes before `--`, with the placeholder for its value.
#[derive(Debug, Clone, Copy)]
pub struct OptSpec {
    pub name: &'static str,
    pub value: &'static str,
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
  "required": ["schema", "version", "protocol", "env", "commands"],
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
    }
  }
}"#;

/// Every `tiili` command. The CLI's dispatch, parser, help and `tiili describe` all read it.
pub const COMMANDS: &[CommandSpec] = &[
    CommandSpec {
        name: "open",
        summary: "Open a pane in this pane's window running a command",
        usage: "tiili open [--cwd DIR] [--title TITLE] -- CMD [ARGS...]",
        options: &[
            OptSpec {
                name: "--cwd",
                value: "DIR",
                summary: "folder the command runs in (default: the current folder)",
            },
            OptSpec {
                name: "--title",
                value: "TITLE",
                summary: "the pane's title",
            },
        ],
        positionals: &[],
        rest: Some(ArgSpec {
            name: "CMD",
            required: true,
            summary: "the command and its arguments, looked up on the caller's PATH",
        }),
        needs: PANE_NEEDS,
        output_text: "the new pane's id on one line",
        output_schema: None,
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
        usage: "tiili list",
        options: &[],
        positionals: &[],
        rest: None,
        needs: PANE_NEEDS,
        output_text: "one line per pane: id, folder and title separated by tabs",
        output_schema: None,
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
            let value = iter
                .next()
                .cloned()
                .ok_or_else(|| CliError::Usage(format!("{} needs a value", opt.name)))?;
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
    Ok(match spec.name {
        "open" => CliCommand::Open {
            cwd: option("--cwd"),
            title: option("--title"),
            command: words.unwrap_or_default(),
        },
        "list" => CliCommand::List,
        "install-claude-skill" => CliCommand::InstallClaudeSkill,
        "describe" => CliCommand::Describe(target(positionals)?),
        "help" => CliCommand::Help(target(positionals)?),
        other => unreachable!("command {other} in COMMANDS has no parser"),
    })
}

/// One command's help: usage, summary, options and arguments.
fn command_help(spec: &CommandSpec) -> String {
    let mut text = format!("usage: {}\n\n{}\n", spec.usage, spec.summary);
    let args: Vec<(String, &str)> = spec
        .options
        .iter()
        .map(|o| (format!("{} {}", o.name, o.value), o.summary))
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
            json!({ "name": o.name, "kind": "option", "value": o.value, "required": false, "summary": o.summary })
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
        }
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
        assert_eq!(parse_reply(&error_reply(&error)), Err(CliError::BadToken));
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
            opened_reply(1),
            listed_reply(&[]),
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
        ] {
            let line = request_line(TOKEN, 9, &op);
            assert!(!line.contains('\n'), "one line: {line}");
            assert_eq!(parse_request(&line, TOKEN), Ok(Request { pane: 9, op }));
        }
    }

    #[test]
    fn replies_read_back() {
        let panes = vec![
            PaneInfo {
                id: 3,
                cwd: "/Users/red/src/app".into(),
                title: "app".into(),
            },
            PaneInfo {
                id: 7,
                cwd: "/tmp".into(),
                title: "logs".into(),
            },
        ];
        let unreadable = || Err(CliError::BadReply("tiili sent an unreadable reply".into()));
        let mut cases: Vec<(String, Result<Reply, CliError>)> = vec![
            (opened_reply(7), Ok(Reply::Opened(7))),
            (listed_reply(&panes), Ok(Reply::Listed(panes.clone()))),
            (listed_reply(&[]), Ok(Reply::Listed(vec![]))),
            ("garbage".into(), unreadable()),
            (r#"{"ok":true}"#.into(), unreadable()),
            // An older app's error, without code or suggestion.
            (
                r#"{"ok":false,"error":"wrong or missing token"}"#.into(),
                Err(CliError::BadReply("wrong or missing token".into())),
            ),
            // A newer app's code this CLI does not know.
            (
                r#"{"ok":false,"code":"frobnicated","error":"no"}"#.into(),
                Err(CliError::BadReply("no".into())),
            ),
        ];
        // Every error the app can send reads back as itself.
        for error in [
            CliError::BadToken,
            CliError::Malformed("not an object".into()),
            CliError::OpenFailed("no such program".into()),
            CliError::ListFailed("pane 9 is in no window".into()),
        ] {
            cases.push((error_reply(&error), Err(error)));
        }
        for (line, expected) in cases {
            assert_eq!(parse_reply(&line), expected, "{line}");
        }
    }

    /// List panes: one tab-separated line per pane.
    #[test]
    fn list_panes_prints_one_line_per_pane() {
        let panes = [
            PaneInfo {
                id: 3,
                cwd: "/Users/red/src/app".into(),
                title: "app".into(),
            },
            PaneInfo {
                id: 7,
                cwd: "/tmp".into(),
                title: "logs".into(),
            },
        ];
        assert_eq!(
            list_lines(&panes),
            "3\t/Users/red/src/app\tapp\n7\t/tmp\tlogs\n"
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
            (args(&["list"]), Ok(CliCommand::List)),
            (args(&["list", "-a"]), Err(())),
            (
                args(&["open", "--", "npm", "run", "dev"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    command: cmd(&["npm", "run", "dev"]),
                }),
            ),
            (
                args(&[
                    "open", "--cwd", "/tmp", "--title", "logs", "--", "tail", "-f", "x.log",
                ]),
                Ok(CliCommand::Open {
                    cwd: Some("/tmp".into()),
                    title: Some("logs".into()),
                    command: cmd(&["tail", "-f", "x.log"]),
                }),
            ),
            // Options after -- belong to the command.
            (
                args(&["open", "--", "ls", "--cwd", "--"]),
                Ok(CliCommand::Open {
                    cwd: None,
                    title: None,
                    command: cmd(&["ls", "--cwd", "--"]),
                }),
            ),
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
        assert!(list["output"]["json"].is_null());
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
