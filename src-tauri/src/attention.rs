//! Panes that need the user, kept app-wide by shell session so a mark follows its pane to another window.
//!
//! A window marks one of its sessions when that pane's shell rings the bell or sends a notification while the user
//! is not looking at it, and clears it when the user looks. Every window hears `attention-changed` with the marked
//! sessions and shows them; the app icon, the Dock bounce or taskbar flash and desktop notifications follow while
//! no tiili window is in front.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use crate::pty::SessionId;
use crate::settings::{self, AttentionSettings, Notify};
use crate::windows::WindowSessions;

/// Event sent to every window when the marked sessions change; its payload is an [`AttentionChanged`].
pub const ATTENTION_CHANGED_EVENT: &str = "attention-changed";
/// Event sent to the window that is to focus a marked pane; its payload is the pane's session.
pub const ATTENTION_FOCUS_EVENT: &str = "attention-focus";
/// Marks made this close together share one desktop notification.
pub const NOTIFY_BATCH: Duration = Duration::from_secs(2);
/// After a window loses focus, the app waits this long before showing the badge: focus may be on its way to another
/// tiili window.
const BLUR_SETTLE: Duration = Duration::from_millis(150);

/// One marked session as the frontend sees it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct MarkInfo {
    pub session: SessionId,
    pub message: Option<String>,
}

/// The `attention-changed` payload: every marked session, oldest first.
#[derive(Clone, Serialize)]
pub struct AttentionChanged {
    pub marks: Vec<MarkInfo>,
}

#[derive(Clone, Debug)]
struct Mark {
    session: SessionId,
    /// Order of marking: the oldest mark has the lowest.
    seq: u64,
    message: Option<String>,
    /// The pane's chip text, `<place> · <command>`, a notification's title.
    title: String,
    /// Set once the mark has had its desktop notification (or was let go without one).
    notified: bool,
}

/// What marking a session did.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Marked {
    /// The session was not marked before.
    New,
    /// The session was marked and has now gained a message.
    Updated,
    /// Nothing changed.
    Unchanged,
}

/// A desktop notification to send.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Notification {
    pub title: String,
    pub body: Option<String>,
    /// The pane's session for one pane's notification; none for a summary, whose click goes to the oldest mark.
    pub session: Option<SessionId>,
}

/// The id a notification for `session` (none for a summary) is shown with, so its click finds the pane again.
pub fn notification_id(session: Option<SessionId>) -> i32 {
    session.and_then(|id| i32::try_from(id).ok()).unwrap_or(-1)
}

/// The session a clicked notification with `id` was for; none for a summary.
pub fn clicked_session(id: i32) -> Option<SessionId> {
    SessionId::try_from(id).ok()
}

/// The marked sessions, with no Tauri in it.
#[derive(Default)]
pub struct Registry {
    next_seq: u64,
    marks: HashMap<SessionId, Mark>,
}

impl Registry {
    /// Marks session `id`, with `message` when the shell sent one and its pane's chip text `title`. A marked session
    /// keeps its place in the order; it only takes a message it lacked and the newer title.
    pub fn mark(&mut self, id: SessionId, message: Option<String>, title: String) -> Marked {
        if let Some(mark) = self.marks.get_mut(&id) {
            if !title.is_empty() {
                mark.title = title;
            }
            if mark.message.is_none() && message.is_some() {
                mark.message = message;
                return Marked::Updated;
            }
            return Marked::Unchanged;
        }
        let seq = self.next_seq;
        self.next_seq += 1;
        self.marks.insert(
            id,
            Mark {
                session: id,
                seq,
                message,
                title,
                notified: false,
            },
        );
        Marked::New
    }

    /// Clears session `id`'s mark; true when it had one.
    pub fn clear(&mut self, id: SessionId) -> bool {
        self.marks.remove(&id).is_some()
    }

    /// The session marked longest ago.
    pub fn next(&self) -> Option<SessionId> {
        self.marks
            .iter()
            .min_by_key(|(_, mark)| mark.seq)
            .map(|(&id, _)| id)
    }

