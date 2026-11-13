# tiili shell integration for zsh: the user's own .zshrc, with their ZDOTDIR, then tiili's prompt when the user's
# files left zsh's default one. Colours are ANSI slots (%F{0..7}), so the terminal's theme picks the actual colours.
ZDOTDIR="${TIILI_USER_ZDOTDIR:-$HOME}"
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

# Without a login shell this is the last startup file: hand ZDOTDIR back to the user.
if [[ ! -o login ]]; then
  ZDOTDIR="$TIILI_USER_ZDOTDIR"
  [[ "$ZDOTDIR" == "$HOME" ]] && unset ZDOTDIR
  unset TIILI_USER_ZDOTDIR TIILI_PROMPT _tiili_zdotdir
fi
