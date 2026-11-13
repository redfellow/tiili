# tiili shell integration for zsh: the user's own .zshrc, with their ZDOTDIR, then tiili's prompt when the user's
# files left zsh's default one. Colours are ANSI slots (%F{0..7}), so the terminal's theme picks the actual colours.
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
# /etc/zshrc (macOS) put the history in tiili's folder, as ZDOTDIR pointed there: keep it where the user's is.
[[ "$HISTFILE" == "$_tiili_zdotdir/.zsh_history" ]] && HISTFILE="$ZDOTDIR/.zsh_history"
[[ -r "$ZDOTDIR/.zshrc" ]] && builtin source "$ZDOTDIR/.zshrc"
TIILI_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$_tiili_zdotdir"

if [[ -z "$PROMPT" || "$PROMPT" == '%m%# ' || "$PROMPT" == '%n@%m %1~ %# ' ]]; then
  case "$TIILI_PROMPT" in
    classic) PROMPT='%F{6}%n%f@%F{2}%m%f:%F{4}%~%f%(!.#.$) ' ;;
    minimal) PROMPT='%F{4}%~%f %F{5}❯%f ' ;;
    tiili) PROMPT='%F{6}%n%f@%F{2}%m%f %F{4}%~%f'$'\n''%F{3}❯%f ' ;;
  esac
fi

# Report the folder with OSC 7 before every prompt, whichever prompt is shown, so tiili knows this pane is local.
_tiili_osc7() {
  local _tiili_status=$?
  emulate -L zsh
  local LC_ALL=C enc= c hex
  local -i i
  for (( i = 1; i <= ${#PWD}; i++ )); do
    c=${PWD[i]}
    case $c in
      [-/:_.~a-zA-Z0-9]) enc+=$c ;;
      *) printf -v hex '%%%02X' "'$c"; enc+=$hex ;;
    esac
  done
  printf '\e]7;file://%s%s\a' "$HOST" "$enc"
  return $_tiili_status
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd _tiili_osc7

# Without a login shell this is the last startup file: hand ZDOTDIR back to the user.
if [[ ! -o login ]]; then
  ZDOTDIR="$TIILI_USER_ZDOTDIR"
  [[ "$ZDOTDIR" == "$HOME" ]] && unset ZDOTDIR
  unset TIILI_USER_ZDOTDIR TIILI_PROMPT _tiili_zdotdir
fi
