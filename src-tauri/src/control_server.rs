//! The local endpoint `tiili open`, `list`, `attention` and `close` talk to (see [`crate::control`]): a Unix domain socket with 0600
//! permissions in a 0700 folder on macOS and Linux, a named pipe only the current user and local clients can open on
//! Windows. Each connection carries one request line and gets one reply line. What a request does is up to a
//! [`Handler`], so the endpoint tests without the app.

use std::ffi::{OsStr, OsString};
use std::io::{self, BufRead, BufReader, Read, Write};
use std::sync::Arc;
use std::thread;

use crate::control::{
    done_reply, error_reply, listed_reply, opened_reply, parse_request, CliError, Op, PaneInfo,
    Request,
};
use crate::pty::SessionId;

/// The longest request line read; a `PATH` and a command line fit many times over.
const MAX_REQUEST: u64 = 1 << 20;

/// Carries out requests that passed the token check, for the pane `caller` they came from.
pub trait Handler: Send + Sync + 'static {
    /// Opens a pane in `caller`'s window running `command` in `cwd`, titled `title`, looked up on and run with
    /// `path`; returns the new pane's id. With `key`, `caller`'s live pane opened with that key is returned instead
    /// when there is one, with `true` for reused.
    fn open(
        &self,
        caller: SessionId,
        cwd: Option<String>,
        title: Option<String>,
        command: Vec<String>,
        path: Option<String>,
        key: Option<String>,
    ) -> Result<(SessionId, bool), String>;

    /// The panes of `caller`'s window, in grid order.
    fn list(&self, caller: SessionId) -> Result<Vec<PaneInfo>, String>;

    /// Marks `caller`'s own pane for attention with `message`, or clears its mark with `clear`.
    fn attention(
        &self,
        caller: SessionId,
        message: Option<String>,
        clear: bool,
    ) -> Result<(), String>;

    /// Closes pane `target` when `caller` opened it; the error is the reply's (`not_opened_by_you`,
    /// `no_such_pane` or `close_failed`).
    fn close(&self, caller: SessionId, target: SessionId) -> Result<(), CliError>;
}

/// The reply line (without its newline) to request `line`, checked against this run's `token`.
pub fn respond(line: &str, token: &str, handler: &dyn Handler) -> String {
    match parse_request(line.trim_end(), token) {
        Err(refusal) => error_reply(&refusal),
        Ok(Request {
            pane,
            op:
                Op::Open {
                    cwd,
                    title,
                    command,
                    path,
                    key,
                },
        }) => match handler.open(pane, cwd, title, command, path, key) {
            Ok((id, reused)) => opened_reply(id, reused),
            Err(error) => error_reply(&CliError::OpenFailed(error)),
        },
        Ok(Request { pane, op: Op::List }) => match handler.list(pane) {
            Ok(panes) => listed_reply(&panes),
            Err(error) => error_reply(&CliError::ListFailed(error)),
        },
        Ok(Request {
            pane,
            op: Op::Attention { message, clear },
        }) => match handler.attention(pane, message, clear) {
            Ok(()) => done_reply(),
            Err(error) => error_reply(&CliError::AttentionFailed(error)),
        },
        Ok(Request {
            pane,
            op: Op::Close { target },
        }) => match handler.close(pane, target) {
            Ok(()) => done_reply(),
            Err(error) => error_reply(&error),
        },
    }
}

/// Reads one request from `stream`, answers it and flushes the answer.
fn serve(mut stream: impl Read + Write, token: &str, handler: &dyn Handler) -> io::Result<()> {
    let mut line = String::new();
    BufReader::new((&mut stream).take(MAX_REQUEST)).read_line(&mut line)?;
    let mut reply = respond(&line, token, handler);
    reply.push('\n');
    stream.write_all(reply.as_bytes())?;
    stream.flush()
}

/// A listening endpoint. Dropping it removes the socket file; connections in flight finish.
pub struct ControlServer {
    endpoint: OsString,
}

impl ControlServer {
    /// What panes find in `TIILI_SOCKET`: the socket's path, or the pipe's name.
    pub fn endpoint(&self) -> &OsStr {
        &self.endpoint
    }
}

#[cfg(unix)]
impl Drop for ControlServer {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.endpoint);
    }
}

/// Starts the endpoint where this platform keeps it: on macOS and Linux a socket in [`default_dir`], on Windows a
/// pipe named after the user and this process.
pub fn start(token: String, handler: Arc<dyn Handler>) -> io::Result<ControlServer> {
    #[cfg(unix)]
    {
        bind(&default_dir(), token, handler)
    }
    #[cfg(windows)]
    {
        bind_pipe(&pipe_name(), token, handler)
    }
}

