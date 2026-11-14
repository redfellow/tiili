## Why
In the Linux AppImage, AppRun exports variables pointing into the AppImage mount (LD_LIBRARY_PATH, PATH, XDG_DATA_DIRS, GTK/GIO paths, APPIMAGE, …). tiili hands its whole environment to every shell, so system programs load the AppImage's bundled libraries: on openSUSE `zypper <TAB>` fails with `symbol lookup error: /lib64/libcurl.so.4: undefined symbol: nghttp2_…`.

## What Changes
- When tiili runs from an AppImage (`APPDIR` set), every spawned shell gets the session's environment back: entries at or inside `$APPDIR` are dropped from colon-separated variables (the variable is removed when nothing is left), single-value variables pointing inside `$APPDIR` are removed, and `APPIMAGE`, `APPDIR`, `ARGV0`, `OWD` are removed.
- `GDK_BACKEND=x11` (forced by linuxdeploy's gtk hook) is removed too, so GTK apps launched from a tiili shell on Wayland use Wayland again.
- Outside an AppImage nothing changes. The .deb, macOS and Windows builds are unaffected.

## Outcome
- Tab completion of zypper in the AppImage
  - Now: `zypper: symbol lookup error: /lib64/libcurl.so.4: undefined symbol: nghttp2_option_set_no_rfc9113_leading_and_trailing_ws_validation`
  - After: zypper's subcommands are completed.

## Assumptions
- `GDK_BACKEND` is removed only in an AppImage and only when its value is `x11`; a user's own `GDK_BACKEND=x11` from before AppRun cannot be told apart and is lost (alternative: keep it and leave GTK apps on XWayland).
- An `APPDIR` value that is empty or `/` is treated as not an AppImage, so nothing is stripped (alternative: trust any value).
- Path matching is by path component (`$APPDIR` itself or `$APPDIR/…`), not plain string prefix (alternative: prefix match, which would hit `/tmp/.mount_ABCdef` siblings).
