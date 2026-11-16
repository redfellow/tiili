//! tiili's running app icon: the Dock icon on macOS, the window and taskbar icon elsewhere.
//!
//! The icon follows the OS light or dark mode. On macOS the user can instead pin it to the light or the dark icon
//! (the `appIcon` setting); the frontend sends that choice with `app_icon_set`. While tiili is not running, the Dock
//! shows the bundle's asset catalog icon (src-tauri/icons/Assets.car), which follows the OS appearance on its own.
//! While tiili runs on macOS with the icon following the system and no pane working, it hands the Dock back to that
//! asset catalog icon, so macOS draws it with the Liquid Glass rim it gives other apps' icons; a PNG set at run time
//! gets no such effects.
//!
//! While any pane is working (see [`crate::working`]) the icon cycles the "Hot cursor" working frames of its variant
//! every [`FRAME_INTERVAL`], or holds frame 0 when the OS asks for reduced motion. A ticker thread runs only then: it
//! starts on output and, once nothing works, shows the normal icon and ends.
//!
//! On macOS, while a pane is marked for attention and no tiili window is in front (see [`crate::attention`]), a
//! koivu ring breathes around the Dock icon's edge on top of whatever icon shows. The same ticker drives it, ticking
//! every [`RING_TICK`] while the ring shows so the breathing is smooth; with reduced motion the ring holds still.

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

/// What the app icon shows: the bundle's asset catalog icon, a variant's normal icon, or one of its working frames.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Icon {
    Bundle,
    Normal(Variant),
    Working(Variant, usize),
}

/// The icon to show for `choice` and its resolved `variant`, given the working `frame` (None when no pane works)
/// and whether the app has an asset catalog icon to fall back to (`bundled`, macOS app bundles only). Only the
/// system choice uses the bundle icon, since that is the one that follows the OS appearance.
pub fn pick(choice: IconChoice, variant: Variant, frame: Option<usize>, bundled: bool) -> Icon {
    match frame {
        Some(i) => Icon::Working(variant, i),
        None if bundled && choice == IconChoice::System => Icon::Bundle,
        None => Icon::Normal(variant),
    }
}

/// How often the ticker ticks while the attention ring shows: a quarter of [`FRAME_INTERVAL`], so the working
/// frames keep their pace by moving on every [`TICKS_PER_FRAME`] ticks.
pub const RING_TICK: Duration = Duration::from_millis(83);
pub const TICKS_PER_FRAME: usize = 4;

/// Ticks in one breath of the attention ring, about 3 seconds.
pub const RING_TICKS: usize = 36;

/// The attention ring's opacity range: it breathes between these, starting at the top.
const RING_MIN: f64 = 0.4;
const RING_MAX: f64 = 0.9;

/// The attention ring's opacity at breathing step `step` (taken modulo [`RING_TICKS`]): a cosine from
/// [`RING_MAX`] down to [`RING_MIN`] and back.
pub fn ring_opacity(step: usize) -> f64 {
    let phase = (step % RING_TICKS) as f64 / RING_TICKS as f64 * std::f64::consts::TAU;
    let mid = (RING_MAX + RING_MIN) / 2.0;
    mid + (RING_MAX - mid) * phase.cos()
}

/// Koivu, the attention ring's colour, as sRGB components.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const KOIVU: (f64, f64, f64) = (217.0 / 255.0, 164.0 / 255.0, 58.0 / 255.0);

/// What the Dock shows: an icon, and the attention ring's breathing step when a pane wants the user.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Shown {
    pub icon: Icon,
    pub ring: Option<usize>,
}

