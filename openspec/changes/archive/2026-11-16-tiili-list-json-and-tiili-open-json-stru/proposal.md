# JSON output for `tiili list` and `tiili open`

## Why
`tiili list` prints tab-separated id, folder and title, so an agent has to scrape text to find the pane running the dev server, or to tell which pane is its own. Purpose (decided with the user): dedupe and orient, not act on other panes; scope stays the caller's window.

## What Changes
- `tiili list --json` prints one object `{"ok":true,"protocol":1,"panes":[...]}` on stdout. Each pane: `id`, `self`, `window`, `cwd`, `host`, `repo` `{root,name,worktree}`, `title` (the `--title` override or null), `label` (the chip/place name), `running` `{command,program}` (null at a prompt), `attention` `{message}` or null.
- `tiili open --json` prints `{"ok":true,"protocol":1,"pane":ID}`.
- With `--json`, a failure prints the CLI contract's error envelope `{"ok":false,"code","error","suggestion"}` on stdout (stderr text unchanged); exit codes unchanged. Without `--json` output stays exactly as today.
- The app records the argv of each `tiili open` request beside `PaneTitles`, so a shell-less pane reports `running.command` as the joined command line.
- The list wire reply carries the full records; `describe` fills `output.json` for `list` and `open` and lists the `--json` option. Golden `describe.json` updated.
- Stability: fields are only added; an unknown value is `null`, never omitted.
- Backend only; no frontend change.

## Outcome
- An agent lists its window
  - Now: `3	/Users/r/tiili	tiili`
  - After (`--json`): `{"ok":true,"protocol":1,"panes":[{"id":3,"self":true,"window":"main","cwd":"/Users/r/tiili","host":null,"repo":{"root":"/Users/r/tiili","name":"tiili","worktree":null},"title":null,"label":"tiili","running":null,"attention":null}]}`
- Open with `--json`
  - After: `{"ok":true,"protocol":1,"pane":8}`
- `tiili list --json` outside a pane
  - After: `{"ok":false,"code":"not_in_pane","error":"not inside a tiili pane (TIILI_SOCKET is not set)","suggestion":"run tiili from a pane of the running tiili app"}`, exit 3

## Assumptions
- `running.command` for a `tiili open` pane is the argv joined into one shell-quoted string (Reijo). Rejected: raw argv array.
- The tiili-tiles skill learns `list --json` in the intent-vocabulary work, not here (Reijo).
- `self` is computed by the app from the request's caller pane. Rejected: CLI computing it from `TIILI_PANE` (same result, but the wire record would differ from the printed one).
- `window` is the Tauri window label (e.g. `main`). Rejected: a numeric index, which is not stable.
- The recorded argv is used only while the pane's own process is in front (`Running.command` from shell integration is None); a shell pane's shell-reported command always wins.
- The JSON includes `protocol`, as every reply of the contract does. Rejected: dropping it from stdout.
- `--json` errors still also print the text message and hint on stderr. Rejected: silencing stderr.
- `attention` comes from the app-wide attention registry by session; a mark without a message gives `{"message":null}`.
- The intent-vocabulary change's `List as JSON` requirement (array shape, `command`, `tab`) will need polishing to build on this one; not edited here.
