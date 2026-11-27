//! The session tiili reopens on launch: every window's place and size, its panes, layout and folders, kept in a
//! versioned `session.json` (plus one scrollback file per pane) in the app data folder, readable by the user only.
//! Everything here is free of Tauri types so it can be tested on its own.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::window_state::{is_on_screen, Rect};

/// The session file's format version; a file with any other version is ignored and left on disk.
pub const VERSION: u32 = 1;
/// The session file's name in the app data folder.
pub const FILE: &str = "session.json";
/// The folder, beside the session file, that holds one scrollback file per pane.
pub const SCROLLBACK_DIR: &str = "scrollback";
/// The folder in the app data folder that restored history lines are handed to shells through.
pub const HISTORY_DIR: &str = "history";

/// What a pane is.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneKind {
    #[default]
    Terminal,
    Heynote,
}

/// One saved pane. Its `id` is the one it had when saved; it only keys the pane's scrollback file, since panes
/// get new ids when they reopen.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Pane {
    pub id: u32,
    pub kind: PaneKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// The remote host the pane was connected to, when it was.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    /// Pixels the pane's font was zoomed by.
    pub zoom: f64,
    /// The chip title the user gave the pane.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// The command line that was running, when tiili's shell integration reported one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    /// The name of the program that was running, for shells without the integration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub program: Option<String>,
}

/// A pane that was minimized in its tab, with its grid index then; it reopens minimized.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MinimizedPane {
    #[serde(flatten)]
    pub pane: Pane,
    pub at: usize,
}

/// One saved tab: its layout (kept as the frontend sends it), panes and focus. Its minimized panes are kept apart
/// from `panes`, so the layout still matches the grid; a file from before minimizing reads with none.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Tab {
    pub layout: serde_json::Value,
    pub panes: Vec<Pane>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub minimized: Vec<MinimizedPane>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focused: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zen_pane: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl Tab {
    /// Every pane of the tab: the ones in its grid, then the minimized ones.
    pub fn all_panes(&self) -> impl Iterator<Item = &Pane> {
        self.panes
            .iter()
            .chain(self.minimized.iter().map(|m| &m.pane))
    }
}

/// What a window's frontend reports about it: its tabs and which one is in front.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TabState {
    pub tabs: Vec<Tab>,
    pub active_tab: usize,
}

/// A window's place: its outer position and inner size in physical pixels, and whether it was maximised or
/// fullscreen.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Geometry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rect: Option<Rect>,
    pub maximized: bool,
    pub fullscreen: bool,
}

/// One saved window. `label` is the window's label when saved; with the pane ids it keys scrollback files.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Window {
    pub label: String,
    #[serde(flatten)]
    pub geometry: Geometry,
    #[serde(flatten)]
    pub state: TabState,
}

impl Window {
    /// Whether the window has any pane left; one whose last pane exited does not reopen.
    pub fn has_panes(&self) -> bool {
        self.state
            .tabs
            .iter()
            .any(|tab| tab.all_panes().next().is_some())
    }
}

/// The whole session.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub version: u32,
    #[serde(default)]
    pub windows: Vec<Window>,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            version: VERSION,
            windows: Vec::new(),
        }
    }
}

/// The session in `bytes`; `None` when they are not a session file of this version (corrupt, or written by a
/// newer or older tiili).
pub fn parse(bytes: &[u8]) -> Option<Session> {
    let json: serde_json::Value = serde_json::from_slice(bytes).ok()?;
    if json.get("version")?.as_u64()? != u64::from(VERSION) {
        return None;
    }
    serde_json::from_value(json).ok()
}

/// Writes `bytes` to `path` so that a reader sees either the old file or the whole new one: a temporary file
/// beside it, readable by the user only on unix, renamed over it. Creates the parent folder.
pub fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    let temp = path.with_file_name(name);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        options.mode(0o600);
        let file = options.open(&temp)?;
        // `mode` applies only when the file is created; tighten one left over from an earlier attempt too.
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
        write_all(file, bytes)?;
    }
    #[cfg(not(unix))]
    write_all(options.open(&temp)?, bytes)?;
    fn write_all(mut file: std::fs::File, bytes: &[u8]) -> std::io::Result<()> {
        file.write_all(bytes)?;
        file.sync_all()
    }
    std::fs::rename(&temp, path)
}

