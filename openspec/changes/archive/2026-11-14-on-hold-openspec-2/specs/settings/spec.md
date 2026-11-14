## MODIFIED Requirements

### Requirement: Remote shells snippets
The Behaviour tab SHALL have a Remote shells section with an info button whose hint says adding the snippet to a remote shell startup file lets tiili show that machine's folder and repository. A bash / zsh / fish switch (bash on each form reset) SHALL pick the read-only snippet shown, and Copy SHALL put it on the clipboard. Each snippet SHALL send the folder as OSC 7 and the git root (empty outside a repository) as `tiili_repo` at every prompt. The section saves nothing.

#### Scenario: Copy the zsh snippet
- **WHEN** the user switches to zsh and clicks Copy
- **THEN** the clipboard holds the zsh snippet exactly as shown

#### Scenario: Snippet reports a repository
- **WHEN** the bash snippet is sourced on a remote machine and the user runs `cd /srv/api/src` inside repository `/srv/api`
- **THEN** the next prompt sends OSC 7 for `/srv/api/src` and `tiili_repo` set to the base64 of `/srv/api`

#### Scenario: Snippet outside a repository
- **WHEN** the user runs `cd /tmp` on the remote machine with the snippet sourced
- **THEN** the next prompt sends `tiili_repo` with an empty value
