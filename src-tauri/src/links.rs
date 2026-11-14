//! Links in a terminal pane: which URLs may open and how, and which printed paths are existing files or folders.
//! The rules are pure functions; the commands below re-check them before anything reaches the OS opener, so the
//! webview's own opener permission can stay limited to the release page.

use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::cwd::{is_local_host, local_hostname};
use crate::pty::{SessionId, SessionRegistry};

/// What may happen to a URL the user opens.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UrlRule {
    /// Opens at once: `http`, `https`, `mailto`.
    Allow,
    /// Opens only after the user confirmed the scheme and full URI.
    Confirm,
    /// Never opens: `javascript:`, `data:`, `blob:`, `file://` on another host, or anything that is not a URI.
    Deny,
}

/// The URI's scheme, lower-cased, when it starts with a well-formed one (`letter *( letter / digit / + - . ) :`).
fn scheme_of(uri: &str) -> Option<String> {
    let (scheme, _) = uri.split_once(':')?;
    let mut chars = scheme.chars();
    let first = chars.next()?;
    if !first.is_ascii_alphabetic()
        || !chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    {
        return None;
    }
    Some(scheme.to_ascii_lowercase())
}

/// The host of a `file:` URI: what follows `//` up to the next `/`; empty when there is none.
fn file_host(uri: &str) -> &str {
    let rest = &uri[uri.find(':').map_or(0, |i| i + 1)..];
    match rest.strip_prefix("//") {
        Some(after) => after.split('/').next().unwrap_or(""),
        None => "",
    }
}

/// The rule for `uri` on a machine named `local`.
pub fn classify_url_on(uri: &str, local: &str) -> UrlRule {
    if uri.is_empty() || uri.chars().any(|c| c.is_control()) {
        return UrlRule::Deny;
    }
    let Some(scheme) = scheme_of(uri) else {
        return UrlRule::Deny;
    };
    match scheme.as_str() {
        "http" | "https" | "mailto" => UrlRule::Allow,
        "javascript" | "vbscript" | "data" | "blob" => UrlRule::Deny,
        "file" if !is_local_host(file_host(uri), local) => UrlRule::Deny,
        _ => UrlRule::Confirm,
    }
}

/// The rule for `uri` on this machine.
pub fn classify_url(uri: &str) -> UrlRule {
    classify_url_on(uri, local_hostname())
}

/// Whose rules decide which files are launchers.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Os {
    MacOs,
    Windows,
    Linux,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Os::MacOs
        } else if cfg!(windows) {
            Os::Windows
        } else {
            Os::Linux
        }
    }
}

/// An existing file or folder a printed path names.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolved {
    /// The absolute path, with `.` and `..` worked out.
    pub abs: String,
    pub is_dir: bool,
    /// An executable or launcher: it may be revealed, never opened.
    pub reveal_only: bool,
}

/// `text` without a trailing `:line[:col]` or `(line[,col])`.
pub fn strip_line_suffix(text: &str) -> &str {
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    if let Some(inner) = text.strip_suffix(')') {
        if let Some(open) = inner.rfind('(') {
            let numbers = &inner[open + 1..];
            let mut parts = numbers.splitn(2, ',');
            let line = parts.next().unwrap_or("");
            let col = parts.next();
            if digits(line) && col.is_none_or(|c| digits(c.trim())) && open > 0 {
                return &text[..open];
            }
        }
        return text;
    }
    let mut rest = text;
    for _ in 0..2 {
        match rest.rfind(':') {
            Some(i) if i > 0 && digits(&rest[i + 1..]) => rest = &rest[..i],
            _ => break,
        }
    }
    rest
}

/// Whether `path` starts with a Windows drive, as in `C:\` or `C:/`.
fn has_drive(path: &str) -> bool {
    let b = path.as_bytes();
    b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && matches!(b[2], b'\\' | b'/')
}

/// `path` with `.` dropped and each `..` taking off the folder before it, without touching the disk.
fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other),
        }
    }
    out
}

