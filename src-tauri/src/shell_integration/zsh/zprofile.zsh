# tiili shell integration for zsh: the user's own .zprofile, with their ZDOTDIR.
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zprofile" ]] && builtin source "$ZDOTDIR/.zprofile"
TIILI_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$_tiili_zdotdir"