    /// How many sessions are marked.
    pub fn count(&self) -> usize {
        self.marks.len()
    }

    /// Every marked session, oldest first.
    pub fn list(&self) -> Vec<MarkInfo> {
        let mut marks: Vec<_> = self.marks.iter().collect();
        marks.sort_by_key(|(_, mark)| mark.seq);
        marks
            .into_iter()
            .map(|(&session, mark)| MarkInfo {
                session,
                message: mark.message.clone(),
            })
            .collect()
    }

    /// The notification for the marks not yet notified that `notify` sends one for: one mark is titled with its
    /// pane and has its message as body; more are summed up as `N panes need you`. With `send` false (a tiili window
    /// is in front) they are let go without one. Either way each counts as notified until its mark clears.
    pub fn take_notification(&mut self, notify: Notify, send: bool) -> Option<Notification> {
        let mut due: Vec<&mut Mark> = self
            .marks
            .values_mut()
            .filter(|mark| !mark.notified)
            .filter(|mark| match notify {
                Notify::Off => false,
                Notify::Messages => mark.message.is_some(),
                Notify::MessagesAndBells => true,
            })
            .collect();
        due.sort_by_key(|mark| mark.seq);
        for mark in due.iter_mut() {
            mark.notified = true;
        }
        if !send {
            return None;
        }
        match due.as_slice() {
            [] => None,
            [mark] => Some(Notification {
                title: if mark.title.is_empty() {
                    "tiili".to_string()
                } else {
                    mark.title.clone()
                },
                body: mark.message.clone(),
                session: Some(mark.session),
            }),
            marks => Some(Notification {
                title: format!("{} panes need you", marks.len()),
                body: None,
                session: None,
            }),
        }
    }
}

/// The OS-level look of marks: the app icon badge and the Dock bounce or taskbar flash.
pub mod os {
    use crate::settings::Bounce;

    /// How hard to ask for the user's attention.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Level {
        /// Once: one Dock bounce, a short taskbar flash.
        Informational,
        /// Until the user comes back.
        Critical,
    }

    /// What the app icon and the attention request should be.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub struct Decision {
        /// The count on the app icon; none hides the badge.
        pub badge: Option<i64>,
        /// Ask for attention at this level, for a new mark.
        pub request: Option<Level>,
        /// Stop asking: the user is back.
        pub cancel: bool,
    }

    /// The decision for `count` marked panes: nothing at OS level while a tiili window is in front
    /// (`app_focused`); else the badge (when `badge_on`) and, for a `new_mark`, an attention request as `bounce`
    /// says.
    pub fn decide(
        app_focused: bool,
        count: usize,
        new_mark: bool,
        badge_on: bool,
        bounce: Bounce,
    ) -> Decision {
        if app_focused {
            return Decision {
                badge: None,
                request: None,
                cancel: true,
            };
        }
        let request = match bounce {
            _ if !new_mark || count == 0 => None,
            Bounce::Once => Some(Level::Informational),
            Bounce::UntilReturn => Some(Level::Critical),
            Bounce::Never => None,
        };
        Decision {
            badge: (badge_on && count > 0).then_some(count as i64),
            request,
            cancel: count == 0,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn decision_follows_focus_count_and_settings() {
            let none = Decision {
                badge: None,
                request: None,
                cancel: false,
            };
            let back = Decision {
                cancel: true,
                ..none
            };
            // (case, app focused, count, new mark, badge on, bounce, decision)
            let cases = [
                (
                    "a tiili window in front: nothing shows",
                    true,
                    2,
                    true,
                    true,
                    Bounce::Once,
                    back,
                ),
                (
                    "Agent finishes while in another app: badge 2, bounce once",
                    false,
                    2,
                    true,
                    true,
                    Bounce::Once,
                    Decision {
                        badge: Some(2),
                        request: Some(Level::Informational),
                        ..none
                    },
                ),
                (
                    "until I return asks critically",
                    false,
                    1,
                    true,
                    true,
                    Bounce::UntilReturn,
                    Decision {
                        badge: Some(1),
                        request: Some(Level::Critical),
                        ..none
                    },
                ),
                (
                    "never asks for nothing, badge off shows no count",
                    false,
                    1,
                    true,
                    false,
                    Bounce::Never,
                    none,
                ),
                (
                    "no new mark: the badge follows the count without asking again",
                    false,
                    3,
                    false,
                    true,
                    Bounce::Once,
                    Decision {
                        badge: Some(3),
                        ..none
                    },
                ),
                (
                    "last mark cleared: no badge, stop asking",
                    false,
                    0,
                    false,
                    true,
                    Bounce::UntilReturn,
                    back,
                ),
            ];
            for (name, focused, count, new_mark, badge_on, bounce, expected) in cases {
                assert_eq!(
                    decide(focused, count, new_mark, badge_on, bounce),
                    expected,
                    "{name}"
                );
            }
        }
    }
}

