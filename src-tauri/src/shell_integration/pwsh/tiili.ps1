# tiili shell integration for PowerShell. tiili starts PowerShell with -NoExit -Command dot-sourcing this file, so the
# user's profiles have loaded already; this sets tiili's prompt only when they left the built-in prompt function.
# Colours are ANSI slots (ESC[30m..ESC[37m), so the terminal's theme picks the actual colours.
$tiiliPrompt = $env:TIILI_PROMPT
Remove-Item Env:TIILI_PROMPT -ErrorAction SilentlyContinue
$tiiliCurrent = Get-Command prompt -CommandType Function -ErrorAction SilentlyContinue
$tiiliBuiltIn = $null -eq $tiiliCurrent -or
  $tiiliCurrent.ScriptBlock.ToString() -match '^\s*"PS \$\(\$executionContext\.SessionState\.Path\.CurrentLocation\)'
if ($tiiliBuiltIn -and $tiiliPrompt -in @('classic', 'minimal', 'tiili')) {
  $global:TiiliPromptStyle = $tiiliPrompt
  function global:prompt {
    $e = [char]27
    $path = $executionContext.SessionState.Path.CurrentLocation.Path
    $homeDir = [Environment]::GetFolderPath('UserProfile')
    if ($homeDir -and $path.StartsWith($homeDir, [StringComparison]::OrdinalIgnoreCase)) {
      $path = '~' + $path.Substring($homeDir.Length)
    }
    $user = [Environment]::UserName
    $machine = [Environment]::MachineName
    $more = '>' * $nestedPromptLevel
    switch ($global:TiiliPromptStyle) {
      'classic' { "$e[36m$user$e[39m@$e[32m$machine$e[39m:$e[34m$path$e[39m$more$ " }
      'minimal' { "$e[34m$path$e[39m $e[35m$([char]0x276F)$e[39m$more " }
      default { "$e[36m$user$e[39m@$e[32m$machine$e[39m $e[34m$path$e[39m`n$e[33m$([char]0x276F)$e[39m$more " }
    }
  }
}
Remove-Variable tiiliPrompt, tiiliCurrent, tiiliBuiltIn -ErrorAction SilentlyContinue
