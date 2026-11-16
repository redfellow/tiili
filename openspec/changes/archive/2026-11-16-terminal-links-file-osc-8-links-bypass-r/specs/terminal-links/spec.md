## MODIFIED Requirements

### Requirement: Scheme rules
`http`, `https` and `mailto` links SHALL open directly. Other schemes SHALL open only after a confirm dialog showing the scheme and full URI. `javascript:`, `data:`, `blob:` and `file://` with a non-local host SHALL never open. A `file://` host is local only when it is empty, `localhost` or exactly this machine's name, and a UNC or device path is never local. A Rust command SHALL enforce these rules before calling the opener.

#### Scenario: Unknown scheme asks first
- **WHEN** the user opens a `vscode://` link
- **THEN** a dialog shows the scheme and URI and the link opens only if confirmed

#### Scenario: Forbidden scheme
- **WHEN** an OSC 8 link targets `javascript:` or `data:`
- **THEN** it never opens

#### Scenario: Remote file host
- **WHEN** an OSC 8 link targets `file:////attacker/share/x.exe` or `file://mymac.attacker.example/x` on a machine named `mymac`
- **THEN** it never opens

### Requirement: Opening paths
A file SHALL open in the OS default app with any line dropped, and the hint SHALL say the line is ignored. A folder SHALL open in Finder, Explorer or the Linux file manager. Executables and launchers, as listed in Launcher types, SHALL only be revealed, never opened, whether reached as a printed path or a `file://` link.

#### Scenario: Executable is revealed
- **WHEN** the user ⌘/Ctrl-clicks `./build.sh` which has the exec bit
- **THEN** its folder opens with the file selected and the script does not run

#### Scenario: file link to a launcher
- **WHEN** the user opens and confirms an OSC 8 link to `file:///tmp/t.command`
- **THEN** tiili says it only reveals it and the script does not run

## ADDED Requirements

### Requirement: Launcher types
Launchers SHALL be: on macOS `.app .command .tool .pkg .terminal .fileloc .inetloc .webloc .jar .mpkg .prefpane .workflow` and the exec bit; on Windows `.exe .bat .cmd .ps1 .vbs .js .msi .lnk .scr .com .pif .hta .wsf .wsh .jse .vbe .cpl .msc .reg .url .appref-ms .application .scf .jar .psm1 .msp`; on Linux the exec bit, `.desktop` and `.jar`.

#### Scenario: Terminal settings file
- **WHEN** the user opens `notes.terminal` on macOS
- **THEN** it is only revealed
