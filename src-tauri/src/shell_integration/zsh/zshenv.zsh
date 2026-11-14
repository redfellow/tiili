# tiili shell integration for zsh. tiili starts zsh with ZDOTDIR set to this folder; each of its startup files runs
# the user's own counterpart with the user's ZDOTDIR, then points ZDOTDIR back here for the next file.
typeset -g _tiili_zdotdir="$ZDOTDIR"
# tiili sends SIGUSR1 when the prompt choice changes: switch and redraw an idle prompt. Set first, so the signal never
# ends the shell; it does nothing until .zshrc has decided whether this shell follows the choice.
TRAPUSR1() {
  if (( ${+functions[_tiili_apply_prompt]} )) && _tiili_apply_prompt && zle; then
    zle reset-prompt
  fi
  return 0
}
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zshenv" ]] && builtin source "$ZDOTDIR/.zshenv"
TIILI_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$_tiili_zdotdir"
