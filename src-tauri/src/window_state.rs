//! The off-screen fallback for the main window's saved state. `tauri-plugin-window-state` drops a saved
//! position that lies on no connected monitor but still restores the saved size, so tiili checks the saved
//! rectangle itself and puts the window back to its default size when it is off every screen.

use std::path::Path;

/// A rectangle in physical pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// The window rectangle `label` was saved with in the plugin's state file at `path`; `None` when the file,
/// the window or its fields are missing or unreadable, or the window was never sized (all zero).
pub fn read_saved(path: &Path, label: &str) -> Option<Rect> {
    let text = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;
    let window = json.get(label)?;
    let int = |key: &str| window.get(key)?.as_i64();
    let rect = Rect {
        x: i32::try_from(int("x")?).ok()?,
        y: i32::try_from(int("y")?).ok()?,
        width: u32::try_from(int("width")?).ok()?,
        height: u32::try_from(int("height")?).ok()?,
    };
    (rect.width > 0 && rect.height > 0).then_some(rect)
}

/// Whether any corner of `saved` lies on one of `monitors`: the rule the plugin uses to decide that the saved
/// position is still reachable.
pub fn is_on_screen(saved: Rect, monitors: &[Rect]) -> bool {
    let right = saved.x.saturating_add_unsigned(saved.width);
    let bottom = saved.y.saturating_add_unsigned(saved.height);
    let corners = [
        (saved.x, saved.y),
        (right, saved.y),
        (saved.x, bottom),
        (right, bottom),
    ];
    monitors.iter().any(|m| {
        let m_right = m.x.saturating_add_unsigned(m.width);
        let m_bottom = m.y.saturating_add_unsigned(m.height);
        corners
            .iter()
            .any(|&(x, y)| x >= m.x && x < m_right && y >= m.y && y < m_bottom)
    })
}
