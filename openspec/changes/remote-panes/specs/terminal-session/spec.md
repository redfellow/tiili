## MODIFIED Requirements

### Requirement: Prompt shell integration
When a prompt other than Off is chosen, tiili SHALL start zsh, bash and PowerShell so that the user's own startup files still load first and the chosen prompt is set only when those files left the shell's default prompt. These shells SHALL also report their working folder with OSC 7, naming this machine's hostname, before every prompt, whichever prompt is shown. Other shells, and every shell with Off, SHALL start with the same program and arguments as without the integration.

#### Scenario: Default zsh gets the chosen prompt
- **WHEN** Classic is chosen and a zsh whose config sets no PROMPT starts
- **THEN** its prompt is the coloured Classic prompt

#### Scenario: User's own prompt wins
- **WHEN** Classic is chosen and the user's `.zshrc` sets PROMPT (or `.bashrc` sets PS1, or the PowerShell profile defines `prompt`)
- **THEN** the shell shows the user's prompt

#### Scenario: Folder reported at every prompt
- **WHEN** Classic is chosen and the user runs `cd /tmp` in zsh, bash or PowerShell, including one whose own config set the prompt
- **THEN** the shell sends OSC 7 for `/tmp` (or the Windows folder) before its next prompt, and the user's prompt and existing prompt hooks still run
