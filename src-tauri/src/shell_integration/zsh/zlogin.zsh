# tiili shell integration for zsh: the user's own .zlogin, the last startup file, then ZDOTDIR is the user's again.
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zlogin" ]] && builtin source "$ZDOTDIR/.zlogin"
[[ "$ZDOTDIR" == "$HOME" ]] && unset ZDOTDIR
unset TIILI_USER_ZDOTDIR TIILI_PROMPT _tiili_zdotdir
