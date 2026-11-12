# tiili

A desktop terminal for macOS, Windows and Linux that tiles its terminals automatically and colours them by
project, so you can run many coding agents side by side. *Tiili* is Finnish for brick.

- What it is and why: [`docs/concept.md`](docs/concept.md)
- Brand and design tokens: [`docs/brand/`](docs/brand/README.md)

## Colour by repository

Each pane shows a chip with its git repository's name in that repository's tint; panes in the same repository
share the tint. Outside a repository the chip shows the folder's name in a neutral style.

On macOS and Linux the pane follows `cd` by itself. On Windows it follows the folder only when the shell reports it
with OSC 7 at each prompt; without that, the chip keeps the folder the pane started in. To turn it on:

PowerShell, in your profile (`notepad $PROFILE`):

```powershell
function prompt {
  $loc = $executionContext.SessionState.Path.CurrentLocation
  $osc7 = ""
  if ($loc.Provider.Name -eq "FileSystem") {
    $esc = [char]27
    $path = $loc.ProviderPath -replace '\\', '/'
    $osc7 = "$esc]7;file://${env:COMPUTERNAME}/$path$esc\"
  }
  "${osc7}PS $loc$('>' * ($nestedPromptLevel + 1)) "
}
```

cmd, once (it sets the `PROMPT` variable for your user):

```bat
setx PROMPT "$e]7;file://%COMPUTERNAME%/$P$e\$P$G"
```

This repository is planned and built through härvääjä with OpenSpec.

Specs live in `openspec/specs` and changes in `openspec/changes`.
