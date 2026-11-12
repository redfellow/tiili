//! Dev-only bridge for the browser dev server (`npm run dev:browser`): runs a default shell per
//! WebSocket connection through tiili's own PTY code. Listens on 127.0.0.1 only, refuses
//! connections without this run's token, and kills a connection's shell when it closes. The app
//! bundle ships the `tiili` binary alone, so this never reaches users.
//!
//! Environment: `TIILI_BRIDGE_TOKEN` (required, at least 32 hex characters) and
//! `TIILI_BRIDGE_PORT` (0 or absent picks a free port). Prints `listening on <address>` once ready.

use std::io::{self, ErrorKind};
use std::net::{TcpListener, TcpStream};
use std::process::ExitCode;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tiili_lib::bridge::{self, ClientMsg, Refusal};
use tiili_lib::pty::PtySession;
use tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tungstenite::http::StatusCode;
use tungstenite::{Error, Message, WebSocket};

/// How long the reader holds the socket before letting the shell's output through.
const READ_SLICE: Duration = Duration::from_millis(20);
/// How long a connection waits for the page to answer the close after the shell has exited.
const CLOSE_WAIT: Duration = Duration::from_secs(2);

type Socket = Arc<Mutex<WebSocket<TcpStream>>>;

fn refuse(status: StatusCode, reason: &str) -> ErrorResponse {
    let mut response = ErrorResponse::new(Some(reason.to_string()));
    *response.status_mut() = status;
    response
}

fn is_timeout(err: &Error) -> bool {
    matches!(err, Error::Io(e) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut))
}

/// Runs one connection: handshake, shell, and the page's messages until either side ends.
fn serve(stream: TcpStream, token: &str) -> io::Result<()> {
    let mut size = None;
    // tungstenite's handshake callback fixes the error type.
    #[allow(clippy::result_large_err)]
    let check = |request: &Request, response: Response| {
        let path = request
            .uri()
            .path_and_query()
            .map(|p| p.as_str())
            .unwrap_or("");
        match bridge::check_request(path, token) {
            Ok(rows_cols) => {
                size = Some(rows_cols);
                Ok(response)
            }
            Err(Refusal::WrongPath) => Err(refuse(StatusCode::NOT_FOUND, "not found")),
            Err(Refusal::BadToken) => Err(refuse(StatusCode::FORBIDDEN, "forbidden")),
            Err(Refusal::BadSize) => Err(refuse(StatusCode::BAD_REQUEST, "bad size")),
        }
    };
    let ws = tungstenite::accept_hdr(stream, check).map_err(|e| io::Error::other(e.to_string()))?;
    let Some((rows, cols)) = size else {
        return Ok(());
    };
    ws.get_ref().set_read_timeout(Some(READ_SLICE))?;
    let socket: Socket = Arc::new(Mutex::new(ws));
    let exited = Arc::new(AtomicBool::new(false));

    let out = Arc::clone(&socket);
    let on_exit_socket = Arc::clone(&socket);
    let on_exit_flag = Arc::clone(&exited);
    let session = PtySession::spawn(
        rows,
        cols,
        Box::new(move |data| {
            if let Ok(mut ws) = out.lock() {
                let _ = ws.send(Message::binary(data.to_vec()));
            }
        }),
        Box::new(move |code| {
            if let Ok(mut ws) = on_exit_socket.lock() {
                let _ = ws.send(Message::text(bridge::exit_message(code)));
                let _ = ws.close(None);
                let _ = ws.flush();
            }
            on_exit_flag.store(true, Ordering::SeqCst);
        }),
    );
    let session = match session {
        Ok(session) => session,
        Err(e) => {
            // Tell the page why no shell runs, rather than leaving it on a silent socket.
            let mut ws = socket
                .lock()
                .map_err(|_| io::Error::other("socket lock poisoned"))?;
            let _ = ws.send(Message::text(bridge::error_message(&e.to_string())));
            let _ = ws.close(None);
            let _ = ws.flush();
            return Ok(());
        }
    };
    if let Ok(mut ws) = socket.lock() {
        let _ = ws.send(Message::text(bridge::ready_message()));
    }

    let mut closing_since: Option<Instant> = None;
    loop {
        if exited.load(Ordering::SeqCst) {
            let since = *closing_since.get_or_insert_with(Instant::now);
            if since.elapsed() > CLOSE_WAIT {
                break;
            }
        }
        let read = socket
            .lock()
            .map_err(|_| io::Error::other("socket lock poisoned"))?
            .read();
        match read {
            Ok(Message::Text(text)) => match bridge::parse_client(text.as_str()) {
                Some(ClientMsg::Input { data }) => {
                    let _ = session.write(data.as_bytes());
                }
                Some(ClientMsg::Resize { rows, cols }) => {
                    let _ = session.resize(rows, cols);
                }
                None => {}
            },
            Ok(_) => {}
            Err(ref e) if is_timeout(e) => {
                // Let the shell's output take the socket between reads.
                thread::sleep(Duration::from_millis(1));
            }
            Err(_) => break,
        }
    }
    // Dropping the session kills the shell, if it still runs.
    drop(session);
    Ok(())
}

fn main() -> ExitCode {
    let token = std::env::var("TIILI_BRIDGE_TOKEN").unwrap_or_default();
    if !bridge::valid_token(&token) {
        eprintln!(
            "dev-bridge: set TIILI_BRIDGE_TOKEN to at least {} hex characters",
            bridge::MIN_TOKEN_LEN
        );
        return ExitCode::FAILURE;
    }
    let port = match std::env::var("TIILI_BRIDGE_PORT") {
        Ok(text) => match text.parse::<u16>() {
            Ok(port) => port,
            Err(_) => {
                eprintln!("dev-bridge: TIILI_BRIDGE_PORT is not a port: {text}");
                return ExitCode::FAILURE;
            }
        },
        Err(_) => 0,
    };
    let listener = match TcpListener::bind(("127.0.0.1", port)) {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("dev-bridge: cannot listen on 127.0.0.1:{port}: {e}");
            return ExitCode::FAILURE;
        }
    };
    match listener.local_addr() {
        Ok(addr) => println!("listening on {addr}"),
        Err(e) => {
            eprintln!("dev-bridge: {e}");
            return ExitCode::FAILURE;
        }
    }

    let token: Arc<str> = token.into();
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let token = Arc::clone(&token);
        thread::spawn(move || {
            if let Err(e) = serve(stream, &token) {
                eprintln!("dev-bridge: connection ended: {e}");
            }
        });
    }
    ExitCode::SUCCESS
}