fn extension(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

#[cfg(unix)]
fn executable(meta: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    meta.is_file() && meta.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn executable(_meta: &std::fs::Metadata) -> bool {
    false
}

/// Whether opening `path` would run something, under `os`'s rules.
fn is_reveal_only(os: Os, path: &Path, meta: &std::fs::Metadata) -> bool {
    let ext = extension(path);
    match os {
        Os::MacOs => matches!(ext.as_str(), "app" | "command" | "tool" | "pkg") || executable(meta),
        Os::Windows => matches!(
            ext.as_str(),
            "exe" | "bat" | "cmd" | "ps1" | "vbs" | "js" | "msi" | "lnk" | "scr"
        ),
        Os::Linux => ext == "desktop" || executable(meta),
    }
}

/// What `abs`, an absolute path, is on disk under `os`'s rules; `None` when nothing is there. A symlink is judged by
/// its own name and by what it points to, so a link to a launcher is reveal-only too.
pub fn inspect(os: Os, abs: &Path) -> Option<Resolved> {
    let meta = std::fs::metadata(abs).ok()?;
    let target = std::fs::canonicalize(abs).ok()?;
    Some(Resolved {
        abs: abs.to_string_lossy().into_owned(),
        is_dir: meta.is_dir(),
        reveal_only: is_reveal_only(os, abs, &meta) || is_reveal_only(os, &target, &meta),
    })
}

/// The existing file or folder `text` names under `os`'s rules: relative to `cwd`, `~/` in `home`, absolute, or
/// (on Windows) on a drive, with any line suffix dropped. `None` when it names nothing that exists.
pub fn resolve_path_on(os: Os, cwd: &Path, home: Option<&Path>, text: &str) -> Option<Resolved> {
    let path = strip_line_suffix(text.trim());
    if path.is_empty() {
        return None;
    }
    let full = if path == "~" || path.starts_with("~/") || path.starts_with("~\\") {
        home?.join(path.get(2..).unwrap_or(""))
    } else if has_drive(path) {
        if os != Os::Windows {
            return None;
        }
        PathBuf::from(path)
    } else if Path::new(path).is_absolute() || (os != Os::Windows && path.starts_with('/')) {
        PathBuf::from(path)
    } else {
        cwd.join(path)
    };
    inspect(os, &normalize(&full))
}

/// The existing file or folder `text` names on this machine; see [`resolve_path_on`].
pub fn resolve_path(cwd: &Path, home: Option<&Path>, text: &str) -> Option<Resolved> {
    resolve_path_on(Os::current(), cwd, home, text)
}

/// Opens `uri` in the system's handler for its scheme, after the scheme rules: a denied URI never opens, and one that
/// needs confirming opens only with `confirmed`.
#[tauri::command]
pub fn link_open(app: AppHandle, uri: String, confirmed: bool) -> Result<(), String> {
    match classify_url(&uri) {
        UrlRule::Deny => Err(format!("tiili never opens {uri}")),
        UrlRule::Confirm if !confirmed => Err(format!("Opening {uri} needs your confirmation")),
        _ => app
            .opener()
            .open_url(uri, None::<&str>)
            .map_err(|e| e.to_string()),
    }
}

/// The existing file or folder each of `candidates` names in session `pane_id`'s current folder, in order. A remote
/// or WSL pane's paths are not on this machine's disk, so each is `None` there.
#[tauri::command]
pub async fn path_resolve(
    app: AppHandle,
    pane_id: SessionId,
    candidates: Vec<String>,
) -> Result<Vec<Option<Resolved>>, String> {
    let none = || vec![None; candidates.len()];
    let cwd = match crate::pane_place(&app, pane_id) {
        Some((_, Some(_host))) => return Ok(none()),
        Some((cwd, None)) => Some(PathBuf::from(cwd)),
        None => app
            .state::<SessionRegistry>()
            .cwd(pane_id)
            .map_err(|e| e.to_string())?,
    };
    let Some(cwd) = cwd else {
        return Ok(none());
    };
    let home = app.path().home_dir().ok();
    Ok(candidates
        .iter()
        .map(|text| resolve_path(&cwd, home.as_deref(), text))
        .collect())
}

/// What is at `abs`, which must be absolute and exist.
fn existing(abs: &str) -> Result<Resolved, String> {
    let path = Path::new(abs);
    if !path.is_absolute() {
        return Err(format!("{abs} is not an absolute path"));
    }
    inspect(Os::current(), &normalize(path)).ok_or_else(|| format!("{abs} does not exist"))
}

/// Opens the file at `abs` in its default app, or the folder in the file manager; refuses executables and
/// launchers, which may only be revealed.
#[tauri::command]
pub async fn path_open(app: AppHandle, abs: String) -> Result<(), String> {
    let found = existing(&abs)?;
    if found.reveal_only {
        return Err(format!(
            "{abs} would run a program, so tiili only reveals it"
        ));
    }
    app.opener()
        .open_path(found.abs, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Shows the file or folder at `abs` selected in its folder in the file manager.
#[tauri::command]
pub async fn path_reveal(app: AppHandle, abs: String) -> Result<(), String> {
    let found = existing(&abs)?;
    app.opener()
        .reveal_item_in_dir(found.abs)
        .map_err(|e| e.to_string())
}
