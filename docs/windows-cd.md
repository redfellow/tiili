# Windows: let the chip follow `cd`

On macOS and Linux a tiili pane follows your working directory by itself, so its repository tint and name chip
change as you `cd`. On Windows it does so only when the shell reports the folder with OSC 7 at each prompt; without
that, the chip keeps the folder the pane started in.

## PowerShell

In your profile (`notepad $PROFILE`):

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

## cmd

Once (it sets the `PROMPT` variable for your user):

```bat
setx PROMPT "$e]7;file://%COMPUTERNAME%/$P$e\$P$G"
```