/// Writes `session` as `session.json` in `dir`, atomically and readable by the user only.
pub fn write_atomic(dir: &Path, session: &Session) -> std::io::Result<()> {
    let bytes = serde_json::to_vec_pretty(session).map_err(std::io::Error::other)?;
    write_private(&dir.join(FILE), &bytes)
}

/// The scrollback file of pane `pane` in the window saved as `label`.
pub fn scrollback_path(dir: &Path, label: &str, pane: u32) -> PathBuf {
    let label: String = label
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    dir.join(SCROLLBACK_DIR).join(format!("{label}-{pane}.txt"))
}

/// `path` itself when it is an existing folder, else its nearest existing parent folder; `None` when there is
/// none (the caller opens home).
pub fn nearest_existing(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|p| !p.as_os_str().is_empty() && p.is_dir())
        .map(Path::to_path_buf)
}

/// Where each saved window opens, in order: its saved geometry when its rectangle is on one of `monitors`,
/// else the default (no rectangle, so 900×600 centred, not maximised).
pub fn plan_restore(session: &Session, monitors: &[Rect]) -> Vec<Geometry> {
    session
        .windows
        .iter()
        .map(|window| match window.geometry.rect {
            Some(rect) if rect.width > 0 && rect.height > 0 && is_on_screen(rect, monitors) => {
                window.geometry
            }
            _ => Geometry::default(),
        })
        .collect()
}

/// The open windows' state, kept in the order they opened, from which the session file is written.
#[derive(Debug, Default)]
pub struct SessionStore {
    windows: Vec<Window>,
    /// Set once the app is ending: windows closing from then on stay in the session.
    ending: bool,
}

impl SessionStore {
    fn entry(&mut self, label: &str) -> &mut Window {
        let index = match self.windows.iter().position(|w| w.label == label) {
            Some(index) => index,
            None => {
                self.windows.push(Window {
                    label: label.to_string(),
                    ..Window::default()
                });
                self.windows.len() - 1
            }
        };
        &mut self.windows[index]
    }

    /// Records what window `label`'s frontend reports.
    pub fn update(&mut self, label: &str, state: TabState) {
        self.entry(label).state = state;
    }

    /// Window `label`'s last recorded place and size.
    pub fn geometry(&self, label: &str) -> Geometry {
        self.windows
            .iter()
            .find(|w| w.label == label)
            .map(|w| w.geometry)
            .unwrap_or_default()
    }

    /// Whether the app is ending.
    pub fn is_ending(&self) -> bool {
        self.ending
    }

    /// Records window `label`'s place and size.
    pub fn set_geometry(&mut self, label: &str, geometry: Geometry) {
        self.entry(label).geometry = geometry;
    }

    /// Window `label` closed: it is forgotten while other windows stay open, but kept when it is the last one
    /// or the app is ending, since that is how the app ends.
    pub fn close(&mut self, label: &str) {
        let others = self.windows.iter().any(|w| w.label != label);
        if others && !self.ending {
            self.windows.retain(|w| w.label != label);
        }
    }

    /// The app is ending: no window is forgotten from now on.
    pub fn end(&mut self) {
        self.ending = true;
    }

    /// Drops every pane's command line, for when restoring scrollback and commands is turned off.
    pub fn forget_commands(&mut self) {
        for pane in self
            .windows
            .iter_mut()
            .flat_map(|w| w.state.tabs.iter_mut())
            .flat_map(|t| {
                t.panes
                    .iter_mut()
                    .chain(t.minimized.iter_mut().map(|m| &mut m.pane))
            })
        {
            pane.command = None;
        }
    }

    /// The session to write: every window that still has a pane.
    pub fn session(&self) -> Session {
        Session {
            version: VERSION,
            windows: self
                .windows
                .iter()
                .filter(|w| w.has_panes())
                .cloned()
                .collect(),
        }
    }
}
