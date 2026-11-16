//! tiili's running app icon: the Dock icon on macOS, the window and taskbar icon elsewhere.
//!
//! The icon follows the OS light or dark mode. On macOS the user can instead pin it to the light or the dark icon
//! (the `appIcon` setting); the frontend sends that choice with `app_icon_set`. While tiili is not running, the Dock
//! shows the bundle's asset catalog icon (src-tauri/icons/Assets.car), which follows the OS appearance on its own.
//!
//! While any pane is working (see [`crate::working`]) the icon cycles the "Hot cursor" working frames of its variant
//! every [`FRAME_INTERVAL`], or holds frame 0 when the OS asks for reduced motion. A ticker thread runs only then: it
//! starts on output and, once nothing works, shows the normal icon and ends.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime, State, Theme};

const LIGHT_PNG: &[u8] = include_bytes!("../icons/app-light.png");
const DARK_PNG: &[u8] = include_bytes!("../icons/app-dark.png");

/// How many working frames each variant has.
pub const FRAMES: usize = 8;

/// How long each working frame shows.
pub const FRAME_INTERVAL: Duration = Duration::from_millis(333);

const LIGHT_WORKING: [&[u8]; FRAMES] = [
    include_bytes!("../icons/app-light-working-0.png"),
    include_bytes!("../icons/app-light-working-1.png"),
    include_bytes!("../icons/app-light-working-2.png"),
    include_bytes!("../icons/app-light-working-3.png"),
    include_bytes!("../icons/app-light-working-4.png"),
    include_bytes!("../icons/app-light-working-5.png"),
    include_bytes!("../icons/app-light-working-6.png"),
    include_bytes!("../icons/app-light-working-7.png"),
];

const DARK_WORKING: [&[u8]; FRAMES] = [
    include_bytes!("../icons/app-dark-working-0.png"),
    include_bytes!("../icons/app-dark-working-1.png"),
    include_bytes!("../icons/app-dark-working-2.png"),
    include_bytes!("../icons/app-dark-working-3.png"),
    include_bytes!("../icons/app-dark-working-4.png"),
    include_bytes!("../icons/app-dark-working-5.png"),
    include_bytes!("../icons/app-dark-working-6.png"),
    include_bytes!("../icons/app-dark-working-7.png"),
];

/// Which icon the user wants: the one matching the OS appearance, or always the light or the dark one.
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IconChoice {
    #[default]
    System,
    Light,
    Dark,
}

/// The two icons tiili ships.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Variant {
    Light,
    Dark,
}

impl Variant {
    fn png(self) -> &'static [u8] {
        match self {
            Variant::Light => LIGHT_PNG,
            Variant::Dark => DARK_PNG,
        }
    }

    /// Working frame `i` (taken modulo [`FRAMES`]).
    fn frame(self, i: usize) -> &'static [u8] {
        match self {
            Variant::Light => LIGHT_WORKING[i % FRAMES],
            Variant::Dark => DARK_WORKING[i % FRAMES],
        }
    }
}

/// The working frame to show on tick `tick`: the frames in turn, or frame 0 throughout with reduced motion.
pub fn frame_at(tick: usize, reduce_motion: bool) -> usize {
    if reduce_motion {
        0
    } else {
        tick % FRAMES
    }
}

/// The icon to show for `choice` while the OS is in `os` mode. A pinned choice applies on macOS only; other
/// systems always follow the OS.
pub fn resolve(choice: IconChoice, os: Theme, macos: bool) -> Variant {
    match (choice, macos) {
        (IconChoice::Light, true) => Variant::Light,
        (IconChoice::Dark, true) => Variant::Dark,
        _ if os == Theme::Dark => Variant::Dark,
        _ => Variant::Light,
    }
}

/// The user's current choice, kept so an OS appearance change can re-apply it.
#[derive(Default)]
pub struct IconState(Mutex<IconChoice>);

/// The OS appearance as tiili's window sees it; light when there is no window or it cannot tell.
fn os_theme<R: Runtime>(app: &AppHandle<R>) -> Theme {
    app.webview_windows()
        .values()
        .next()
        .and_then(|window| window.theme().ok())
        .unwrap_or(Theme::Light)
}