/// The app's marks, with the pending notification batch.
#[derive(Default)]
pub struct Attention {
    registry: Mutex<Registry>,
    /// True while a notification batch waits to be sent.
    batching: Mutex<bool>,
}

impl Attention {
    fn with<T>(&self, f: impl FnOnce(&mut Registry) -> T) -> Option<T> {
        self.registry
            .lock()
            .ok()
            .map(|mut registry| f(&mut registry))
    }
}

/// True when a tiili window (or its settings window) is in front.
fn app_focused(app: &AppHandle) -> bool {
    app.webview_windows()
        .values()
        .any(|window| window.is_focused().unwrap_or(false))
}

fn attention_settings(app: &AppHandle) -> AttentionSettings {
    settings::attention(&settings::settings_load(app.clone()))
}

#[cfg(target_os = "windows")]
fn overlay_icon() -> Option<tauri::image::Image<'static>> {
    tauri::image::Image::from_bytes(include_bytes!("../icons/attention-overlay.png")).ok()
}

/// Shows the badge and asks for attention (on the window of `marked`, a newly marked session) as
/// [`os::decide`] says.
fn show_os(app: &AppHandle, marked: Option<SessionId>) {
    let settings = attention_settings(app);
    let count = app
        .state::<Attention>()
        .with(|registry| registry.count())
        .unwrap_or(0);
    let decision = os::decide(
        app_focused(app),
        count,
        marked.is_some(),
        settings.badge,
        settings.bounce,
    );
    let windows = app.webview_windows();
    let main_windows: Vec<&WebviewWindow> = windows
        .iter()
        .filter(|(label, _)| !settings::is_settings_window(label))
        .map(|(_, window)| window)
        .collect();

    // macOS and Linux badge the app once; Windows has no app badge, so each window's taskbar button gets the brick.
    #[cfg(not(target_os = "windows"))]
    if let Some(window) = main_windows.first() {
        let _ = window.set_badge_count(decision.badge);
    }
    #[cfg(target_os = "windows")]
    for window in &main_windows {
        let icon = decision.badge.and_then(|_| overlay_icon());
        let _ = window.set_overlay_icon(icon);
    }

    if decision.cancel {
        for window in &main_windows {
            let _ = window.request_user_attention(None);
        }
    }
    if let Some(level) = decision.request {
        let owner = marked.and_then(|id| app.state::<WindowSessions>().owner(id));
        let window = owner
            .and_then(|label| windows.get(&label))
            .or_else(|| main_windows.first().copied());
        let kind = match level {
            os::Level::Informational => tauri::UserAttentionType::Informational,
            os::Level::Critical => tauri::UserAttentionType::Critical,
        };
        if let Some(window) = window {
            let _ = window.request_user_attention(Some(kind));
        }
    }
}

/// Tells every window the marks changed.
fn changed(app: &AppHandle) {
    let marks = app
        .state::<Attention>()
        .with(|registry| registry.list())
        .unwrap_or_default();
    let _ = app.emit(ATTENTION_CHANGED_EVENT, AttentionChanged { marks });
}