/// The folder for the socket: `$XDG_RUNTIME_DIR/tiili` where the system provides one, else `tiili-<uid>` in the
/// temporary folder (per user on macOS already).
#[cfg(unix)]
pub fn default_dir() -> std::path::PathBuf {
    match std::env::var_os("XDG_RUNTIME_DIR").filter(|d| !d.is_empty()) {
        Some(dir) => std::path::Path::new(&dir).join("tiili"),
        // SAFETY: getuid has no preconditions and cannot fail.
        None => std::env::temp_dir().join(format!("tiili-{}", unsafe { libc::getuid() })),
    }
}

/// Makes `dir` a 0700 folder of the current user's, refusing one that is a link or someone else's.
#[cfg(unix)]
fn private_dir(dir: &std::path::Path) -> io::Result<()> {
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};

    match std::fs::DirBuilder::new().mode(0o700).create(dir) {
        Err(e) if e.kind() != io::ErrorKind::AlreadyExists => return Err(e),
        _ => {}
    }
    let meta = std::fs::symlink_metadata(dir)?;
    // SAFETY: geteuid has no preconditions and cannot fail.
    if !meta.is_dir() || meta.uid() != unsafe { libc::geteuid() } {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("{} is not a folder of this user's", dir.display()),
        ));
    }
    if meta.permissions().mode() & 0o777 != 0o700 {
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

/// Listens on `tiili-<pid>.sock` in `dir`, made a 0700 folder first, with 0600 permissions, answering each
/// connection on a thread of its own.
#[cfg(unix)]
pub fn bind(
    dir: &std::path::Path,
    token: String,
    handler: Arc<dyn Handler>,
) -> io::Result<ControlServer> {
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::UnixListener;
    use std::time::Duration;

    private_dir(dir)?;
    let path = dir.join(format!("tiili-{}.sock", std::process::id()));
    // A socket left by an earlier run with this pid.
    match std::fs::remove_file(&path) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
        _ => {}
    }
    let listener = UnixListener::bind(&path)?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
    let token: Arc<str> = token.into();
    thread::Builder::new()
        .name("control-accept".into())
        .spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else {
                    // Out of descriptors, say: wait rather than spin on the same error.
                    thread::sleep(Duration::from_millis(100));
                    continue;
                };
                let (token, handler) = (Arc::clone(&token), Arc::clone(&handler));
                let _ = thread::Builder::new()
                    .name("control-connection".into())
                    .spawn(move || {
                        // A client that never finishes its request does not hold the thread for ever.
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
                        let _ = serve(stream, &token, handler.as_ref());
                    });
            }
        })?;
    Ok(ControlServer {
        endpoint: path.into_os_string(),
    })
}

/// `\\.\pipe\tiili-<user>-<pid>`.
#[cfg(windows)]
pub fn pipe_name() -> String {
    let user: String = std::env::var("USERNAME")
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .collect();
    format!(r"\\.\pipe\tiili-{user}-{}", std::process::id())
}

/// A security descriptor whose access list lets only the current user in.
#[cfg(windows)]
struct UserOnly {
    descriptor: Box<windows_sys::Win32::Security::SECURITY_DESCRIPTOR>,
    _acl: Vec<u64>,
    _user: Vec<u64>,
}

// SAFETY: the descriptor's pointers lead into the buffers it owns, which only the accept thread reads.
#[cfg(windows)]
unsafe impl Send for UserOnly {}