/// Which panes are working, and the ticker that animates the icon while any is.
#[derive(Default)]
pub struct WorkingIcon {
    working: Mutex<crate::working::Working>,
    /// Set while the ticker thread runs.
    ticking: AtomicBool,
    /// The ticker's current tick, counting up from 0 each time it starts.
    tick: AtomicUsize,
}

impl WorkingIcon {
    fn with<T>(&self, f: impl FnOnce(&mut crate::working::Working) -> T) -> T {
        f(&mut self.working.lock().unwrap_or_else(|e| e.into_inner()))
    }

    fn any_working(&self) -> bool {
        self.with(|w| w.any_working(Instant::now()))
    }
}

/// Pane `id` printed output: it may now be working, so the ticker starts if it is not running.
pub fn output<R: Runtime>(app: &AppHandle<R>, id: crate::pty::SessionId) {
    let Some(state) = app.try_state::<WorkingIcon>() else {
        return;
    };
    let working = state.with(|w| {
        w.output(id, Instant::now());
        w.any_working(Instant::now())
    });
    if working && !state.ticking.swap(true, Ordering::SeqCst) {
        start_ticker(app.clone());
    }
}

/// Pane `id`'s foreground is now its shell (`is_shell`) or another program.
pub fn foreground<R: Runtime>(app: &AppHandle<R>, id: crate::pty::SessionId, is_shell: bool) {
    if let Some(state) = app.try_state::<WorkingIcon>() {
        state.with(|w| w.foreground(id, is_shell));
    }
}

/// Pane `id` has closed; the ticker notices on its next tick if nothing works any more.
pub fn forget<R: Runtime>(app: &AppHandle<R>, id: crate::pty::SessionId) {
    if let Some(state) = app.try_state::<WorkingIcon>() {
        state.with(|w| w.remove(id));
    }
}

/// Runs the ticker until nothing works: each tick shows the next working frame, then the normal icon at the end.
fn start_ticker<R: Runtime>(app: AppHandle<R>) {
    let spawned = std::thread::Builder::new()
        .name("app-icon-ticker".into())
        .spawn({
            let app = app.clone();
            move || {
                let state = app.state::<WorkingIcon>();
                state.tick.store(0, Ordering::SeqCst);
                loop {
                    if state.any_working() {
                        apply(&app);
                        std::thread::sleep(FRAME_INTERVAL);
                        state.tick.fetch_add(1, Ordering::SeqCst);
                        continue;
                    }
                    state.ticking.store(false, Ordering::SeqCst);
                    apply(&app);
                    // Output that arrived while the ticker was stopping found it still running: carry on for it.
                    if !state.any_working() || state.ticking.swap(true, Ordering::SeqCst) {
                        return;
                    }
                }
            }
        });
    if spawned.is_err() {
        if let Some(state) = app.try_state::<WorkingIcon>() {
            state.ticking.store(false, Ordering::SeqCst);
        }
    }
}

/// Shows the icon that the stored choice and the OS appearance call for: its current working frame while a pane is
/// working, else the normal icon.
pub fn apply<R: Runtime>(app: &AppHandle<R>) {
    let choice = app
        .try_state::<IconState>()
        .map(|state| *state.0.lock().unwrap_or_else(|e| e.into_inner()))
        .unwrap_or_default();
    let variant = resolve(choice, os_theme(app), cfg!(target_os = "macos"));
    let tick = app
        .try_state::<WorkingIcon>()
        .filter(|state| state.ticking.load(Ordering::SeqCst) && state.any_working())
        .map(|state| state.tick.load(Ordering::SeqCst));
    show(app, variant, tick);
}

/// The icon last shown, so a held frame is not set again on every tick.
static SHOWN: Mutex<Option<(Variant, Option<usize>)>> = Mutex::new(None);

/// Shows `variant`'s normal icon, or its working frame for `tick` when given. Runs on the main thread, where the
/// reduce-motion preference is read and the icon set.
fn show<R: Runtime>(app: &AppHandle<R>, variant: Variant, tick: Option<usize>) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let frame = tick.map(|tick| frame_at(tick, reduce_motion()));
        {
            let mut shown = SHOWN.lock().unwrap_or_else(|e| e.into_inner());
            if *shown == Some((variant, frame)) {
                return;
            }
            *shown = Some((variant, frame));
        }
        let png = frame.map_or(variant.png(), |i| variant.frame(i));
        set_icon(&handle, png);
    });
}

