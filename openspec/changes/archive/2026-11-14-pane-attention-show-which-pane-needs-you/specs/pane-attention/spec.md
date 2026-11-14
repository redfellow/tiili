## Purpose
Show which tiili terminal pane is waiting for the user, from the bell and notification escape codes, in the pane, the top bar, the OS and desktop notifications.

## ADDED Requirements

### Requirement: Attention signals
A terminal pane SHALL hear BEL, OSC 9 (except ConEmu `9;<n>;…` codes such as `9;4` and `9;9`), OSC 777 `notify;<title>;<body>` and basic OSC 99 as attention signals, with a BEL that only ends an OSC not counted. An OSC 9 and a BEL arriving together SHALL count as one signal keeping the message. Heynote panes SHALL never be marked.

#### Scenario: OSC 9 message
- **WHEN** an unfocused pane receives `ESC ] 9 ; Build done BEL`
- **THEN** the pane is marked with the message `Build done`

#### Scenario: ConEmu progress ignored
- **WHEN** a pane receives `ESC ] 9 ; 4 ; 1 ; 50 BEL`
- **THEN** the pane is not marked

### Requirement: Attention message safety
Message text SHALL have control characters removed and be shown as plain text, and a report over 4096 bytes SHALL be ignored. One pane SHALL fire at most once every 2 seconds.

#### Scenario: Hostile file
- **WHEN** the user cats a file holding a thousand BELs in an unfocused pane
- **THEN** the pane is marked once and at most one notification is sent

### Requirement: Needs-you state
A pane SHALL be marked only when it is not the focused pane in the front window. Focusing it in the front window SHALL clear the mark at once, as SHALL its exit or close. The mark SHALL move with the pane to another window. A bell in the pane the user is looking at SHALL do nothing.

#### Scenario: Focus clears
- **WHEN** a marked pane is focused in the front window
- **THEN** its mark clears

#### Scenario: Mark moves
- **WHEN** a marked pane is moved to another window
- **THEN** it is still marked there and still counted

### Requirement: Attention look
A marked pane's chip SHALL show a small brick at its start, before the place text, in the pane's tint label colour (accent on the neutral chip), pulse once when the mark arrives (not under prefers-reduced-motion), and show the message in its tooltip with the chip text unchanged. The marked pane SHALL not be dimmed or desaturated, and nothing SHALL be drawn on its top edge. The window title SHALL not change.

#### Scenario: Marked chip
- **WHEN** an unfocused pane in `api` running `claude` is marked with `Waiting for input`
- **THEN** its chip shows the brick then `api · claude`, its tooltip includes `Waiting for input`, and its content is at full opacity

### Requirement: Attention count and next pane
The top bar SHALL show the count of marked panes across all windows. Cmd+J on macOS and Ctrl+Shift+J on Windows and Linux SHALL focus the oldest marked pane in any window and bring that window to the front. tiili SHALL never move focus by itself.

#### Scenario: Next pane in another window
- **WHEN** the oldest marked pane is in another window and the user presses the shortcut
- **THEN** that window comes to the front with that pane focused, and the count drops by one

### Requirement: Attention outside tiili
When no tiili window is in front, a new mark SHALL badge the app icon with the count of marked panes (macOS Dock badge, Windows taskbar brick overlay per window, Linux launcher badge where supported) and request user attention once (Dock bounce, taskbar flash, urgency hint), or until the user returns when Bounce/flash is "Until I return", or not when it is "Never". The badge SHALL follow the count and nothing SHALL be shown at OS level while a tiili window is in front.

#### Scenario: Agent finishes while in another app
- **WHEN** tiili is in the background and two panes are marked
- **THEN** the app icon shows 2 and attention was requested once per mark

### Requirement: Desktop notifications
With Notify set to Messages, an OSC 9, 777 or 99 message SHALL send a desktop notification titled with the chip's `<place> · <command>` and with the message as body; with "Messages and bells" bells SHALL send one too; Off sends none. A pane SHALL send at most one until its mark clears, and marks within about 2 seconds SHALL be summarised as `N panes need you`.

#### Scenario: Three panes at once
- **WHEN** three panes send messages within a second
- **THEN** one notification `3 panes need you` is shown

### Requirement: Notification clicks
Where the platform delivers a notification click to the app, clicking SHALL focus that pane and bring its window to the front; otherwise it SHALL bring tiili forward. macOS SHALL ask permission at the first notification, not at startup.

#### Scenario: Click a notification
- **WHEN** the user clicks a pane's notification on a platform that delivers clicks
- **THEN** that pane's window comes to the front with the pane focused