#[cfg(windows)]
impl UserOnly {
    fn new() -> io::Result<Self> {
        use std::ptr::null_mut;
        use windows_sys::Win32::Foundation::{CloseHandle, GENERIC_ALL, HANDLE};
        use windows_sys::Win32::Security::{
            AddAccessAllowedAce, GetLengthSid, GetTokenInformation, InitializeAcl,
            InitializeSecurityDescriptor, SetSecurityDescriptorDacl, TokenUser, ACL, ACL_REVISION,
            SECURITY_DESCRIPTOR, TOKEN_QUERY, TOKEN_USER,
        };
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        let check = |ok: i32| {
            if ok == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        };
        // SAFETY: every buffer handed to the calls below is sized as the calls ask and outlives them; the token
        // handle is closed before returning.
        unsafe {
            let mut process_token: HANDLE = null_mut();
            check(OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_QUERY,
                &mut process_token,
            ))?;
            let mut needed = 0u32;
            GetTokenInformation(process_token, TokenUser, null_mut(), 0, &mut needed);
            let mut user = vec![0u64; (needed as usize).div_ceil(8)];
            let got = GetTokenInformation(
                process_token,
                TokenUser,
                user.as_mut_ptr().cast(),
                needed,
                &mut needed,
            );
            CloseHandle(process_token);
            check(got)?;
            let sid = (*user.as_ptr().cast::<TOKEN_USER>()).User.Sid;
            // The list's header, one allowing entry's header and the SID.
            let size = std::mem::size_of::<ACL>() as u32 + 8 + GetLengthSid(sid);
            let mut acl = vec![0u64; (size as usize).div_ceil(8)];
            check(InitializeAcl(acl.as_mut_ptr().cast(), size, ACL_REVISION))?;
            check(AddAccessAllowedAce(
                acl.as_mut_ptr().cast(),
                ACL_REVISION,
                GENERIC_ALL,
                sid,
            ))?;
            let mut descriptor: Box<SECURITY_DESCRIPTOR> = Box::new(std::mem::zeroed());
            // SECURITY_DESCRIPTOR_REVISION.
            check(InitializeSecurityDescriptor(
                (&mut *descriptor as *mut SECURITY_DESCRIPTOR).cast(),
                1,
            ))?;
            check(SetSecurityDescriptorDacl(
                (&mut *descriptor as *mut SECURITY_DESCRIPTOR).cast(),
                1,
                acl.as_ptr().cast(),
                0,
            ))?;
            Ok(Self {
                descriptor,
                _acl: acl,
                _user: user,
            })
        }
    }
}

/// Listens on the named pipe `name`, open to the current user only and refusing remote clients, answering each
/// connection on a thread of its own.
#[cfg(windows)]
pub fn bind_pipe(
    name: &str,
    token: String,
    handler: Arc<dyn Handler>,
) -> io::Result<ControlServer> {
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::FromRawHandle;
    use windows_sys::Win32::Foundation::{ERROR_PIPE_CONNECTED, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };

    let wide: Vec<u16> = OsStr::new(name).encode_wide().chain([0]).collect();
    let access = UserOnly::new()?;
    // Creates the next instance; the first must be new, so nobody else's pipe can sit under the name.
    let create = move |first: bool| -> io::Result<std::fs::File> {
        // Names `access` whole, so the closure owns all of it. Using only `access.descriptor` would capture just that
        // field (Rust 2021 closures capture disjoint fields): the ACL and user buffers the descriptor points into
        // would be freed when `bind_pipe` returns, and the field alone is not `Send`.
        let access = &access;
        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: (&*access.descriptor as *const _ as *mut _),
            bInheritHandle: 0,
        };
        let open_mode = PIPE_ACCESS_DUPLEX
            | if first {
                FILE_FLAG_FIRST_PIPE_INSTANCE
            } else {
                0
            };
        // SAFETY: `wide` is a NUL-terminated name and `attributes` points at a descriptor `access` keeps alive.
        let handle = unsafe {
            CreateNamedPipeW(
                wide.as_ptr(),
                open_mode,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                64 * 1024,
                64 * 1024,
                0,
                &attributes,
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: the handle was just created and nothing else owns it.
        Ok(unsafe { std::fs::File::from_raw_handle(handle) })
    };
    let mut pipe = create(true)?;
    let token: Arc<str> = token.into();
    thread::Builder::new()
        .name("control-accept".into())
        .spawn(move || loop {
            use std::os::windows::io::AsRawHandle;
            // SAFETY: the handle is a pipe instance `pipe` owns.
            let connected = unsafe { ConnectNamedPipe(pipe.as_raw_handle(), std::ptr::null_mut()) }
                != 0
                || io::Error::last_os_error().raw_os_error() == Some(ERROR_PIPE_CONNECTED as i32);
            let next = match create(false) {
                Ok(next) => next,
                Err(_) => return,
            };
            let stream = std::mem::replace(&mut pipe, next);
            if !connected {
                continue;
            }
            let (token, handler) = (Arc::clone(&token), Arc::clone(&handler));
            let _ = thread::Builder::new()
                .name("control-connection".into())
                .spawn(move || {
                    let mut stream = stream;
                    if serve(&mut stream, &token, handler.as_ref()).is_ok() {
                        // Waits until the client has read the reply before the instance closes.
                        let _ = stream.sync_all();
                    }
                });
        })?;
    Ok(ControlServer {
        endpoint: name.into(),
    })
}
