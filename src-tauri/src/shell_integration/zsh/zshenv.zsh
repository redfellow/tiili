# tiili shell integration for zsh. tiili starts zsh with ZDOTDIR set to this folder; each of its startup files runs
# the user's own counterpart with the user's ZDOTDIR, then points ZDOTDIR back here for the next file.
typeset -g _tiili_zdotdir="$ZDOTDIR"
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zshenv" ]] && builtin source "$ZDOTDIR/.zshenv"
TIILI_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$_tiili_zdotdir"
