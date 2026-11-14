# tiili shell integration for PowerShell. tiili starts PowerShell with -NoExit -Command dot-sourcing this file, so the
# user's profiles have loaded already; this sets tiili's prompt only when they left the built-in prompt function,
# following the choice in the integration folder's `prompt` file at every prompt (Off shows the built-in one). Colours are ANSI slots (ESC[30m..ESC[37m), so the terminal's theme picks the actual colours.
$tiiliPrompt = if ($env:TIILI_PROMPT) { $env:TIILI_PROMPT } else { 'off' }
Remove-Item Env:TIILI_PROMPT -ErrorAction SilentlyContinue
$tiiliCurrent = Get-Command prompt -CommandType Function -ErrorAction SilentlyContinue
$tiiliBuiltIn = $null -eq $tiiliCurrent -or
  $tiiliCurrent.ScriptBlock.ToString() -match '^\s*"PS \$\(\$executionContext\.SessionState\.Path\.CurrentLocation\)'
if ($tiiliBuiltIn) {
  $global:TiiliPromptStart = $tiiliPrompt
  $global:TiiliPromptFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'prompt'
  function global:prompt {
    $style = $global:TiiliPromptStart
    try { $style = [IO.File]::ReadAllText($global:TiiliPromptFile).Trim() } catch { }
    if ($style -notin @('classic', 'minimal', 'tiili')) {
      return "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
    }
    $e = [char]27
    $path = $executionContext.SessionState.Path.CurrentLocation.Path
    $homeDir = [Environment]::GetFolderPath('UserProfile')
    if ($homeDir -and $path.StartsWith($homeDir, [StringComparison]::OrdinalIgnoreCase)) {
      $path = '~' + $path.Substring($homeDir.Length)
    }
    $user = [Environment]::UserName
    $machine = [Environment]::MachineName
    $more = '>' * $nestedPromptLevel
    switch ($style) {
      'classic' { "$e[36m$user$e[39m@$e[32m$machine$e[39m:$e[34m$path$e[39m$more$ " }
      'minimal' { "$e[34m$path$e[39m $e[35m$([char]0x276F)$e[39m$more " }
      default { "$e[36m$user$e[39m@$e[32m$machine$e[39m $e[34m$path$e[39m`n$e[33m$([char]0x276F)$e[39m$more " }
    }
  }
}
# Whichever prompt is now defined (tiili's or the user's) is wrapped to report the folder with OSC 7 first, so tiili
# knows this pane is local; its output is returned unchanged.
$global:TiiliWrappedPrompt = (Get-Command prompt -CommandType Function -ErrorAction SilentlyContinue).ScriptBlock
if ($null -eq $global:TiiliWrappedPrompt) {
  $global:TiiliWrappedPrompt = {
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
  }
}
function global:prompt {
  $location = $executionContext.SessionState.Path.CurrentLocation
  if ($location.Provider.Name -eq 'FileSystem' -and $location.ProviderPath -match '^[A-Za-z]:') {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($location.ProviderPath -replace '\\', '/'))
    $encoded = -join ($bytes | ForEach-Object {
      if (($_ -ge 0x30 -and $_ -le 0x39) -or ($_ -ge 0x41 -and $_ -le 0x5A) -or ($_ -ge 0x61 -and $_ -le 0x7A) -or
        $_ -in 0x2D, 0x2E, 0x2F, 0x3A, 0x5F, 0x7E) {
        [string][char]$_
      } else {
        '%{0:X2}' -f $_
      }
    })
    $e = [char]27
    [Console]::Write("$e]7;file://$([Environment]::MachineName)/$encoded$e\")
  }
  & $global:TiiliWrappedPrompt
}
Remove-Variable tiiliPrompt, tiiliCurrent, tiiliBuiltIn -ErrorAction SilentlyContinue