/// Sends the batch's notification, if any is due, and lets the next mark start a new batch.
fn flush_notifications(app: &AppHandle) {
    let state = app.state::<Attention>();
    if let Ok(mut batching) = state.batching.lock() {
        *batching = false;
    }
    let notify = attention_settings(app).notify;
    let send = !app_focused(app);
    let Some(Some(notification)) = state.with(|registry| registry.take_notification(notify, send))
    else {
        return;
    };
    use tauri_plugin_notification::NotificationExt;
    let mut builder = app
        .notification()
        .builder()
        .id(notification_id(notification.session))
        .title(notification.title);
    if let Some(body) = notification.body {
        builder = builder.body(body);
    }
    let _ = builder.show();
}

/// Starts a notification batch unless one is waiting: marks made in the next [`NOTIFY_BATCH`] share it.
fn batch_notification(app: &AppHandle) {
    let state = app.state::<Attention>();
    let Ok(mut batching) = state.batching.lock() else {
        return;
    };
    if *batching {
        return;
    }
    *batching = true;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(NOTIFY_BATCH);
        flush_notifications(&app);
    });
}

/// Session `id` has ended or its pane closed: its mark clears.
pub fn forget(app: &AppHandle, id: SessionId) {
    if app
        .state::<Attention>()
        .with(|registry| registry.clear(id))
        .unwrap_or(false)
    {
        changed(app);
        show_os(app, None);
    }
}

/// A tiili window gained or lost focus: on gaining it the OS-level look clears at once; on losing it the badge
/// shows, once focus has not gone to another tiili window.
pub fn focus_changed(app: &AppHandle, focused: bool) {
    if focused {
        show_os(app, None);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(BLUR_SETTLE);
        show_os(&app, None);
    });
}

/// Marks session `id` as needing the user, with `message` when the shell sent one and its pane's chip text `title`.
#[tauri::command]
pub fn attention_mark(app: AppHandle, id: SessionId, message: Option<String>, title: String) {
    let marked = app
        .state::<Attention>()
        .with(|registry| registry.mark(id, message, title))
        .unwrap_or(Marked::Unchanged);
    if marked == Marked::Unchanged {
        return;
    }
    changed(&app);
    if marked == Marked::New {
        show_os(&app, Some(id));
    }
    batch_notification(&app);
}

/// Clears session `id`'s mark, if it has one.
#[tauri::command]
pub fn attention_clear(app: AppHandle, id: SessionId) {
    forget(&app, id);
}

/// Every marked session, oldest first, for a window that just opened.
#[tauri::command]
pub fn attention_list(attention: tauri::State<'_, Attention>) -> Vec<MarkInfo> {
    attention
        .with(|registry| registry.list())
        .unwrap_or_default()
}

/// Brings the window of the oldest marked pane to the front and has it focus that pane; its mark clears.
#[tauri::command]
pub fn attention_next(app: AppHandle) {
    let next = app
        .state::<Attention>()
        .with(|registry| registry.next())
        .flatten();
    if let Some(id) = next {
        focus_session(&app, id);
    }
}

