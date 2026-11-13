// @harvaaja-test-tier: fast
//! The main window's saved rectangle and the check that it is still on a connected screen.

use tiili_lib::window_state::{is_on_screen, read_saved, Rect};

const fn rect(x: i32, y: i32, width: u32, height: u32) -> Rect {
    Rect {
        x,
        y,
        width,
        height,
    }
}

/// Monitor unplugged: a saved rectangle on no connected screen is off screen, so the window gets 900×600 centred.
#[test]
fn monitor_unplugged_saved_rectangle_is_off_screen() {
    let main = rect(0, 0, 1920, 1080);
    let external = rect(1920, 0, 2560, 1440);
    let saved_on_external = rect(2500, 100, 1280, 720);
    let cases = [
        (
            "on the main screen",
            rect(100, 100, 1280, 720),
            &[main][..],
            true,
        ),
        (
            "on the external screen",
            saved_on_external,
            &[main, external][..],
            true,
        ),
        (
            "external screen unplugged",
            saved_on_external,
            &[main][..],
            false,
        ),
        (
            "straddling the edge",
            rect(1500, 500, 1280, 720),
            &[main][..],
            true,
        ),
        (
            "above every screen",
            rect(0, -2000, 900, 600),
            &[main][..],
            false,
        ),
        ("no screens", rect(0, 0, 900, 600), &[][..], false),
    ];
    for (name, saved, monitors, expected) in cases {
        assert_eq!(is_on_screen(saved, monitors), expected, "{name}");
    }
}

#[test]
fn saved_state_file_gives_the_main_windows_rectangle() {
    let dir = std::env::temp_dir().join(format!("tiili-window-state-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("state.json");
    std::fs::write(
        &file,
        r#"{"main":{"width":1280,"height":720,"x":-40,"y":60,"maximized":false},"empty":{"width":0,"height":0,"x":0,"y":0}}"#,
    )
    .unwrap();
    assert_eq!(read_saved(&file, "main"), Some(rect(-40, 60, 1280, 720)));
    assert_eq!(read_saved(&file, "empty"), None);
    assert_eq!(read_saved(&file, "other"), None);
    assert_eq!(read_saved(&dir.join("missing.json"), "main"), None);
    std::fs::remove_dir_all(&dir).unwrap();
}
