## Why
An OSC 8 `file://` link to a launcher (`run.command`, `x.exe`) opens and runs it after the generic confirm dialog, bypassing the reveal-only rule. The `file://` host check also treats UNC forms (`file:////host/share`) and look-alike hosts (`mymac.attacker.example` on a Mac named `mymac`) as local. The launcher lists miss several file types that run code when opened.

## What Changes
- `link_open` turns a local `file://` URI into a path and applies the same reveal-only check as `path_open`; a launcher is refused with "{abs} would run a program, so tiili only reveals it"; otherwise it opens with `open_path`.
- New `is_local_file_uri` (parsed with `tauri::Url`): host must be none, empty, `localhost` or exactly the local hostname (case-insensitive), and the path must not be UNC, verbatim UNC or a device path. `file_host` is removed; `is_local_host` stays for OSC 7.
- Launcher lists grow: macOS `terminal fileloc inetloc webloc jar mpkg prefpane workflow`; Windows `com pif hta wsf wsh jse vbe cpl msc reg url appref-ms application scf jar psm1 msp`; Linux `jar`.

## Outcome
- ⌘-click an OSC 8 link to an executable `/tmp/t.command`, confirm
  - Now: Terminal runs the script
  - After: `/tmp/t.command would run a program, so tiili only reveals it`

## Assumptions
- A `file://` link to a launcher reports the error rather than revealing the file automatically (matches the card's fix; ruled out auto-reveal).
- A `file://` link whose path doesn't exist fails with `existing()`'s error (ruled out passing it to `open_url`).