/// A notification was clicked: its pane (the oldest marked one for a summary) comes to the front, focused. Where
/// the pane is gone, the app still comes forward.
pub fn notification_clicked(app: &AppHandle, id: Option<i32>) {
    let session = id.and_then(clicked_session).or_else(|| {
        app.state::<Attention>()
            .with(|registry| registry.next())
            .flatten()
    });
    match session.filter(|&id| app.state::<WindowSessions>().owner(id).is_some()) {
        Some(id) => focus_session(app, id),
        None => {
            if let Some(window) =
                crate::windows::focused_label(app).and_then(|label| app.get_webview_window(&label))
            {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

/// Brings session `id`'s window to the front and has it focus the session's pane; its mark clears.
fn focus_session(app: &AppHandle, id: SessionId) {
    let owner = app.state::<WindowSessions>().owner(id);
    if let Some(window) = owner.and_then(|label| app.get_webview_window(&label)) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(window.label(), ATTENTION_FOCUS_EVENT, id);
    }
    forget(app, id);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn marked(registry: &mut Registry, id: SessionId, message: Option<&str>) -> Marked {
        registry.mark(id, message.map(str::to_string), format!("pane {id}"))
    }

    #[test]
    fn attention_marks_are_kept_oldest_first() {
        let mut registry = Registry::default();
        assert_eq!(marked(&mut registry, 7, None), Marked::New);
        assert_eq!(marked(&mut registry, 3, Some("Build done")), Marked::New);
        assert_eq!(marked(&mut registry, 5, None), Marked::New);
        // Marked again: keeps its place, gains the message it lacked once.
        assert_eq!(marked(&mut registry, 7, Some("Waiting")), Marked::Updated);
        assert_eq!(marked(&mut registry, 7, Some("Other")), Marked::Unchanged);
        assert_eq!(marked(&mut registry, 7, None), Marked::Unchanged);

        let sessions: Vec<_> = registry.list().iter().map(|m| m.session).collect();
        assert_eq!(sessions, [7, 3, 5]);
        assert_eq!(registry.list()[0].message.as_deref(), Some("Waiting"));
        assert_eq!(registry.count(), 3);

        // Next pane in another window: the oldest goes first, and the count drops once it clears.
        assert_eq!(registry.next(), Some(7));
        assert!(registry.clear(7));
        assert!(!registry.clear(7));
        assert_eq!(registry.next(), Some(3));
        assert_eq!(registry.count(), 2);

        // A session marked again after clearing goes to the back.
        assert_eq!(marked(&mut registry, 7, None), Marked::New);
        assert_eq!(registry.next(), Some(3));
        assert!(registry.clear(3) && registry.clear(5));
        assert_eq!(registry.next(), Some(7));
    }

    #[test]
    fn attention_notifications_are_batched_once_per_mark() {
        // (case, notify, marks as (session, message), notification)
        type Case<'a> = (
            &'a str,
            Notify,
            &'a [(SessionId, Option<&'a str>)],
            Option<Notification>,
        );
        let cases: [Case; 5] = [
            (
                "one message: titled with its pane",
                Notify::Messages,
                &[(1, Some("Waiting for input"))],
                Some(Notification {
                    title: "pane 1".into(),
                    body: Some("Waiting for input".into()),
                    session: Some(1),
                }),
            ),
            (
                "Three panes at once: one summary",
                Notify::Messages,
                &[(1, Some("a")), (2, Some("b")), (3, Some("c"))],
                Some(Notification {
                    title: "3 panes need you".into(),
                    body: None,
                    session: None,
                }),
            ),
            (
                "Messages: a bell sends none",
                Notify::Messages,
                &[(1, None)],
                None,
            ),
            (
                "Messages and bells: a bell sends one",
                Notify::MessagesAndBells,
                &[(1, None)],
                Some(Notification {
                    title: "pane 1".into(),
                    body: None,
                    session: Some(1),
                }),
            ),
            ("Off: none", Notify::Off, &[(1, Some("a"))], None),
        ];
        for (name, notify, marks, expected) in cases {
            let mut registry = Registry::default();
            for &(id, message) in marks {
                marked(&mut registry, id, message);
            }
            assert_eq!(registry.take_notification(notify, true), expected, "{name}");
            // One per session until its mark clears.
            assert_eq!(
                registry.take_notification(notify, true),
                None,
                "{name}: again"
            );
        }
    }

    #[test]
    fn attention_click_a_notification_finds_its_pane() {
        assert_eq!(clicked_session(notification_id(Some(42))), Some(42));
        assert_eq!(clicked_session(notification_id(None)), None);
    }

    #[test]
    fn attention_notification_follows_a_bell_that_gains_a_message() {
        let mut registry = Registry::default();
        marked(&mut registry, 1, None);
        assert_eq!(registry.take_notification(Notify::Messages, true), None);
        marked(&mut registry, 1, Some("Done"));
        assert!(registry.take_notification(Notify::Messages, true).is_some());
        // Let go while a tiili window is in front: none now and none later.
        marked(&mut registry, 2, Some("Done"));
        assert_eq!(registry.take_notification(Notify::Messages, false), None);
        assert_eq!(registry.take_notification(Notify::Messages, true), None);
    }
}
