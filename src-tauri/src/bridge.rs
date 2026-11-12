//! The dev bridge's protocol, free of sockets so it can be tested: which handshakes it accepts and
//! what the page's messages mean. The `dev-bridge` binary carries it out.

use serde::Deserialize;

/// The path the page connects to.
pub const PTY_PATH: &str = "/pty";
/// The shortest per-run token the bridge accepts, in hex characters.
pub const MIN_TOKEN_LEN: usize = 32;

/// A text message from the page.
#[derive(Debug, PartialEq, Eq, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ClientMsg {
    /// Typed input for the shell.
    Input { data: String },
    /// The terminal's new size.
    Resize { rows: u16, cols: u16 },
}

/// Why a handshake was refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    /// The path is not [`PTY_PATH`].
    WrongPath,
    /// The token is missing or not this run's.
    BadToken,
    /// `rows` or `cols` is missing, not a number, or zero.
    BadSize,
}

/// Reads a text message from the page; anything malformed, including a zero size, is `None`.
pub fn parse_client(text: &str) -> Option<ClientMsg> {
    match serde_json::from_str(text).ok()? {
        ClientMsg::Resize { rows, cols } if rows == 0 || cols == 0 => None,
        msg => Some(msg),
    }
}

/// The exit message sent to the page after the shell has exited.
pub fn exit_message(code: u32) -> String {
    serde_json::json!({ "type": "exit", "code": code }).to_string()
}

/// The message sent to the page once the shell has started.
pub fn ready_message() -> String {
    serde_json::json!({ "type": "ready" }).to_string()
}

/// The message sent to the page when the shell cannot start, with the reason.
pub fn error_message(reason: &str) -> String {
    serde_json::json!({ "type": "error", "message": reason }).to_string()
}

/// Whether `token` is long enough and hex, so it can serve as a per-run secret.
pub fn valid_token(token: &str) -> bool {
    token.len() >= MIN_TOKEN_LEN && token.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Compares two byte strings in time that depends only on their lengths, not where they differ.
fn same(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// Checks a handshake's `path_and_query` against this run's `token` and returns the terminal's
/// `(rows, cols)` from the query.
pub fn check_request(path_and_query: &str, token: &str) -> Result<(u16, u16), Refusal> {
    let (path, query) = path_and_query
        .split_once('?')
        .unwrap_or((path_and_query, ""));
    if path != PTY_PATH {
        return Err(Refusal::WrongPath);
    }
    let param = |name: &str| {
        query
            .split('&')
            .filter_map(|pair| pair.split_once('='))
            .find(|(key, _)| *key == name)
            .map(|(_, value)| value)
    };
    match param("token") {
        Some(given) if same(given.as_bytes(), token.as_bytes()) => {}
        _ => return Err(Refusal::BadToken),
    }
    let size = |name: &str| {
        param(name)
            .and_then(|v| v.parse::<u16>().ok())
            .filter(|n| *n > 0)
    };
    match (size("rows"), size("cols")) {
        (Some(rows), Some(cols)) => Ok((rows, cols)),
        _ => Err(Refusal::BadSize),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn parses_client_messages() {
        let cases: &[(&str, Option<ClientMsg>)] = &[
            (
                r#"{"type":"input","data":"echo hi\r"}"#,
                Some(ClientMsg::Input {
                    data: "echo hi\r".into(),
                }),
            ),
            (
                r#"{"type":"resize","rows":30,"cols":100}"#,
                Some(ClientMsg::Resize {
                    rows: 30,
                    cols: 100,
                }),
            ),
            (r#"{"type":"resize","rows":0,"cols":100}"#, None),
            (r#"{"type":"resize","rows":70000,"cols":100}"#, None),
            (r#"{"type":"input"}"#, None),
            (r#"{"type":"other"}"#, None),
            ("not json", None),
            ("", None),
        ];
        for (text, expected) in cases {
            assert_eq!(&parse_client(text), expected, "{text}");
        }
    }

    #[test]
    fn wrong_token_and_bad_requests_are_refused() {
        type Case = (String, Result<(u16, u16), Refusal>);
        let cases: &[Case] = &[
            (format!("/pty?rows=24&cols=80&token={TOKEN}"), Ok((24, 80))),
            (
                format!("/pty?token={TOKEN}&cols=100&rows=30"),
                Ok((30, 100)),
            ),
            ("/pty?rows=24&cols=80".into(), Err(Refusal::BadToken)),
            (
                "/pty?rows=24&cols=80&token=0123456789abcdef0123456789abcdee".into(),
                Err(Refusal::BadToken),
            ),
            ("/pty?rows=24&cols=80&token=".into(), Err(Refusal::BadToken)),
            (
                format!("/pty?rows=24&cols=80&token={TOKEN}0"),
                Err(Refusal::BadToken),
            ),
            (
                format!("/other?rows=24&cols=80&token={TOKEN}"),
                Err(Refusal::WrongPath),
            ),
            (format!("/pty/?token={TOKEN}"), Err(Refusal::WrongPath)),
            (format!("/pty?cols=80&token={TOKEN}"), Err(Refusal::BadSize)),
            (
                format!("/pty?rows=x&cols=80&token={TOKEN}"),
                Err(Refusal::BadSize),
            ),
            (
                format!("/pty?rows=0&cols=80&token={TOKEN}"),
                Err(Refusal::BadSize),
            ),
            (
                format!("/pty?rows=24&cols=99999&token={TOKEN}"),
                Err(Refusal::BadSize),
            ),
        ];
        for (request, expected) in cases {
            assert_eq!(&check_request(request, TOKEN), expected, "{request}");
        }
    }

    #[test]
    fn tokens_must_be_long_hex() {
        assert!(valid_token(TOKEN));
        assert!(!valid_token(&TOKEN[1..]));
        assert!(!valid_token("0123456789abcdef0123456789abcdeg"));
        assert!(!valid_token(""));
    }

    #[test]
    fn server_messages_encode_as_json() {
        let cases: &[(String, serde_json::Value)] = &[
            (
                exit_message(3),
                serde_json::json!({ "type": "exit", "code": 3 }),
            ),
            (ready_message(), serde_json::json!({ "type": "ready" })),
            (
                error_message("openpty: Operation not permitted"),
                serde_json::json!({ "type": "error", "message": "openpty: Operation not permitted" }),
            ),
            (
                error_message("quote \" and\nnewline"),
                serde_json::json!({ "type": "error", "message": "quote \" and\nnewline" }),
            ),
        ];
        for (text, expected) in cases {
            let value: serde_json::Value = serde_json::from_str(text).unwrap();
            assert_eq!(&value, expected, "{text}");
        }
    }
}
