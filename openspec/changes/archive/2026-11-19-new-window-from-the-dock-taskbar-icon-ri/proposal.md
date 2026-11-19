## Why

The owner keeps tiili on several virtual desktops and wants a new tiili window on the current one straight from the Dock or taskbar icon, without first switching to an existing tiili window. Today New Window exists only in the macOS Shell menu and as a pane shortcut, and a second launch on Windows or Linux starts a second tiili process.

## What Changes

- macOS: a Dock menu (right-click or long-press the Dock icon) with **New Window**, added to tao's app delegate via `applicationDockMenu:` with objc2. It opens a window on the current Space and focuses it.
- Single instance on all platforms with `tauri-plugin-single-instance`: a second launch hands its arguments to the running tiili and exits before it restores a session. A plain second launch focuses the last focused window; a launch with `--new-window` opens a new window and focuses it.
- Windows: a taskbar jump-list task **New Window** running `tiili.exe --new-window`.
- Linux: a desktop action **New Window** (`Exec=tiili --new-window`) in the .desktop entry the .deb and AppImage install.
- Docs: how to open a new window from the Dock/taskbar per platform, and that middle-click opens nothing new on macOS (the Dock passes no middle click) nor on Windows/Linux (a middle-click relaunch focuses the last window).

## Outcome

- Dock icon right-click on macOS
  - After: a `New Window` item above the system items
- Windows taskbar jump list
  - After: a `Tasks` group with `New Window`
- Linux dash / launcher right-click
  - After: `New Window`
- Launching tiili again while it runs (Windows, Linux)
  - Now: a second tiili process opens its own window and restores the session again
  - After: the running tiili's last window comes to the front

## Assumptions

- The window opened from the Dock / jump list / desktop action starts its first pane in the home folder (no focused pane to inherit a folder from); ruled out: the last focused window's pane folder.
- macOS keeps its current reopen behaviour for a plain Dock click (the OS handles it; single-instance does nothing there since LaunchServices already reuses the app).
- The jump list is written at every start of the app (cheap, keeps the path current after updates); ruled out: writing it only in the NSIS installer.
- Middle-click is not given new-window behaviour on any platform, following the user's answer that a plain second launch focuses the last window.