/// What to show for `choice` and its `variant`, given the working `frame`, the ring's breathing step `ring` (None
/// when nothing asks for attention) and whether a bundle icon is there (`bundled`). The ring is drawn onto a
/// run-time icon, so it never shows over the bundle icon: with a ring, the normal icon stands in for it.
pub fn shown(
    choice: IconChoice,
    variant: Variant,
    frame: Option<usize>,
    ring: Option<usize>,
    bundled: bool,
) -> Shown {
    Shown {
        icon: pick(choice, variant, frame, bundled && ring.is_none()),
        ring,
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
    /// Set while a pane wants the user and no tiili window is in front (macOS only).
    attention: AtomicBool,
}

impl WorkingIcon {
    fn with<T>(&self, f: impl FnOnce(&mut crate::working::Working) -> T) -> T {
        f(&mut self.working.lock().unwrap_or_else(|e| e.into_inner()))
    }

    fn any_working(&self) -> bool {
        self.with(|w| w.any_working(Instant::now()))
    }

    fn wants_attention(&self) -> bool {
        self.attention.load(Ordering::SeqCst)
    }

    /// Whether the ticker has anything to animate.
    fn active(&self) -> bool {
        self.any_working() || self.wants_attention()
    }
}

/// Shows or hides the breathing attention ring. Only macOS draws it; elsewhere this does nothing.
pub fn set_attention<R: Runtime>(app: &AppHandle<R>, on: bool) {
    if !cfg!(target_os = "macos") {
        return;
    }
    let Some(state) = app.try_state::<WorkingIcon>() else {
        return;
    };
    if state.attention.swap(on, Ordering::SeqCst) == on {
        return;
    }
    if on && !state.ticking.swap(true, Ordering::SeqCst) {
        start_ticker(app.clone());
    } else {
        apply(app);
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

/// Runs the ticker until nothing works and nothing wants attention: each tick shows the next working frame and ring
/// step, then the plain icon at the end.
fn start_ticker<R: Runtime>(app: AppHandle<R>) {
    let spawned = std::thread::Builder::new()
        .name("app-icon-ticker".into())
        .spawn({
            let app = app.clone();
            move || {
                let state = app.state::<WorkingIcon>();
                state.tick.store(0, Ordering::SeqCst);
                loop {
                    if state.active() {
                        apply(&app);
                        // Tick fast only while the ring breathes; the working frames alone need a tick per frame.
                        let (sleep, step) = if state.wants_attention() {
                            (RING_TICK, 1)
                        } else {
                            (FRAME_INTERVAL, TICKS_PER_FRAME)
                        };
                        std::thread::sleep(sleep);
                        state.tick.fetch_add(step, Ordering::SeqCst);
                        continue;
                    }
                    state.ticking.store(false, Ordering::SeqCst);
                    apply(&app);
                    // Output or a mark that arrived while the ticker was stopping found it still running: carry on.
                    if !state.active() || state.ticking.swap(true, Ordering::SeqCst) {
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
/// working, else the normal icon, with the attention ring while a pane wants the user.
pub fn apply<R: Runtime>(app: &AppHandle<R>) {
    let choice = app
        .try_state::<IconState>()
        .map(|state| *state.0.lock().unwrap_or_else(|e| e.into_inner()))
        .unwrap_or_default();
    let variant = resolve(choice, os_theme(app), cfg!(target_os = "macos"));
    let (tick, ring) = app
        .try_state::<WorkingIcon>()
        .map(|state| {
            let tick = state
                .ticking
                .load(Ordering::SeqCst)
                .then(|| state.tick.load(Ordering::SeqCst));
            let working = tick.filter(|_| state.any_working());
            let ring = state.wants_attention().then(|| tick.unwrap_or(0));
            (working, ring)
        })
        .unwrap_or((None, None));
    show(app, choice, variant, tick, ring);
}

/// The icon last shown, so a held frame is not set again on every tick.
static SHOWN: Mutex<Option<Shown>> = Mutex::new(None);

/// Shows the bundle icon, `variant`'s normal icon, or its working frame for `tick` when given, with the attention
/// ring at the step for `ring` when given (see [`shown`]). Runs on the main thread, where the reduce-motion
/// preference is read and the icon set.
fn show<R: Runtime>(
    app: &AppHandle<R>,
    choice: IconChoice,
    variant: Variant,
    tick: Option<usize>,
    ring: Option<usize>,
) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let reduce = reduce_motion();
        let frame = tick.map(|tick| frame_at(tick / TICKS_PER_FRAME, reduce));
        let ring = ring.map(|tick| if reduce { 0 } else { tick % RING_TICKS });
        let next = shown(choice, variant, frame, ring, has_bundle_icon());
        {
            let mut last = SHOWN.lock().unwrap_or_else(|e| e.into_inner());
            if *last == Some(next) {
                return;
            }
            *last = Some(next);
        }
        let ring = next.ring.map(ring_opacity);
        match next.icon {
            Icon::Bundle => clear_icon(),
            Icon::Normal(variant) => set_icon(&handle, variant.png(), ring),
            Icon::Working(variant, i) => set_icon(&handle, variant.frame(i), ring),
        }
    });
}

/// Whether the running app is a bundle with an asset catalog icon (CFBundleIconName); `tauri dev` runs a bare binary
/// without one. Called on the main thread.
#[cfg(target_os = "macos")]
fn has_bundle_icon() -> bool {
    use objc2_foundation::{ns_string, NSBundle};
    NSBundle::mainBundle()
        .objectForInfoDictionaryKey(ns_string!("CFBundleIconName"))
        .is_some()
}

/// Only macOS bundles carry an asset catalog icon.
#[cfg(not(target_os = "macos"))]
fn has_bundle_icon() -> bool {
    false
}

/// Hands the Dock back to the bundle's asset catalog icon, which macOS draws with its own effects.
#[cfg(target_os = "macos")]
fn clear_icon() {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    if let Some(mtm) = MainThreadMarker::new() {
        unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(None) };
    }
}

/// Never reached: [`has_bundle_icon`] is false outside macOS.
#[cfg(not(target_os = "macos"))]
fn clear_icon() {}

/// The tile's size relative to the canvas in Apple's app icon grid: 824 of 1024 px.
const DOCK_TILE_RATIO: f64 = 824.0 / 1024.0;

/// Where the tile sits on a square canvas of side `canvas` in Apple's app icon grid: its offset from the canvas edge
/// on both axes and its side. The rest of the canvas is a transparent margin.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn dock_inset(canvas: f64) -> (f64, f64) {
    let side = canvas * DOCK_TILE_RATIO;
    ((canvas - side) / 2.0, side)
}

/// The attention ring's line width and corner radius for a tile of side `side`: 4 % of the tile, enough to read at
/// Dock size, and the brand
/// icon's 22.5 % corner less half the line, so the stroke sits just inside the tile's edge.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn ring_geometry(side: f64) -> (f64, f64) {
    let width = side * 0.04;
    (width, side * 0.225 - width / 2.0)
}

/// Sets the Dock icon. The icon is drawn onto a transparent canvas of its own size with the tile inset to the icon
/// grid, so it is as big as the other apps' icons rather than filling the canvas edge to edge. With `ring`, a koivu
/// ring of that opacity is stroked round the tile's edge.
#[cfg(target_os = "macos")]
fn set_icon<R: Runtime>(_app: &AppHandle<R>, png: &'static [u8], ring: Option<f64>) {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSBezierPath, NSColor, NSCompositingOperation, NSImage};
    use objc2_foundation::{NSData, NSPoint, NSRect, NSSize};

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let data = NSData::with_bytes(png);
    let Some(source) = NSImage::initWithData(NSImage::alloc(), &data) else {
        return;
    };
    let size = source.size();
    let (offset_x, side_x) = dock_inset(size.width);
    let (offset_y, side_y) = dock_inset(size.height);
    let padded = NSImage::initWithSize(NSImage::alloc(), size);
    // lockFocus is deprecated, but it draws on a transparent canvas without a drawing block.
    #[allow(deprecated)]
    {
        padded.lockFocus();
        source.drawInRect_fromRect_operation_fraction(
            NSRect::new(
                NSPoint::new(offset_x, offset_y),
                NSSize::new(side_x, side_y),
            ),
            NSRect::ZERO,
            NSCompositingOperation::SourceOver,
            1.0,
        );
        if let Some(alpha) = ring {
            let (width, radius) = ring_geometry(side_x);
            let inset = width / 2.0;
            let rect = NSRect::new(
                NSPoint::new(offset_x + inset, offset_y + inset),
                NSSize::new(side_x - width, side_y - width),
            );
            let path =
                NSBezierPath::bezierPathWithRoundedRect_xRadius_yRadius(rect, radius, radius);
            path.setLineWidth(width);
            let (r, g, b) = KOIVU;
            NSColor::colorWithSRGBRed_green_blue_alpha(r, g, b, alpha).setStroke();
            path.stroke();
        }
        padded.unlockFocus();
    }
    unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&padded)) };
}

