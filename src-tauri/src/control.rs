//! The pane control protocol, free of sockets so it can be tested: what a request to the running app looks like,
//! the token check, the replies and the `tiili` command line. The control server
//! ([`control_server`](crate::control_server)) and the CLI ([`cli`](crate::cli)) carry it out.
//!
//! A request is one JSON line, `{"token","pane","op":"open"|"list",...}`; the reply is one JSON line,
//! `{"ok":true,"pane":7}`, `{"ok":true,"panes":[...]}` or `{"ok":false,"error":"..."}`.

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

/// Why a request was refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    /// The token is missing or not this run's.
    BadToken,
    /// The line is not a valid control message.
    Malformed(String),
}

impl Refusal {
    /// The error the reply carries.
    pub fn message(&self) -> String {
        match self {
            Refusal::BadToken => {
                "wrong or missing token (run tiili from a pane of the running app)".to_string()
            }
            Refusal::Malformed(why) => format!("malformed request: {why}"),
        }
    }
}

/// Whether `given` is this run's `token`, compared in time that does not depend on where they differ. An empty
/// token never matches.
pub fn check_token(given: &str, token: &str) -> bool {
    !token.is_empty() && crate::bridge::same(given.as_bytes(), token.as_bytes())
}

/// Reads one request line and checks its token against this run's `token` before anything else in it.
pub fn parse_request(line: &str, token: &str) -> Result<Request, Refusal> {
    let value: serde_json::Value =
        serde_json::from_str(line).map_err(|e| Refusal::Malformed(e.to_string()))?;
    let object = value
        .as_object()
        .ok_or_else(|| Refusal::Malformed("not an object".into()))?;
    match object.get("token").and_then(|t| t.as_str()) {
        Some(given) if check_token(given, token) => {}
        _ => return Err(Refusal::BadToken),
    }
    let body: Body =
        serde_json::from_value(value).map_err(|e| Refusal::Malformed(e.to_string()))?;
    if let Op::Open { command, .. } = &body.op {
        if command.is_empty() || command[0].is_empty() {
            return Err(Refusal::Malformed("no command to run".into()));
        }
    }
    Ok(Request {
        pane: body.pane,
        op: body.op,
    })
}

/// The request line the CLI sends for `op` from pane `pane`, with the `token` it found.
pub fn request_line(token: &str, pane: SessionId, op: &Op) -> String {
    serde_json::to_string(&WireRequest { token, pane, op }).unwrap_or_default()
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
    serde_json::json!({ "ok": true, "pane": id }).to_string()
}

/// The reply to a list.
pub fn listed_reply(panes: &[PaneInfo]) -> String {
    serde_json::json!({ "ok": true, "panes": panes }).to_string()
}

/// The reply to a refused or failed request.
pub fn error_reply(message: &str) -> String {
    serde_json::json!({ "ok": false, "error": message }).to_string()
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
}

/// Reads a reply line; a refusal, a failure or anything malformed is the error to show.
pub fn parse_reply(line: &str) -> Result<Reply, String> {
    let reply: WireReply =
        serde_json::from_str(line).map_err(|_| "tiili sent an unreadable reply".to_string())?;
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
            ..
        } => Err(error),
        _ => Err("tiili sent an unreadable reply".to_string()),
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
}

/// How `tiili` is used, printed with a usage error.
pub const USAGE: &str =
    "usage: tiili open [--cwd DIR] [--title TITLE] -- CMD [ARGS...]\n       tiili list";

/// Reads `tiili`'s arguments (without the program name). Options come before `--`; everything after it is the
/// command. The error is what is wrong, to print with [`USAGE`].
pub fn parse_args(args: &[String]) -> Result<CliCommand, String> {
    let (first, rest) = args
        .split_first()
        .ok_or_else(|| "no subcommand".to_string())?;
    match first.as_str() {
        "list" if rest.is_empty() => Ok(CliCommand::List),
        "list" => Err(format!("list takes no arguments: {}", rest.join(" "))),
        "open" => {
            let (mut cwd, mut title) = (None, None);
            let mut iter = rest.iter();
            let mut command = Vec::new();
            while let Some(arg) = iter.next() {
                let mut value = |name: &str| {
                    iter.next()
                        .cloned()
                        .ok_or_else(|| format!("{name} needs a value"))
                };
                match arg.as_str() {
                    "--" => {
                        command = iter.cloned().collect();
                        break;
                    }
                    "--cwd" => cwd = Some(value("--cwd")?),
                    "--title" => title = Some(value("--title")?),
                    other => {
                        return Err(format!("unknown option {other} (put the command after --)"))
                    }
                }
            }
            if command.is_empty() || command[0].is_empty() {
                return Err("no command after --".to_string());
            }
            Ok(CliCommand::Open {
                cwd,
                title,
                command,
            })
        }
        other => Err(format!("unknown subcommand {other}")),
    }
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
                Err(Refusal::BadToken),
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
                matches!(result, Err(Refusal::Malformed(_))),
                "{line} gave {result:?}"
            );
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
        let cases: Vec<(String, Result<Reply, String>)> = vec![
            (opened_reply(7), Ok(Reply::Opened(7))),
            (listed_reply(&panes), Ok(Reply::Listed(panes.clone()))),
            (listed_reply(&[]), Ok(Reply::Listed(vec![]))),
            (
                error_reply("wrong or missing token"),
                Err("wrong or missing token".into()),
            ),
            (
                "garbage".into(),
                Err("tiili sent an unreadable reply".into()),
            ),
            (
                r#"{"ok":true}"#.into(),
                Err("tiili sent an unreadable reply".into()),
            ),
        ];
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
        ];
        for (argv, expected) in cases {
            assert_eq!(parse_args(&argv).map_err(|_| ()), expected, "{argv:?}");
        }
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