#[cfg(target_os = "macos")]
fn set_icon<R: Runtime>(_app: &AppHandle<R>, png: &'static [u8]) {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let data = NSData::with_bytes(png);
    if let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
    }
}

#[cfg(not(target_os = "macos"))]
fn set_icon<R: Runtime>(app: &AppHandle<R>, png: &'static [u8]) {
    let Ok(image) = tauri::image::Image::from_bytes(png) else {
        return;
    };
    for window in app.webview_windows().values() {
        let _ = window.set_icon(image.clone());
    }
}

/// Whether the OS asks apps to reduce motion; `false` (animate) where it cannot be read. Called on the main thread.
#[cfg(target_os = "macos")]
fn reduce_motion() -> bool {
    objc2_app_kit::NSWorkspace::sharedWorkspace().accessibilityDisplayShouldReduceMotion()
}

/// Whether the OS asks apps to reduce motion; `false` (animate) where it cannot be read. Called on the main thread.
#[cfg(windows)]
fn reduce_motion() -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SystemParametersInfoW, SPI_GETCLIENTAREAANIMATION,
    };
    let mut animate: windows_sys::core::BOOL = 1;
    // SAFETY: SPI_GETCLIENTAREAANIMATION writes one BOOL to the pointer it is given.
    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            (&mut animate as *mut windows_sys::core::BOOL).cast(),
            0,
        )
    };
    ok != 0 && animate == 0
}

/// Whether the OS asks apps to reduce motion; `false` (animate) where it cannot be read. Called on the main thread.
#[cfg(all(unix, not(target_os = "macos")))]
fn reduce_motion() -> bool {
    use gtk::prelude::GtkSettingsExt;
    gtk::Settings::default().is_some_and(|settings| !settings.is_gtk_enable_animations())
}

/// Stores the user's icon choice and shows the matching icon.
#[tauri::command]
pub fn app_icon_set<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, IconState>,
    choice: IconChoice,
) {
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = choice;
    apply(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_choice_follows_the_os_everywhere() {
        for macos in [true, false] {
            assert_eq!(
                resolve(IconChoice::System, Theme::Light, macos),
                Variant::Light
            );
            assert_eq!(
                resolve(IconChoice::System, Theme::Dark, macos),
                Variant::Dark
            );
        }
    }

    #[test]
    fn pinned_choice_wins_on_macos() {
        assert_eq!(
            resolve(IconChoice::Light, Theme::Dark, true),
            Variant::Light
        );
        assert_eq!(resolve(IconChoice::Dark, Theme::Light, true), Variant::Dark);
    }

    #[test]
    fn pinned_choice_is_ignored_elsewhere() {
        assert_eq!(
            resolve(IconChoice::Light, Theme::Dark, false),
            Variant::Dark
        );
        assert_eq!(
            resolve(IconChoice::Dark, Theme::Light, false),
            Variant::Light
        );
    }

    #[test]
    fn choice_reads_from_the_settings_strings() {
        let parse = |s: &str| serde_json::from_str::<IconChoice>(&format!("\"{s}\"")).unwrap();
        assert_eq!(parse("system"), IconChoice::System);
        assert_eq!(parse("light"), IconChoice::Light);
        assert_eq!(parse("dark"), IconChoice::Dark);
    }

    #[test]
    fn both_icons_are_pngs() {
        for variant in [Variant::Light, Variant::Dark] {
            assert!(variant.png().starts_with(b"\x89PNG"));
            for i in 0..FRAMES {
                assert!(
                    variant.frame(i).starts_with(b"\x89PNG"),
                    "{variant:?} frame {i}"
                );
                assert_ne!(variant.frame(i), variant.png(), "{variant:?} frame {i}");
            }
        }
    }

    #[test]
    fn frame_at_cycles_the_frames_or_holds_the_first() {
        // (tick, reduce motion, frame)
        let cases = [
            (0, false, 0),
            (1, false, 1),
            (7, false, 7),
            (8, false, 0),
            (19, false, 3),
            (0, true, 0),
            (5, true, 0),
            (13, true, 0),
        ];
        for (tick, reduce, frame) in cases {
            assert_eq!(
                frame_at(tick, reduce),
                frame,
                "tick {tick}, reduce {reduce}"
            );
        }
    }
}