#[cfg(not(target_os = "macos"))]
fn set_icon<R: Runtime>(app: &AppHandle<R>, png: &'static [u8], _ring: Option<f64>) {
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
    fn pick_hands_the_idle_system_icon_to_the_bundle() {
        use IconChoice as C;
        use Variant as V;
        // (choice, variant, frame, bundled, icon)
        let cases = [
            (C::System, V::Dark, None, true, Icon::Bundle),
            (C::System, V::Light, None, true, Icon::Bundle),
            (C::System, V::Dark, None, false, Icon::Normal(V::Dark)),
            (
                C::System,
                V::Light,
                Some(3),
                true,
                Icon::Working(V::Light, 3),
            ),
            (C::Light, V::Light, None, true, Icon::Normal(V::Light)),
            (C::Dark, V::Dark, None, true, Icon::Normal(V::Dark)),
            (C::Dark, V::Dark, Some(0), true, Icon::Working(V::Dark, 0)),
        ];
        for (choice, variant, frame, bundled, icon) in cases {
            assert_eq!(
                pick(choice, variant, frame, bundled),
                icon,
                "{choice:?} {variant:?} {frame:?} bundled {bundled}"
            );
        }
    }

    #[test]
    fn ring_takes_the_dock_off_the_bundle_icon() {
        use IconChoice as C;
        use Variant as V;
        // (choice, frame, ring, bundled, shown)
        let cases = [
            (C::System, None, None, true, Icon::Bundle, None),
            (
                C::System,
                None,
                Some(2),
                true,
                Icon::Normal(V::Dark),
                Some(2),
            ),
            (
                C::System,
                Some(5),
                Some(5),
                true,
                Icon::Working(V::Dark, 5),
                Some(5),
            ),
            (C::Dark, None, Some(0), true, Icon::Normal(V::Dark), Some(0)),
            (
                C::System,
                None,
                Some(7),
                false,
                Icon::Normal(V::Dark),
                Some(7),
            ),
        ];
        for (choice, frame, ring, bundled, icon, expected_ring) in cases {
            assert_eq!(
                shown(choice, V::Dark, frame, ring, bundled),
                Shown {
                    icon,
                    ring: expected_ring
                },
                "{choice:?} {frame:?} {ring:?} bundled {bundled}"
            );
        }
    }

    #[test]
    fn ring_breathes_smoothly_between_its_bounds() {
        assert!((ring_opacity(0) - RING_MAX).abs() < 1e-9);
        assert!((ring_opacity(RING_TICKS / 2) - RING_MIN).abs() < 1e-9);
        assert!((ring_opacity(RING_TICKS) - RING_MAX).abs() < 1e-9);
        for i in 1..RING_TICKS {
            let (a, b) = (ring_opacity(i - 1), ring_opacity(i));
            assert!((a - b).abs() < 0.05, "step {i} jumps from {a} to {b}");
            assert!((RING_MIN - 1e-9..=RING_MAX + 1e-9).contains(&b), "step {i}");
        }
    }

    #[test]
    fn ring_ticks_keep_the_working_frames_pace() {
        assert_eq!(
            RING_TICK * TICKS_PER_FRAME as u32,
            Duration::from_millis(332)
        );
    }

    #[test]
    fn ring_geometry_for_an_824_tile() {
        let (width, radius) = ring_geometry(824.0);
        assert!((width - 32.96).abs() < 1e-9);
        assert!((radius - (185.4 - 16.48)).abs() < 1e-9);
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
    fn inset_geometry_1024_canvas_gives_824_tile_at_offset_100() {
        // Inset geometry: a canvas of 1024 px gives an 824 px tile at offset 100 px.
        // (canvas, offset, side)
        let cases = [(512.0, 50.0, 412.0), (1024.0, 100.0, 824.0)];
        for (canvas, offset, side) in cases {
            assert_eq!(dock_inset(canvas), (offset, side), "canvas {canvas}");
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
