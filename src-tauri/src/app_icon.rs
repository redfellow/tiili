//! tiili's running app icon: the Dock icon on macOS, the window and taskbar icon elsewhere.
//!
//! The icon follows the OS light or dark mode. On macOS the user can instead pin it to the light or the dark icon
//! (the `appIcon` setting); the frontend sends that choice with `app_icon_set`. The installed app bundle keeps
//! its own static icon, which is what the Dock shows while tiili is not running.

use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime, State, Theme};

const LIGHT_PNG: &[u8] = include_bytes!("../icons/app-light.png");
const DARK_PNG: &[u8] = include_bytes!("../icons/app-dark.png");

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

/// Shows the icon that the stored choice and the OS appearance call for.
pub fn apply<R: Runtime>(app: &AppHandle<R>) {
    let choice = app
        .try_state::<IconState>()
        .map(|state| *state.0.lock().unwrap_or_else(|e| e.into_inner()))
        .unwrap_or_default();
    let variant = resolve(choice, os_theme(app), cfg!(target_os = "macos"));
    show(app, variant);
}

#[cfg(target_os = "macos")]
fn show<R: Runtime>(app: &AppHandle<R>, variant: Variant) {
    let _ = app.run_on_main_thread(move || {
        use objc2::{AllocAnyThread, MainThreadMarker};
        use objc2_app_kit::{NSApplication, NSImage};
        use objc2_foundation::NSData;

        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let data = NSData::with_bytes(variant.png());
        if let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) {
            unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn show<R: Runtime>(app: &AppHandle<R>, variant: Variant) {
    let Ok(image) = tauri::image::Image::from_bytes(variant.png()) else {
        return;
    };
    for window in app.webview_windows().values() {
        let _ = window.set_icon(image.clone());
    }
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
        }
    }
}
